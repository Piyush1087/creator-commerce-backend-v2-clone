import { Injectable } from "@nestjs/common";
import {
  InstagramCapabilityState,
  InstagramSyncCapabilityClass,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceAuthorizedReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import type {
  InstagramAudienceBreakdown,
  InstagramAudienceInsightsTruth,
  InstagramAudiencePopulation,
  InstagramProfileTruth,
} from "../../instagram/instagram-intelligence-provider.types";
import { InstagramC2FoundationsService } from "../foundations/instagram-c2-foundations.service";
import { InstagramB3bMediaCompletionService } from "../media/instagram-b3b-media-completion.service";
import { InstagramC3SemanticsService } from "../semantics/instagram-c3-semantics.service";
import { InstagramC4RuntimeService } from "../runtime/instagram-c4.runtime.service";
import type { InstagramSyncLease } from "./instagram-sync-coordinator.repository";
import { InstagramSyncPipelinePort } from "./instagram-sync-pipeline.port";

const PROFILE_NORMALIZATION = "instagram.profile.c1.v1";
const AUDIENCE_NORMALIZATION = "instagram.audience.c1.v1";
const POPULATIONS: readonly InstagramAudiencePopulation[] = [
  "FOLLOWERS",
  "ENGAGED_AUDIENCE",
];
const BREAKDOWNS: readonly InstagramAudienceBreakdown[] = [
  "AGE",
  "CITY",
  "COUNTRY",
  "GENDER",
];

@Injectable()
export class InstagramSyncPipelineAdapter extends InstagramSyncPipelinePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reads: InstagramIntelligenceAuthorizedReadService,
    private readonly writer: InstagramCaptureWriterService,
    private readonly media: InstagramB3bMediaCompletionService,
    private readonly foundations: InstagramC2FoundationsService,
    private readonly semantics: InstagramC3SemanticsService,
    private readonly c4: InstagramC4RuntimeService,
  ) {
    super();
  }

  async execute(lease: InstagramSyncLease) {
    const executionCutoff = lease.windowEnd;
    const integration = await this.prisma.brandIntegration.findUniqueOrThrow({
      where: { id: lease.integrationId },
      select: { firstPartyInsightsCapability: true },
    });
    const runProfileMedia =
      lease.capabilityClass !== InstagramSyncCapabilityClass.AUDIENCE;
    const runAudience =
      lease.capabilityClass !==
        InstagramSyncCapabilityClass.PROFILE_MEDIA_PERFORMANCE &&
      integration.firstPartyInsightsCapability === InstagramCapabilityState.YES;

    if (runProfileMedia) {
      await this.captureProfile(lease);
      await this.media.execute({
        brandProfileId: lease.brandProfileId,
        integrationId: lease.integrationId,
        providerAccountId: lease.providerAccountId,
        authorizationGeneration: lease.authorizationGeneration,
        windowEnd: lease.windowEnd,
      });
    }
    if (runAudience) await this.captureAudience(lease);

    await this.foundations.execute({
      brandId: lease.brandProfileId,
      providerAccountId: lease.providerAccountId,
      authorizationGeneration: lease.authorizationGeneration,
      executionCutoff,
      windowEnd: lease.windowEnd,
    });
    const c2Media = await this.prisma.dataExtractionEvidenceItem.findFirst({
      where: {
        brandId: lease.brandProfileId,
        capabilityId: "instagram.media_inventory",
        normalizationContractVersion:
          "instagram-c2-deterministic-foundations-v1",
        boundedPayload: {
          path: ["window", "executionCutoff"],
          equals: executionCutoff.toISOString(),
        },
      },
      orderBy: { evidenceRef: "asc" },
    });
    if (c2Media) {
      await this.semantics.execute({
        brandProfileId: lease.brandProfileId,
        providerAccountId: lease.providerAccountId,
        authorizationGeneration: lease.authorizationGeneration,
        windowEnd: lease.windowEnd,
        executionCutoff,
        c2EvidenceRef: c2Media.evidenceRef,
      });
    }
    const outcomes = await this.c4.execute({
      kind: "INSTAGRAM_C4_INPUT_V1",
      brandProfileId: lease.brandProfileId,
      integrationId: lease.integrationId,
      providerAccountId: lease.providerAccountId,
      authorizationGeneration: lease.authorizationGeneration,
      windowEnd: lease.windowEnd.toISOString(),
      triggerIdempotencyKey: executionIdentity(lease),
      correlationRef: `instagram-c1:${lease.jobId}:${lease.requestIdentity}`,
    });
    if (outcomes.some((item) => item.status !== "COMPLETED")) {
      throw new Error("INSTAGRAM_C4_PIPELINE_INCOMPLETE");
    }
    const processorIds = outcomes.map((item) => item.processorExecutionId);
    const generations = await this.prisma.intelligenceObjectGeneration.findMany(
      {
        where: { processorExecutionId: { in: processorIds } },
        select: { id: true },
        orderBy: { id: "asc" },
      },
    );
    return { generationIds: generations.map((row) => row.id) };
  }

  private async captureProfile(lease: InstagramSyncLease) {
    const read = await this.reads.execute({
      ...readIdentity(lease),
      command: { kind: "PROFILE" },
    });
    const profile = read.result as InstagramProfileTruth;
    const base = writerBase(lease, "profile");
    if (profile.availability === "UNAVAILABLE") {
      await this.writer.write({
        ...base,
        resourceType: "INSTAGRAM_ACCOUNT",
        capabilityId: "instagram.account_profile",
        availability: "UNAVAILABLE",
        retryability: "RETRYABLE",
        reasonCodes: ["C1_PROFILE_UNAVAILABLE"],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "UNAVAILABLE",
          failureCategories: ["PROFILE"],
          detailCodes: ["PROVIDER_UNAVAILABLE"],
        },
        artifacts: [],
        evidence: [],
      });
      return;
    }
    await this.writer.write({
      ...base,
      capturedAt: lease.windowEnd.toISOString(),
      resourceType: "INSTAGRAM_ACCOUNT",
      capabilityId: "instagram.account_profile",
      availability: profile.availability,
      retryability: "NOT_APPLICABLE",
      reasonCodes: [],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: [],
      evidence: [
        {
          evidenceKey: "profile",
          payload: profile,
          freshness: "CURRENT",
          representativeness: "PERSISTENT_BRAND_LEVEL",
          semanticObservationKey: `instagram-profile:${lease.providerAccountId}`,
        },
      ],
    });
  }

  private async captureAudience(lease: InstagramSyncLease) {
    for (const population of POPULATIONS) {
      const results: InstagramAudienceInsightsTruth[] = [];
      for (const breakdown of BREAKDOWNS) {
        const read = await this.reads.execute({
          ...readIdentity(lease),
          command: {
            kind: "AUDIENCE_INSIGHTS",
            population,
            breakdown,
            timeframe: "THIS_MONTH",
          },
        });
        results.push(read.result as InstagramAudienceInsightsTruth);
      }
      const available = results.filter(
        (result) => result.availability !== "UNAVAILABLE",
      );
      const capabilityId =
        population === "FOLLOWERS"
          ? "instagram.audience_followers"
          : "instagram.audience_engaged";
      const base = writerBase(lease, `audience:${population}`);
      await this.writer.write(
        available.length
          ? {
              ...base,
              capturedAt: lease.windowEnd.toISOString(),
              resourceType: "INSTAGRAM_ACCOUNT",
              capabilityId,
              availability:
                available.length === results.length ? "AVAILABLE" : "PARTIAL",
              retryability: "NOT_APPLICABLE",
              reasonCodes: [],
              coverage: "SINGLE_RESOURCE",
              acquisitionQuality: {
                state:
                  available.length === results.length ? "COMPLETE" : "PARTIAL",
                failureCategories: [],
                detailCodes: [],
              },
              artifacts: [],
              evidence: results.map((result) => ({
                evidenceKey: result.breakdown,
                payload: result,
                freshness: "CURRENT" as const,
                representativeness: "PERSISTENT_BRAND_LEVEL" as const,
                semanticObservationKey: `instagram-audience:${population}:${result.breakdown}`,
              })),
            }
          : {
              ...base,
              resourceType: "INSTAGRAM_ACCOUNT",
              capabilityId,
              availability: "UNAVAILABLE",
              retryability: "RETRYABLE",
              reasonCodes: ["C1_AUDIENCE_UNAVAILABLE"],
              coverage: "SINGLE_RESOURCE",
              acquisitionQuality: {
                state: "UNAVAILABLE",
                failureCategories: ["AUDIENCE"],
                detailCodes: ["PROVIDER_UNAVAILABLE"],
              },
              artifacts: [],
              evidence: [],
            },
      );
    }
  }
}

function readIdentity(lease: InstagramSyncLease) {
  return {
    brandProfileId: lease.brandProfileId,
    integrationId: lease.integrationId,
    expectedProviderAccountId: lease.providerAccountId,
    expectedAuthorizationGeneration: lease.authorizationGeneration,
  };
}

function writerBase(lease: InstagramSyncLease, lane: string) {
  const key = createHash("sha256")
    .update(`${executionIdentity(lease)}:${lane}`)
    .digest("hex");
  return {
    brandId: lease.brandProfileId,
    providerAccountId: lease.providerAccountId,
    authorizationGeneration: lease.authorizationGeneration,
    requestKey: `c1:${key}`,
    providerExecutionRef: `provider-execution:instagram:c1:${key}`,
    normalizationContractVersion:
      lane === "profile" ? PROFILE_NORMALIZATION : AUDIENCE_NORMALIZATION,
    startedAt: lease.windowEnd.toISOString(),
    completedAt: lease.windowEnd.toISOString(),
  } as const;
}

function executionIdentity(lease: InstagramSyncLease): string {
  return lease.requestIdentity;
}

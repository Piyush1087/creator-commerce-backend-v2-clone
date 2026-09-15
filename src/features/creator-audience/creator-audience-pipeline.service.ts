import { Inject, Injectable, Optional } from "@nestjs/common";
import { AudienceV1Pipeline } from "../creator-audience-v1/creator-audience-v1.pipeline";
import { createHash } from "node:crypto";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";

import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramAudienceBreakdown,
  type InstagramAudienceInsightsTruth,
  type InstagramAudiencePopulation,
  type InstagramIntelligenceProviderReadClient,
} from "../instagram/instagram-intelligence-provider.types";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import {
  normalizeCreatorAudience,
  type CreatorAudienceAcquisition,
} from "./creator-audience-normalizer";
import {
  CreatorAudienceRepository,
  type CreatorAudiencePersistenceIdentity,
} from "./creator-audience.repository";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import {
  CREATOR_AUDIENCE_COMPONENT_PATHS,
  CREATOR_AUDIENCE_REGISTRY_KEY,
} from "./creator-audience-runtime.contract";

const POPULATIONS: readonly InstagramAudiencePopulation[] = [
  "FOLLOWERS",
  "ENGAGED_AUDIENCE",
];
const BREAKDOWNS: readonly InstagramAudienceBreakdown[] = [
  "AGE",
  "GENDER",
  "COUNTRY",
  "CITY",
];

@Injectable()
export class CreatorAudiencePipelineService {
  constructor(
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly repository: CreatorAudienceRepository,
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
    @Inject(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    private readonly provider: InstagramIntelligenceProviderReadClient,
    @Optional() private readonly audienceV1?: AudienceV1Pipeline,
  ) {}

  async execute(input: {
    actor: CreatorWorkspaceActorContext;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    capturedAt?: Date;
    requestIdentity?: string;
  }) {
    const capturedAt = input.capturedAt ?? new Date();
    const identity: CreatorAudiencePersistenceIdentity = {
      creatorProfileId: input.actor.subjectCreatorProfileId,
      creatorWorkspaceId: input.actor.workspaceId,
      integrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      requestIdentity:
        input.requestIdentity ??
        creatorAudienceRequestIdentity({
          ...input,
          capturedAt,
        }),
    };
    const projected = await this.fence.project(input.actor);
    if (
      !projected.authorized ||
      projected.integrationId !== identity.integrationId ||
      projected.providerAccountId !== identity.providerAccountId ||
      projected.authorizationGeneration !== identity.authorizationGeneration
    ) {
      throw new Error("CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED");
    }
    const replay = await this.repository.replay(identity);
    if (replay) {
      await this.updateAudienceV1(input.actor);
      return { value: replay, reused: true, generationIds: [] };
    }
    const credential = await this.fence.acquire(input.actor, identity);
    await this.repository.begin(identity);
    let profile;
    const results: InstagramAudienceInsightsTruth[] = [];
    try {
      profile = await this.provider.readProfile(credential);
      for (const population of POPULATIONS) {
        for (const breakdown of BREAKDOWNS) {
          results.push(
            await this.provider.readAudienceInsights(
              credential,
              population,
              breakdown,
              "THIS_MONTH",
            ),
          );
        }
      }
    } catch (error) {
      await this.repository.fail(identity);
      throw error;
    }
    const acquisition: CreatorAudienceAcquisition = {
      capturedAt: capturedAt.toISOString(),
      followerCount: profile.followersCount,
      results,
    };
    const value = normalizeCreatorAudience({
      acquisition,
      role: "OWNER",
      now: capturedAt,
    });
    if (value.status === "UNAVAILABLE") {
      await this.repository.fail(identity);
      const previous = await this.repository.readCurrent(identity);
      return {
        value: previous
          ? {
              ...previous,
              sourceStatus: "PROVIDER_FAILURE" as const,
              processingState: "FAILED" as const,
              currentPreserved: true,
            }
          : value,
        reused: false,
        generationIds: [],
      };
    }
    let manifest;
    try {
      manifest = await this.repository.completeAcquisition({
        identity,
        acquisition,
        value,
      });
    } catch (error) {
      await this.repository.fail(identity);
      throw error;
    }
    const boundValue = {
      ...value,
      highlights: value.highlights.map((highlight) => ({
        ...highlight,
        evidence: highlight.evidence.map((support) => {
          const [population, breakdown] = support.split(":", 3);
          const providerPopulation =
            population === "ENGAGED" ? "ENGAGED_AUDIENCE" : population;
          const matched = manifest.evidence.find(
            (item) =>
              item.population === providerPopulation &&
              item.breakdown === breakdown,
          );
          if (!matched) {
            throw new Error("CREATOR_AUDIENCE_HIGHLIGHT_EVIDENCE_UNRESOLVED");
          }
          return matched.evidenceRef;
        }),
      })),
    };
    const created = await this.executions.createOrReturnOwnerScoped({
      ownerScopeId: manifest.identity.ownerScopeId,
      subjectRef: identity.creatorProfileId,
      triggerType: "CREATOR_AUDIENCE_SCHEDULED",
      triggerRef: identity.requestIdentity,
      triggerIdempotencyKey: identity.requestIdentity,
      correlationRef: identity.requestIdentity,
      requestedImpact: {
        objectSemanticId: "creator_audience",
        componentPaths: CREATOR_AUDIENCE_COMPONENT_PATHS,
      },
      processors: [
        {
          registryKey: CREATOR_AUDIENCE_REGISTRY_KEY,
          activeScope: CREATOR_AUDIENCE_COMPONENT_PATHS.map(
            (componentSemanticPath) => ({
              ownerScopeId: manifest.identity.ownerScopeId,
              subjectId: manifest.identity.creatorProfileId,
              objectSemanticId: "creator_audience",
              pathSchemeVersion: 1,
              componentSemanticPath,
            }),
          ),
          dependencyManifest: {
            kind: "CREATOR_AUDIENCE_PROCESSOR_INPUT_V1",
            value: boundValue,
          },
          evidenceManifest: manifest,
          executionIntentKey: identity.requestIdentity,
          maxAttempts: 1,
          dependencyEligible: true,
        },
      ],
    });
    const processor = created.processorExecutions[0];
    if (processor.status !== IntelligenceProcessorExecutionStatus.COMPLETED) {
      const completed = await this.worker.runExact(
        processor.id,
        `creator-audience:${identity.creatorProfileId}`,
        60_000,
      );
      if (
        completed.processorExecution.status !==
        IntelligenceProcessorExecutionStatus.COMPLETED
      ) {
        const previous =
          await this.repository.readLatestCurrentSameAccount(identity);
        if (previous) {
          return {
            value: {
              ...previous.value,
              sourceStatus: "PROVIDER_FAILURE" as const,
              processingState: "FAILED" as const,
              currentPreserved: true,
            },
            reused: false,
            generationIds: [],
          };
        }
        throw new Error("CREATOR_AUDIENCE_INTELLIGENCE_EXECUTION_FAILED");
      }
    }
    const generationIds =
      await this.repository.generationIdsForProcessorExecution(processor.id);
    await this.updateAudienceV1(input.actor);
    return {
      value: boundValue,
      reused: false,
      generationIds,
    };
  }
  private async updateAudienceV1(
    actor: CreatorWorkspaceActorContext,
  ): Promise<void> {
    // Derived failure cannot invalidate accepted source-native acquisition/current.
    // The shared worker retains failed execution truth; read-only consumers project it separately.
    if (this.audienceV1)
      await this.audienceV1.execute(actor).catch(() => undefined);
  }
}

export function creatorAudienceRequestIdentity(input: {
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  capturedAt: Date;
}): string {
  const week = new Date(input.capturedAt);
  week.setUTCHours(0, 0, 0, 0);
  week.setUTCDate(week.getUTCDate() - week.getUTCDay());
  return `creator-audience:${createHash("sha256")
    .update(
      `${input.integrationId}:${input.providerAccountId}:${input.authorizationGeneration}:${week.toISOString()}:creator-audience-v0.1`,
    )
    .digest("hex")}`;
}

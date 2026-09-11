import { Injectable } from "@nestjs/common";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceConnectionReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import { INSTAGRAM_INTELLIGENCE_V1_CONSTANTS } from "../contracts/instagram-intelligence.constants";
import {
  INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
  INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
  InstagramContentBehaviorB4ValueSchema,
} from "../runtime/instagram-content-behavior.contract";
import {
  InstagramB4ConsumerSchema,
  type InstagramB4Consumer,
} from "./instagram-b4-consumer.schema";

const lineageMetadataSchema = z
  .object({
    sourceScope: z.literal("INSTAGRAM_OWNED"),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1),
    authorizationGeneration: z.number().int().positive(),
  })
  .passthrough();

const representativeSchema = z
  .array(
    z
      .object({
        mediaType: z.literal("IMAGE"),
        resourceRef: z.string().min(1),
        captureRef: z.string().min(1),
        evidenceRefs: z.array(z.string().min(1)).min(1),
        visualObservation: z
          .object({
            description: z.string().min(1),
            visibleElements: z.array(z.string()),
            dominantColors: z.array(z.string()),
            composition: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
  )
  .length(1);

const coverageValueSchema = z
  .object({
    eligibleCount: z.literal(1),
    observedCount: z.literal(1),
    deepInspectedCount: z.literal(1),
    unavailableCount: z.number().int().nonnegative(),
    notInspectedCount: z.number().int().nonnegative(),
  })
  .strict();

@Injectable()
export class InstagramB4ConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionReader: InstagramIntelligenceConnectionReadService,
    private readonly projection: IntelligenceCurrentProjectionService,
  ) {}

  async read(
    brandProfileId: string,
    now: Date = new Date(),
  ): Promise<InstagramB4Consumer> {
    const connection = await this.connectionReader.read(brandProfileId);
    const connectionProjection = projectConnection(connection);
    const object = await this.projection.readObject({
      brandId: brandProfileId,
      subject: { type: "BRAND" },
      objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
    });
    const currentRow = await this.prisma.intelligenceCurrentComponent.findFirst(
      {
        where: {
          brandId: brandProfileId,
          subjectId: object.subjectId,
          objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
          componentSemanticPath: "$",
          lifecycle: "ACTIVE",
        },
        include: {
          currentComponentGeneration: {
            include: { objectGeneration: true },
          },
        },
      },
    );
    const latest = await this.prisma.intelligenceProcessorExecution.findFirst({
      where: {
        brandId: brandProfileId,
        subjectId: object.subjectId,
        processorId: INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const latestProcessing = projectProcessing(
      latest?.status,
      latest?.lastErrorCode,
    );

    if (
      object.objectState === "NO_CURRENT" ||
      object.assembledValue.state !== "VALUE" ||
      !currentRow ||
      !connection
    ) {
      return InstagramB4ConsumerSchema.parse({
        contractVersion: "b4-proof-1.0",
        connection: connectionProjection,
        window: null,
        contentBehavior: null,
        latestProcessing,
        settingsRecoveryPath: "/brand/settings/integrations?tab=instagram",
      });
    }

    const value = InstagramContentBehaviorB4ValueSchema.safeParse(
      object.assembledValue.value,
    );
    const metadata = lineageMetadataSchema.safeParse(
      currentRow.currentComponentGeneration.metadataPayload,
    );
    const lineageMatches =
      value.success &&
      metadata.success &&
      metadata.data.integrationId === connection.integrationId &&
      metadata.data.providerAccountId === connection.providerAccountId &&
      metadata.data.authorizationGeneration ===
        connection.authorizationGeneration &&
      object.sourceClass === "INSTAGRAM_OWNED" &&
      object.authority === "CREATOR_SHOP_DERIVED";
    if (!lineageMatches) {
      return InstagramB4ConsumerSchema.parse({
        contractVersion: "b4-proof-1.0",
        connection: connectionProjection,
        window: null,
        contentBehavior: null,
        latestProcessing: {
          state: "DEGRADED",
          reasonCode: "ACCOUNT_OR_GENERATION_LINEAGE_MISMATCH",
        },
        settingsRecoveryPath: "/brand/settings/integrations?tab=instagram",
      });
    }

    const representative = value.data.components.representative_media_refs;
    const coverage = value.data.components.coverage;
    if (
      representative.state !== "AVAILABLE" ||
      coverage.state !== "AVAILABLE"
    ) {
      throw new Error("B4 current is missing required factual components");
    }
    const media = representativeSchema.parse(representative.value)[0];
    const coverageValue = coverageValueSchema.parse(coverage.value);
    const generation = currentRow.currentComponentGeneration;
    const currentPreserved = Boolean(
      latest &&
      latest.status === IntelligenceProcessorExecutionStatus.FAILED_TERMINAL &&
      latest.id !== generation.objectGeneration.processorExecutionId &&
      latest.createdAt >= generation.createdAt,
    );
    const ageMs = Math.max(0, now.getTime() - generation.createdAt.getTime());
    const freshness =
      ageMs >
      INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.dailyFreshnessHours * 60 * 60 * 1000
        ? "STALE"
        : "CURRENT";
    const evidenceRefs = [
      ...new Set(
        object.components.flatMap((component) =>
          component.evidenceReferenceSummary.map(
            (reference) => reference.evidenceRef,
          ),
        ),
      ),
    ];

    return InstagramB4ConsumerSchema.parse({
      contractVersion: "b4-proof-1.0",
      connection: connectionProjection,
      window: value.data.window,
      contentBehavior: {
        semanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
        objectContractVersion: "1.0",
        outputContractVersion: "1.0",
        objectState: "PARTIAL_CURRENT",
        readiness: "PARTIAL",
        freshness,
        authority: "CREATOR_SHOP_DERIVED",
        sourceClass: "INSTAGRAM_OWNED",
        protection: "UNPROTECTED",
        generatedAt: generation.createdAt.toISOString(),
        currentPreserved,
        latestProcessing,
        observedImage: {
          format: "IMAGE",
          ...media.visualObservation,
        },
        coverage: {
          eligibleCount: coverageValue.eligibleCount,
          observedCount: coverageValue.observedCount,
          deepInspectedCount: coverageValue.deepInspectedCount,
        },
        evidence: { count: evidenceRefs.length, refs: evidenceRefs },
        limitation: "Not enough posts to identify patterns or learnings",
      },
      latestProcessing,
      settingsRecoveryPath: "/brand/settings/integrations?tab=instagram",
    });
  }
}

function projectConnection(
  connection: Awaited<
    ReturnType<InstagramIntelligenceConnectionReadService["read"]>
  >,
): InstagramB4Consumer["connection"] {
  if (!connection) return { state: "NOT_CONNECTED", account: null };
  const account = connection.providerAccountId
    ? {
        providerAccountId: connection.providerAccountId,
        handle: connection.handle,
      }
    : null;
  if (
    connection.isActive &&
    connection.status === "CONNECTED" &&
    connection.authorizationHealth === "CONNECTED_FULL" &&
    account
  ) {
    return { state: "CONNECTED", account };
  }
  if (
    connection.humanActionRequired ||
    connection.authorizationHealth === "NEEDS_REVALIDATION"
  ) {
    return { state: "REAUTH_REQUIRED", account };
  }
  return { state: "DEGRADED", account };
}

function projectProcessing(
  status?: IntelligenceProcessorExecutionStatus,
  errorCode?: string | null,
): InstagramB4Consumer["latestProcessing"] {
  switch (status) {
    case IntelligenceProcessorExecutionStatus.COMPLETED:
      return { state: "HEALTHY", reasonCode: null };
    case IntelligenceProcessorExecutionStatus.FAILED_TERMINAL:
    case IntelligenceProcessorExecutionStatus.CANCELLED:
      return {
        state: "DEGRADED",
        reasonCode: errorCode ?? "CURRENT_PRESERVED_AFTER_FAILURE",
      };
    case IntelligenceProcessorExecutionStatus.QUEUED:
    case IntelligenceProcessorExecutionStatus.RUNNING:
    case IntelligenceProcessorExecutionStatus.WAITING_FOR_DEPENDENCY:
      return { state: "IN_PROGRESS", reasonCode: null };
    default:
      return { state: "NOT_RUN", reasonCode: null };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { BrandRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceConnectionReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { IntelligenceCurrentProjectionService } from "../../brand-intelligence/projection/intelligence-current-projection.service";
import {
  InstagramIntelligenceObjectSchema,
  InstagramMediaObservationSchema,
  InstagramWorkspaceConsumerSchema,
  type InstagramIntelligenceObject,
} from "../contracts/instagram-intelligence.schemas";
import { INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY } from "../contracts/instagram-intelligence.registry";
import { INSTAGRAM_C4_PROCESSORS } from "../runtime/instagram-c4.contract";
import {
  InstagramMediaDetailConsumerSchema,
  type InstagramB4Consumer,
  type InstagramMediaDetailConsumer,
} from "./instagram-b4-consumer.schema";

const DAY_MS = 86_400_000;
type Connection = Awaited<
  ReturnType<InstagramIntelligenceConnectionReadService["read"]>
>;
type Observation = ReturnType<typeof InstagramMediaObservationSchema.parse>;

@Injectable()
export class InstagramB4ConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectionReader: InstagramIntelligenceConnectionReadService,
    private readonly projection: IntelligenceCurrentProjectionService,
  ) {}

  async read(
    brandProfileId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<InstagramB4Consumer> {
    const connection = await this.connectionReader.read(brandProfileId);
    const window = {
      start: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      end: now.toISOString(),
      days: 30 as const,
    };
    const [role, projections, latestExecutions, observations] =
      await Promise.all([
        this.role(brandProfileId, userId),
        Promise.all(
          INSTAGRAM_C4_PROCESSORS.map((definition) =>
            this.projection.readObject({
              brandId: brandProfileId,
              subject: { type: "BRAND" },
              objectSemanticId: definition.objectId,
            }),
          ),
        ),
        this.prisma.intelligenceProcessorExecution.findMany({
          where: {
            brandId: brandProfileId,
            processorId: {
              in: INSTAGRAM_C4_PROCESSORS.map((item) => item.processorId),
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.mediaObservations(brandProfileId, connection),
      ]);

    const objects = projections.map((projection, index) => {
      if (projection.assembledValue.state === "VALUE") {
        const parsed = InstagramIntelligenceObjectSchema.safeParse(
          projection.assembledValue.value,
        );
        if (parsed.success) return parsed.data;
      }
      return noCurrentObject(INSTAGRAM_C4_PROCESSORS[index].objectId, window);
    });
    const representativeMedia = observations.slice(0, 8).map((item) => ({
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      publishedAt: item.publishedAt,
      permalink: item.permalink,
      likelyCollab: item.likelyCollab,
      metricHighlights: item.metrics.slice(0, 4),
      evidenceRefs: item.evidenceRefs,
    }));
    const inventoryEligible = observations.length;
    const metricsObserved = observations.filter(
      (item) => item.metrics.length > 0,
    ).length;
    const deepObserved = observations.filter(
      (item) => item.inspection.selectedForDeepAnalysis,
    ).length;
    const latestByProcessor = new Map<
      string,
      (typeof latestExecutions)[number]
    >();
    for (const execution of latestExecutions) {
      if (!latestByProcessor.has(execution.processorId)) {
        latestByProcessor.set(execution.processorId, execution);
      }
    }
    const latest = [...latestByProcessor.values()];
    const hasRunning = latest.some((item) =>
      ["QUEUED", "RUNNING", "WAITING_FOR_DEPENDENCY"].includes(item.status),
    );
    const failed = latest.filter((item) =>
      ["FAILED_TERMINAL", "CANCELLED"].includes(item.status),
    );
    const successes = latest.filter((item) => item.status === "COMPLETED");

    return InstagramWorkspaceConsumerSchema.parse({
      contractVersion: "1.0",
      connection: projectConnection(connection),
      window,
      accountFacts: [],
      accountPerformance:
        objects.find(
          (item) => item.semanticId === "instagram_organic_performance_profile",
        )?.results ?? [],
      objects,
      representativeMedia,
      coverage: {
        inventory: coverage(inventoryEligible, inventoryEligible),
        metrics: coverage(inventoryEligible, metricsObserved),
        lightSemantic: coverage(inventoryEligible, observations.length),
        deepMultimodal: coverage(inventoryEligible, deepObserved),
        audience: coverage(0, 0, "AUDIENCE_NOT_SUPPORTED"),
      },
      sync: {
        state: hasRunning ? "REFRESHING" : failed.length ? "BLOCKED" : "IDLE",
        lastAttemptAt: latest[0]?.createdAt.toISOString() ?? null,
        lastSuccessAt: successes[0]?.completedAt?.toISOString() ?? null,
        nextDueAt: null,
        currentPreserved:
          failed.length > 0 &&
          objects.some((item) => item.state !== "NO_CURRENT"),
        reasonCodes: failed.length ? ["CURRENT_PRESERVED_AFTER_FAILURE"] : [],
      },
      actions: {
        manualRefresh:
          role === BrandRole.FINANCE_ADMIN
            ? { state: "DENIED", reasonCode: "REFRESH_NOT_AUTHORIZED" }
            : { state: "ALLOWED", cooldownEndsAt: null },
        settingsRecoveryPath: "/brand/settings/integrations?tab=instagram",
      },
    });
  }

  async readMedia(
    brandProfileId: string,
    mediaId: string,
  ): Promise<InstagramMediaDetailConsumer> {
    const connection = await this.connectionReader.read(brandProfileId);
    const observations = await this.mediaObservations(
      brandProfileId,
      connection,
    );
    const item = observations.find(
      (candidate) => candidate.mediaId === mediaId,
    );
    if (!item) throw new NotFoundException("Instagram media not found");
    return InstagramMediaDetailConsumerSchema.parse({
      contractVersion: "1.0",
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      publishedAt: item.publishedAt,
      permalink: item.permalink,
      caption: item.caption,
      hashtags: item.hashtags,
      mentions: item.mentions,
      themes: item.themes,
      captionPatterns: item.captionPatterns,
      creativeStructures: item.creativeStructures,
      visualExecutions: item.visualExecutions,
      creatorPresence: item.creatorPresence,
      offeringPresence: item.offeringPresence,
      likelyCollab: item.likelyCollab,
      metrics: item.metrics,
      inspection: item.inspection,
      coverage: {
        sourceEvidenceCount: item.evidenceRefs.length,
        limitations: item.inspection.reasonCodes,
      },
      evidence: { refs: item.evidenceRefs, capturedAt: item.capturedAt },
    });
  }

  private async role(
    brandProfileId: string,
    userId: string,
  ): Promise<BrandRole> {
    const membership = await this.prisma.brandTeamMember.findFirst({
      where: { brandProfileId, userId, isActive: true },
      select: { role: true },
    });
    if (!membership) {
      throw new NotFoundException("Active Brand membership not found");
    }
    return membership.role;
  }

  private async mediaObservations(
    brandProfileId: string,
    connection: Connection,
  ): Promise<Observation[]> {
    if (!connection?.providerAccountId) return [];
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
        capture: {
          status: "COMPLETED",
          providerIntegrationId: connection.integrationId,
          providerAccountId: connection.providerAccountId,
          authorizationGeneration: connection.authorizationGeneration,
        },
      },
      include: { capture: { select: { capturedAt: true } } },
      orderBy: [{ createdAt: "desc" }, { evidenceRef: "asc" }],
    });
    const unique = new Map<string, Observation>();
    const derived = new Map<
      string,
      { core?: Record<string, unknown>; fields: Record<string, unknown> }
    >();
    for (const row of rows) {
      const parsed = InstagramMediaObservationSchema.safeParse(
        row.boundedPayload,
      );
      if (
        parsed.success &&
        parsed.data.brandProfileId === brandProfileId &&
        parsed.data.providerAccountId === connection.providerAccountId &&
        parsed.data.authorizationGeneration ===
          connection.authorizationGeneration &&
        row.capture.capturedAt &&
        !unique.has(parsed.data.mediaId)
      ) {
        unique.set(parsed.data.mediaId, parsed.data);
        continue;
      }
      const wrapper = record(row.boundedPayload);
      const semanticPayload = record(wrapper.semanticPayload);
      if (
        wrapper.resultClass !== "MODEL_DERIVED_RESULT" ||
        wrapper.sourceScope !== "INSTAGRAM_OWNED" ||
        wrapper.brandProfileId !== brandProfileId ||
        wrapper.providerAccountId !== connection.providerAccountId ||
        wrapper.authorizationGeneration !==
          connection.authorizationGeneration ||
        typeof wrapper.mediaId !== "string" ||
        typeof wrapper.executionIdentity !== "string"
      ) {
        continue;
      }
      const key = `${wrapper.mediaId}:${wrapper.executionIdentity}`;
      const group = derived.get(key) ?? { fields: {} };
      if (row.capabilityId === "instagram.caption_context") {
        group.core = record(semanticPayload.observationCore);
        Object.assign(group.fields, {
          themes: semanticPayload.themes,
          captionPatterns: semanticPayload.captionPatterns,
          creativeStructures: semanticPayload.creativeStructures,
        });
      } else if (row.capabilityId === "instagram.media_visual_observations") {
        Object.assign(group.fields, {
          visualExecutions: semanticPayload.visualExecutions,
          inspection: semanticPayload.inspection,
        });
      } else if (row.capabilityId === "instagram.media_creator_signals") {
        Object.assign(group.fields, {
          creatorRoleSignals: semanticPayload.creatorRoleSignals,
          creatorPresence: semanticPayload.creatorPresence,
          likelyCollab: semanticPayload.likelyCollab,
        });
      } else if (row.capabilityId === "instagram.media_offering_signals") {
        group.fields.offeringPresence = semanticPayload.offeringPresence;
      }
      derived.set(key, group);
    }
    for (const group of derived.values()) {
      const parsed = InstagramMediaObservationSchema.safeParse({
        ...group.core,
        ...group.fields,
      });
      if (parsed.success && !unique.has(parsed.data.mediaId)) {
        unique.set(parsed.data.mediaId, parsed.data);
      }
    }
    return [...unique.values()];
  }
}

function noCurrentObject(
  objectId: (typeof INSTAGRAM_C4_PROCESSORS)[number]["objectId"],
  window: { start: string; end: string; days: 30 },
): InstagramIntelligenceObject {
  const definition = INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY.find(
    (item) => item.semanticId === objectId,
  );
  if (!definition) throw new Error("Instagram Object registry mismatch");
  return InstagramIntelligenceObjectSchema.parse({
    semanticId: objectId,
    objectContractVersion: "1.0",
    outputContractVersion: "1.0",
    sourceScope: "INSTAGRAM_OWNED",
    state: "NO_CURRENT",
    readiness: "NOT_READY",
    freshness: "UNKNOWN",
    currentPreserved: false,
    generatedAt: null,
    window,
    results: [],
    signals: [],
    learnings: [],
    components: Object.fromEntries(
      definition.components.map((component) => [
        component,
        { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" },
      ]),
    ),
    coverage: {
      state: "UNAVAILABLE",
      eligibleCount: 0,
      observedCount: 0,
      coveragePercent: null,
      reasonCodes: ["INSUFFICIENT_EVIDENCE"],
    },
    evidenceRefs: [],
  });
}

function coverage(
  eligibleCount: number,
  observedCount: number,
  reason = "INSUFFICIENT_EVIDENCE",
) {
  return {
    state:
      eligibleCount === 0
        ? "UNAVAILABLE"
        : observedCount === eligibleCount
          ? "COMPLETE"
          : "PARTIAL",
    eligibleCount,
    observedCount,
    coveragePercent: eligibleCount
      ? (observedCount / eligibleCount) * 100
      : null,
    reasonCodes:
      observedCount === eligibleCount && eligibleCount > 0 ? [] : [reason],
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function projectConnection(connection: Connection) {
  const base = {
    providerAccountId: connection?.providerAccountId ?? null,
    handle: connection?.handle ?? null,
  };
  if (!connection) {
    return {
      ...base,
      state: "NOT_CONNECTED",
      reasonCodes: ["CONNECTION_NOT_CONNECTED"],
    };
  }
  if (connection.humanActionRequired) {
    return {
      ...base,
      state: "REAUTH_REQUIRED",
      reasonCodes: ["REAUTH_REQUIRED"],
    };
  }
  if (!connection.isActive) {
    return {
      ...base,
      state: "DISCONNECTED",
      reasonCodes: ["CONNECTION_NOT_CONNECTED"],
    };
  }
  if (connection.authorizationHealth === "PARTIALLY_CONNECTED") {
    return {
      ...base,
      state: "PARTIAL_CAPABILITY",
      reasonCodes: ["PARTIAL_CAPABILITY"],
    };
  }
  if (connection.authorizationHealth !== "CONNECTED_FULL") {
    return {
      ...base,
      state: "AUTHORIZATION_DEGRADED",
      reasonCodes: ["AUTHORIZATION_DEGRADED"],
    };
  }
  return { ...base, state: "CONNECTED", reasonCodes: [] };
}

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  asBrandId,
  asEvidenceRef,
  asSemanticObservationKey,
} from "../../data-extraction/evidence/domain/evidence-identities";
import { persistenceError } from "../../data-extraction/evidence/persistence/evidence-persistence.errors";
import { createDataExtractionRepositorySet } from "../../data-extraction/evidence/persistence/prisma-evidence-repositories";
import { INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION } from "../media/instagram-b3a-visual-observation";
import { INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION } from "../../instagram/media/video/instagram-video.types";
import { INSTAGRAM_B3B_NORMALIZATION_VERSION } from "../media/instagram-b3b-media-completion.service";
import { INSTAGRAM_C2_CALCULATION_CONTRACT } from "../foundations/instagram-c2-exact-arithmetic";
import { InstagramMediaObservationSchema } from "../contracts/instagram-intelligence.schemas";
import {
  InstagramC3SemanticModelPort,
  type InstagramC3ModelContext,
} from "./instagram-c3-semantic-model";
import {
  assertCaptionIsData,
  digestCanonical,
  extractCaptionTokens,
  finalizeInstagramC3,
  INSTAGRAM_C3_CONTRACT_VERSION,
  INSTAGRAM_C3_NORMALIZATION_VERSION,
  INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
  INSTAGRAM_C3_PROMPT_PROFILE_VERSION,
  INSTAGRAM_C3_VIDEO_FRAME_INPUT_PROFILE_VERSION,
  InstagramC3SemanticError,
  normalizeName,
} from "./instagram-c3-semantics";

const DAY_MS = 86_400_000;
const OWNER_CAPABILITIES = [
  "instagram.caption_context",
  "instagram.media_visual_observations",
  "instagram.media_creator_signals",
  "instagram.media_offering_signals",
] as const;

type C3EvidenceRow = Readonly<{
  evidenceRef: string;
  resourceRef: string;
  captureRef: string;
  contentHash: string;
  boundedPayload: Prisma.JsonValue;
  capture: Readonly<{ capturedAt: Date | null }>;
}>;

export type InstagramC3ExecutionRequest = Readonly<{
  brandProfileId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  windowEnd: Date;
  executionCutoff: Date;
  c2EvidenceRef: string;
}>;

export type InstagramC3ExecutionResult = Readonly<{
  executionState: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  eligibleCount: number;
  successfulCount: number;
  failedCount: number;
  media: readonly Readonly<{
    mediaId: string;
    state: "AVAILABLE" | "UNAVAILABLE";
    executionIdentity: string;
    observation?: ReturnType<typeof finalizeInstagramC3>["observation"];
    derivedEvidenceRefs: readonly string[];
    reasonCode?: string;
    replayed: boolean;
  }>[];
}>;

@Injectable()
export class InstagramC3SemanticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: InstagramC3SemanticModelPort,
  ) {}

  async replayCompleted(input: {
    brandProfileId: string;
    mediaId: string;
    executionIdentity: string;
  }) {
    if (!input.brandProfileId || !input.mediaId || !input.executionIdentity)
      throw new InstagramC3SemanticError("INVALID_REPLAY_IDENTITY");
    return this.loadReplay(
      input.brandProfileId,
      input.mediaId,
      input.executionIdentity,
    );
  }

  async execute(
    request: InstagramC3ExecutionRequest,
  ): Promise<InstagramC3ExecutionResult> {
    validateRequest(request);
    const windowStart = new Date(request.windowEnd.getTime() - 30 * DAY_MS);
    const integration = await this.prisma.brandIntegration.findMany({
      where: { brandProfileId: request.brandProfileId, provider: "INSTAGRAM" },
      select: {
        providerAccountId: true,
        authorizationGeneration: true,
        isActive: true,
        status: true,
      },
    });
    if (
      integration.length !== 1 ||
      !integration[0]?.isActive ||
      !["CONNECTED", "PARTIALLY_CONNECTED"].includes(integration[0].status) ||
      integration[0].providerAccountId !== request.providerAccountId ||
      integration[0].authorizationGeneration !== request.authorizationGeneration
    ) {
      throw new InstagramC3SemanticError("SOURCE_SCOPE_MISMATCH");
    }

    const c2 = await this.loadC2(request, windowStart);
    const lightRows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: request.brandProfileId,
        capabilityId: "instagram.media_inventory",
        normalizationContractVersion: INSTAGRAM_B3B_NORMALIZATION_VERSION,
        capture: {
          status: "COMPLETED",
          capturedAt: { lte: request.executionCutoff },
          providerAccountId: request.providerAccountId,
          authorizationGeneration: request.authorizationGeneration,
        },
        resource: {
          sourceClass: "INSTAGRAM_OWNED",
          resourceType: "INSTAGRAM_MEDIA",
          providerAccountId: request.providerAccountId,
        },
      },
      include: { capture: true, resource: true },
      orderBy: [{ evidenceRef: "asc" }],
    });
    const eligibleCandidates = lightRows.filter((row) => {
      const payload = record(row.boundedPayload);
      if (typeof payload.providerMediaId !== "string") return false;
      const published = field(payload.publishedTimestamp);
      const value =
        typeof published.value === "string" ? Date.parse(published.value) : NaN;
      return (
        Number.isFinite(value) &&
        value >= windowStart.getTime() &&
        value <= request.windowEnd.getTime()
      );
    });
    const eligibleByMedia = new Map<string, (typeof lightRows)[number]>();
    for (const row of eligibleCandidates) {
      const mediaId = record(row.boundedPayload).providerMediaId as string;
      const prior = eligibleByMedia.get(mediaId);
      if (
        !prior ||
        row.capture.capturedAt! > prior.capture.capturedAt! ||
        (row.capture.capturedAt!.getTime() ===
          prior.capture.capturedAt!.getTime() &&
          row.evidenceRef.localeCompare(prior.evidenceRef) > 0)
      ) {
        eligibleByMedia.set(mediaId, row);
      }
    }
    const eligible = [...eligibleByMedia.values()].sort((a, b) =>
      (record(a.boundedPayload).providerMediaId as string).localeCompare(
        record(b.boundedPayload).providerMediaId as string,
      ),
    );
    for (const light of eligible) assertC2SupportsMedia(c2, light);
    const offerings = await this.prisma.offering.findMany({
      where: { brandProfileId: request.brandProfileId, isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    const offeringSnapshot = offerings.map((item) => ({
      id: item.id,
      normalizedName: normalizeName(item.name),
    }));
    const output: Array<InstagramC3ExecutionResult["media"][number]> = [];
    for (const light of eligible) {
      const payload = record(light.boundedPayload);
      const mediaId = payload.providerMediaId as string;
      const visuals = await this.loadVisuals(request, light.resourceRef);
      const context = buildContext(payload, light.evidenceRef, visuals);
      const manifest = {
        contractVersion: INSTAGRAM_C3_CONTRACT_VERSION,
        observationProfileVersion: INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
        promptProfileVersion: this.model.modelProfileVersion,
        semanticInputProfileVersion: context.inspection.reasonCodes.includes(
          "SAMPLED_FRAMES_ARE_NOT_COMPLETE_VIDEO",
        )
          ? INSTAGRAM_C3_VIDEO_FRAME_INPUT_PROFILE_VERSION
          : INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
        modelIdentity: this.model.modelIdentity,
        brandProfileId: request.brandProfileId,
        providerAccountId: request.providerAccountId,
        authorizationGeneration: request.authorizationGeneration,
        mediaId,
        resourceRef: light.resourceRef,
        window: {
          start: windowStart.toISOString(),
          end: request.windowEnd.toISOString(),
          executionCutoff: request.executionCutoff.toISOString(),
        },
        inspection: context.inspection,
        sourceEvidence: [
          { evidenceRef: light.evidenceRef, contentHash: light.contentHash },
          ...visuals.map((visual) => ({
            evidenceRef: visual.evidenceRef,
            contentHash: visual.contentHash,
          })),
        ].sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef)),
        c2: { evidenceRef: c2.evidenceRef, contentHash: c2.contentHash },
        offeringSnapshotHash: digestCanonical(offeringSnapshot),
      } as const;
      const executionIdentity = digestCanonical(manifest);
      const existing = await this.loadReplay(
        request.brandProfileId,
        mediaId,
        executionIdentity,
      );
      if (existing) {
        output.push({
          mediaId,
          state: "AVAILABLE",
          executionIdentity,
          observation: existing.observation,
          derivedEvidenceRefs: existing.refs,
          replayed: true,
        });
        continue;
      }
      try {
        if (context.caption.text) assertCaptionIsData(context.caption.text);
        const modelContext = buildModelContext(
          mediaId,
          payload,
          context,
          offeringSnapshot,
        );
        const candidate = await this.model.analyze({
          executionIdentity,
          context: modelContext,
          evidenceRefs: manifest.sourceEvidence.map((item) => item.evidenceRef),
        });
        const finalized = finalizeInstagramC3({
          brandProfileId: request.brandProfileId,
          providerAccountId: request.providerAccountId,
          authorizationGeneration: request.authorizationGeneration,
          mediaId,
          resourceRef: light.resourceRef,
          captureRef: light.captureRef,
          capturedAt: light.capture.capturedAt!.toISOString(),
          publishedAt: sourceValue(payload.publishedTimestamp),
          mediaType: normalizeMediaType(payload.mediaType),
          permalink: { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" },
          context,
          candidate,
          metrics: projectC2Metrics(c2, mediaId),
          c2EvidenceRef: c2.evidenceRef,
          modelIdentity: this.model.modelIdentity,
          offerings: offeringSnapshot,
        });
        const refs = await this.persist(
          request,
          light,
          visuals,
          c2,
          executionIdentity,
          manifest,
          finalized,
        );
        output.push({
          mediaId,
          state: "AVAILABLE",
          executionIdentity,
          observation: finalized.observation,
          derivedEvidenceRefs: refs,
          replayed: false,
        });
      } catch (error) {
        output.push({
          mediaId,
          state: "UNAVAILABLE",
          executionIdentity,
          derivedEvidenceRefs: [],
          reasonCode: safeErrorCode(error),
          replayed: false,
        });
      }
    }
    const successfulCount = output.filter(
      (item) => item.state === "AVAILABLE",
    ).length;
    return {
      executionState:
        successfulCount === output.length && output.length > 0
          ? "COMPLETE"
          : successfulCount > 0
            ? "PARTIAL"
            : "UNAVAILABLE",
      eligibleCount: output.length,
      successfulCount,
      failedCount: output.length - successfulCount,
      media: output,
    };
  }

  private async loadC2(
    request: InstagramC3ExecutionRequest,
    windowStart: Date,
  ) {
    const row = await this.prisma.dataExtractionEvidenceItem.findUnique({
      where: { evidenceRef: request.c2EvidenceRef },
      include: { capture: true, resource: true },
    });
    const payload = record(row?.boundedPayload);
    const window = record(payload.window);
    if (
      !row ||
      row.brandId !== request.brandProfileId ||
      row.capabilityId !== "instagram.media_inventory" ||
      row.normalizationContractVersion !== INSTAGRAM_C2_CALCULATION_CONTRACT ||
      row.resource.sourceClass !== "INSTAGRAM_OWNED" ||
      row.capture.status !== "COMPLETED" ||
      row.capture.providerAccountId !== request.providerAccountId ||
      !Array.isArray(payload.authorizationGenerationLineage) ||
      !payload.authorizationGenerationLineage.includes(
        request.authorizationGeneration,
      ) ||
      window.start !== windowStart.toISOString() ||
      window.end !== request.windowEnd.toISOString() ||
      window.executionCutoff !== request.executionCutoff.toISOString()
    ) {
      throw new InstagramC3SemanticError("C2_IDENTITY_MISMATCH");
    }
    return row;
  }

  private async loadVisuals(
    request: InstagramC3ExecutionRequest,
    resourceRef: string,
  ) {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: request.brandProfileId,
        resourceRef,
        capabilityId: "instagram.media_visual_observations",
        normalizationContractVersion: {
          in: [
            INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
            INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
          ],
        },
        capture: {
          status: "COMPLETED",
          capturedAt: { lte: request.executionCutoff },
          providerAccountId: request.providerAccountId,
          authorizationGeneration: request.authorizationGeneration,
        },
        resource: {
          sourceClass: "INSTAGRAM_OWNED",
          providerAccountId: request.providerAccountId,
        },
      },
      include: { capture: true, resource: true },
      orderBy: [{ capture: { capturedAt: "desc" } }, { evidenceRef: "asc" }],
    });
    const latestCaptureRef = rows[0]?.captureRef;
    return latestCaptureRef
      ? rows.filter((row) => row.captureRef === latestCaptureRef)
      : [];
  }

  private async loadReplay(
    brandId: string,
    mediaId: string,
    executionIdentity: string,
  ) {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        normalizationContractVersion: INSTAGRAM_C3_NORMALIZATION_VERSION,
        boundedPayload: {
          path: ["executionIdentity"],
          equals: executionIdentity,
        },
      },
      orderBy: { capabilityId: "asc" },
    });
    if (rows.length !== OWNER_CAPABILITIES.length) return null;
    const payloads = new Map(
      rows.map((row) => [
        row.capabilityId,
        record(record(row.boundedPayload).semanticPayload),
      ]),
    );
    const caption = payloads.get("instagram.caption_context");
    const visual = payloads.get("instagram.media_visual_observations");
    const creator = payloads.get("instagram.media_creator_signals");
    const offering = payloads.get("instagram.media_offering_signals");
    if (!caption || !visual || !creator || !offering) return null;
    const core = record(caption.observationCore);
    if (core.mediaId !== mediaId) return null;
    const observation = InstagramMediaObservationSchema.parse({
      ...core,
      themes: record(caption.themes).values,
      captionPatterns: record(caption.captionPatterns).values,
      creativeStructures: record(caption.creativeStructures).values,
      visualExecutions: record(visual.visualExecutions).values,
      inspection: visual.inspection,
      creatorRoleSignals: record(creator.creatorRoleSignals).values,
      creatorPresence: creator.creatorPresence,
      likelyCollab: creator.likelyCollab,
      offeringPresence: offering.offeringPresence,
    });
    return {
      observation,
      refs: rows.map((row) => row.evidenceRef).sort(),
    };
  }

  private async persist(
    request: InstagramC3ExecutionRequest,
    light: C3EvidenceRow,
    visuals: readonly C3EvidenceRow[],
    c2: C3EvidenceRow,
    executionIdentity: string,
    manifest: Readonly<Record<string, unknown>>,
    finalized: ReturnType<typeof finalizeInstagramC3>,
  ) {
    const payloads = ownerPayloads(finalized);
    return this.prisma.$transaction(async (tx) => {
      const repositories = createDataExtractionRepositorySet(tx);
      const refs: string[] = [];
      for (const capabilityId of OWNER_CAPABILITIES) {
        const parentRefs = relevantParents(
          capabilityId,
          payloads[capabilityId],
          light.evidenceRef,
          visuals.map((visual) => visual.evidenceRef),
          c2.evidenceRef,
        );
        const captureByEvidenceRef = new Map([
          [light.evidenceRef, light.captureRef],
          [c2.evidenceRef, c2.captureRef],
          ...visuals.map(
            (visual) => [visual.evidenceRef, visual.captureRef] as const,
          ),
        ]);
        const normalizedPayload = {
          resultClass: "MODEL_DERIVED_RESULT",
          contractVersion: INSTAGRAM_C3_CONTRACT_VERSION,
          observationProfileVersion: INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
          promptProfileVersion: INSTAGRAM_C3_PROMPT_PROFILE_VERSION,
          sourceScope: "INSTAGRAM_OWNED",
          brandProfileId: request.brandProfileId,
          providerAccountId: request.providerAccountId,
          authorizationGeneration: request.authorizationGeneration,
          mediaId: finalized.observation.mediaId,
          executionIdentity,
          inputManifest: manifest,
          semanticPayload: payloads[capabilityId],
          supportingEvidenceRefs: parentRefs,
        } as const;
        const valueHash = digestCanonical(normalizedPayload);
        const evidenceRef = asEvidenceRef(
          `evidence:instagram:c3:${digestCanonical({ capabilityId, executionIdentity, valueHash })}`,
        );
        const semanticKey = asSemanticObservationKey(
          `instagram-c3:${capabilityId}:${executionIdentity}`,
        );
        await repositories.evidenceItems.insertOrGetExact({
          brandId: asBrandId(request.brandProfileId),
          evidenceRef,
          capabilityId: capabilityId as never,
          normalizationContractVersion: INSTAGRAM_C3_NORMALIZATION_VERSION,
          resourceRef: light.resourceRef as never,
          captureRef: light.captureRef as never,
          sourceClass: "INSTAGRAM_OWNED" as never,
          resourceType: "INSTAGRAM_MEDIA",
          capturedAt: light.capture.capturedAt!.toISOString(),
          freshnessAtEmission: {
            state: "CURRENT",
            basis: "C3_MODEL_DERIVATION_AT_EXECUTION_CUTOFF",
            evaluatedAt: request.executionCutoff.toISOString(),
          },
          representativeness: "CONTEXT_SPECIFIC",
          coverageSnapshot: "SINGLE_RESOURCE",
          qualitySnapshot: {
            state: "COMPLETE",
            failureCategories: [],
            detailCodes: [],
          },
          provenance: {
            acquisitionOrNormalizationRunRef: `instagram-c3:${executionIdentity}`,
            captureMethodClass: "MODEL_DERIVATION",
            normalizationContractVersion: INSTAGRAM_C3_NORMALIZATION_VERSION,
            parentEvidenceRefs: parentRefs.map(asEvidenceRef),
            parentCaptureRefs: sortedUnique(
              parentRefs
                .map((ref) => captureByEvidenceRef.get(ref))
                .filter((ref): ref is string => Boolean(ref)),
            ) as never,
          },
          deduplication: {
            itemFingerprint: valueHash,
            repetitionCount: 1,
            supportingResourceRefs: [light.resourceRef as never],
          },
          boundedNormalizedPayload: { ...normalizedPayload, valueHash },
          contentHash: digestCanonical({ ...normalizedPayload, valueHash }),
          semanticObservationKey: semanticKey,
          relationshipRefs: [],
        });
        await repositories.semanticObservations.createOrGet(
          asBrandId(request.brandProfileId),
          semanticKey,
          capabilityId as never,
        );
        // R0 requires same-capability support: attach only the target-derived item.
        await repositories.semanticObservations.attachSupport(
          asBrandId(request.brandProfileId),
          semanticKey,
          evidenceRef,
        );
        refs.push(evidenceRef);
      }
      return refs.sort();
    });
  }
}

function ownerPayloads(finalized: ReturnType<typeof finalizeInstagramC3>) {
  const observation = finalized.observation;
  return {
    "instagram.caption_context": {
      observationCore: {
        contractVersion: observation.contractVersion,
        observationProfileVersion: observation.observationProfileVersion,
        sourceScope: observation.sourceScope,
        brandProfileId: observation.brandProfileId,
        providerAccountId: observation.providerAccountId,
        mediaId: observation.mediaId,
        resourceRef: observation.resourceRef,
        captureRef: observation.captureRef,
        authorizationGeneration: observation.authorizationGeneration,
        capturedAt: observation.capturedAt,
        publishedAt: observation.publishedAt,
        mediaType: observation.mediaType,
        permalink: observation.permalink,
        caption: observation.caption,
        captionContentHash: observation.captionContentHash,
        hashtags: observation.hashtags,
        mentions: observation.mentions,
        metrics: observation.metrics,
        evidenceRefs: observation.evidenceRefs,
        derivationVersions: observation.derivationVersions,
      },
      hashtags: observation.hashtags,
      mentions: observation.mentions,
      themes: finalized.fields.themes,
      captionPatterns: finalized.fields.captionPatterns,
      creativeStructures: finalized.fields.creativeStructures,
    },
    "instagram.media_visual_observations": {
      visualExecutions: finalized.fields.visualExecutions,
      inspection: observation.inspection,
    },
    "instagram.media_creator_signals": {
      creatorRoleSignals: finalized.fields.creatorRoleSignals,
      creatorPresence: observation.creatorPresence,
      likelyCollab: observation.likelyCollab,
      cues: finalized.cues,
    },
    "instagram.media_offering_signals": {
      offeringPresence: observation.offeringPresence,
    },
  } satisfies Record<(typeof OWNER_CAPABILITIES)[number], unknown>;
}

function relevantParents(
  capabilityId: (typeof OWNER_CAPABILITIES)[number],
  semanticPayload: unknown,
  lightRef: string,
  visualRefs: readonly string[],
  c2Ref: string,
) {
  if (capabilityId === "instagram.caption_context")
    return sortedUnique([
      lightRef,
      c2Ref,
      ...collectEvidenceRefs(semanticPayload).filter((ref) =>
        [lightRef, ...visualRefs, c2Ref].includes(ref),
      ),
    ]);
  if (capabilityId === "instagram.media_visual_observations")
    return [lightRef, ...visualRefs].sort();
  const admitted = new Set([lightRef, ...visualRefs]);
  const grounded = collectEvidenceRefs(semanticPayload).filter((ref) =>
    admitted.has(ref),
  );
  // UNKNOWN still records the admitted context that was inspected to reach a
  // deliberately non-assertive result; asserted fields use only their refs.
  return sortedUnique(
    grounded.length > 0 ? grounded : [lightRef, ...visualRefs],
  );
}

function collectEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectEvidenceRefs);
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const own = Array.isArray(row.evidenceRefs)
    ? row.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
    : [];
  return [
    ...own,
    ...Object.entries(row)
      .filter(([key]) => key !== "evidenceRefs")
      .flatMap(([, child]) => collectEvidenceRefs(child)),
  ];
}

function sortedUnique(values: readonly string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildContext(
  payload: Record<string, unknown>,
  lightEvidenceRef: string,
  visuals: readonly C3EvidenceRow[],
) {
  const caption = field(payload.caption);
  const selected = field(payload.selection).selectionRank != null;
  const visualPayloads = visuals.map((visual) => record(visual.boundedPayload));
  const videoFrames = visualPayloads
    .filter((value) => value.inspectionDepth === "MULTI_FRAME_SAMPLED")
    .map((value) => ({
      frame: record(value.frame),
      observation: record(value.observation),
    }))
    .sort(
      (a, b) =>
        Number(a.frame.frameOrdinal ?? 0) - Number(b.frame.frameOrdinal ?? 0),
    );
  const singleVisualPayload = visualPayloads[0] ?? {};
  const observation =
    videoFrames.length > 0
      ? { sampledFrames: videoFrames }
      : record(singleVisualPayload.observation);
  const inspectionDepth = singleVisualPayload.inspectionDepth;
  const children = field(payload.carouselChildren);
  const childRows = Array.isArray(children.children) ? children.children : [];
  const depth = !selected
    ? "LIGHT_ONLY"
    : visuals.length > 0 && videoFrames.length > 0
      ? "PARTIAL_DEEP"
      : visuals.length > 0 && inspectionDepth === "IMAGE_ONLY"
        ? "DEEP_SELECTED"
        : visuals.length > 0 &&
            inspectionDepth === "CAROUSEL_REPRESENTATIVE_ONLY"
          ? "PARTIAL_DEEP"
          : visuals.length > 0 && inspectionDepth === "COVER_ONLY"
            ? "COVER_ONLY"
            : "NOT_INSPECTED";
  const selectionReasons = Array.isArray(field(payload.selection).reasonCodes)
    ? (field(payload.selection).reasonCodes as string[]).filter((reason) =>
        [
          "RECENT_FORMAT_COVERAGE",
          "TOP_PERFORMANCE_BAND",
          "MIDDLE_PERFORMANCE_BAND",
          "LOW_PERFORMANCE_BAND",
          "LIKELY_CREATOR_CUE",
          "BRAND_ONLY_BASELINE_CUE",
          "OFFERING_DIVERSITY_CUE",
          "THEME_DIVERSITY_CUE",
          "TIME_BUCKET_COVERAGE",
          "STABLE_FILL",
        ].includes(reason),
      )
    : [];
  const reasonCodes =
    depth === "COVER_ONLY"
      ? [
          "COVER_ONLY",
          "VIDEO_NOT_ANALYZED",
          "AUDIO_NOT_ANALYZED",
          "TRANSCRIPT_NOT_ACQUIRED",
        ]
      : videoFrames.length > 0
        ? [
            "SAMPLED_FRAMES_ARE_NOT_COMPLETE_VIDEO",
            "AUDIO_NOT_ANALYZED",
            "TRANSCRIPT_NOT_ACQUIRED",
            "TEMPORAL_SEQUENCE_NOT_ANALYZED",
          ]
        : depth === "PARTIAL_DEEP"
          ? ["CAROUSEL_CHILD_UNAVAILABLE"]
          : depth === "LIGHT_ONLY"
            ? ["MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS", "NOT_INSPECTED"]
            : depth === "NOT_INSPECTED"
              ? ["NOT_INSPECTED"]
              : [];
  return {
    caption: {
      state:
        caption.state === "OBSERVED"
          ? ("AVAILABLE" as const)
          : caption.state === "EXPLICIT_EMPTY"
            ? ("EXPLICIT_EMPTY" as const)
            : ("UNKNOWN" as const),
      ...(caption.state === "OBSERVED" &&
      typeof caption.sourceContent === "string"
        ? { text: caption.sourceContent }
        : {}),
      contentHash:
        caption.state === "OBSERVED" && typeof caption.sourceHash === "string"
          ? caption.sourceHash
          : null,
      evidenceRef: lightEvidenceRef,
    },
    visual: {
      state:
        visuals.length > 0 && Object.keys(observation).length > 0
          ? ("AVAILABLE" as const)
          : ("UNKNOWN" as const),
      ...(visuals.length > 0 && Object.keys(observation).length > 0
        ? { observation }
        : {}),
      ...(visuals[0] ? { evidenceRef: visuals[0].evidenceRef } : {}),
      evidenceRefs: visuals.map((visual) => visual.evidenceRef).sort(),
    },
    inspection: {
      depth,
      selectedForDeepAnalysis: selected,
      selectionReasons,
      inspectedChildCount:
        depth === "PARTIAL_DEEP" && videoFrames.length === 0 ? 1 : 0,
      availableChildCount: childRows.length,
      inspectedFrameCount: videoFrames.length
        ? videoFrames.length
        : depth === "DEEP_SELECTED" || depth === "COVER_ONLY"
          ? 1
          : 0,
      reasonCodes,
    },
  } as const;
}

function buildModelContext(
  mediaId: string,
  payload: Record<string, unknown>,
  context: ReturnType<typeof buildContext>,
  offerings: readonly Readonly<{ normalizedName: string }>[],
): InstagramC3ModelContext {
  const tokens = extractCaptionTokens(context.caption.text);
  return {
    media: { id: mediaId, type: normalizeMediaType(payload.mediaType) },
    caption: {
      state: context.caption.state,
      ...(context.caption.text ? { text: context.caption.text } : {}),
      ...tokens,
    },
    visual: {
      state: context.visual.state,
      ...(context.visual.observation
        ? { observation: context.visual.observation }
        : {}),
    },
    inspection: context.inspection,
    offerings: offerings.map((item) => ({ name: item.normalizedName })),
  };
}

function projectC2Metrics(
  c2: { boundedPayload: Prisma.JsonValue; evidenceRef: string },
  mediaId: string,
) {
  const result = record(record(c2.boundedPayload).result);
  const rates = Array.isArray(result.mediaRates) ? result.mediaRates : [];
  const projected: unknown[] = [];
  for (const value of rates) {
    const rate = record(value);
    if (
      rate.providerMediaId !== mediaId ||
      typeof rate.numeratorMetric !== "string"
    )
      continue;
    if (rate.availability !== "AVAILABLE") {
      projected.push({
        availability: "UNAVAILABLE" as const,
        metricId: `${rate.numeratorMetric}_per_reach`,
        reasonCode: "INSUFFICIENT_EVIDENCE" as const,
        evidenceRefs: [c2.evidenceRef],
      });
      continue;
    }
    const ratio = record(rate.ratio);
    const valueNumber = Number(ratio.decimal);
    const denominator = Number(rate.denominatorValue);
    if (!Number.isFinite(valueNumber) || !Number.isFinite(denominator))
      continue;
    projected.push({
      availability:
        valueNumber === 0 ? ("OBSERVED_ZERO" as const) : ("OBSERVED" as const),
      metricId: `${rate.numeratorMetric}_per_reach`,
      value: valueNumber,
      unit: "RATIO" as const,
      denominator: { state: "AVAILABLE" as const, value: denominator },
      evidenceRefs: [c2.evidenceRef],
    });
  }
  return projected;
}

function sourceValue(value: unknown) {
  const source = field(value);
  return source.state === "OBSERVED" && typeof source.value === "string"
    ? { state: "AVAILABLE" as const, value: source.value }
    : {
        state: "UNKNOWN" as const,
        reasonCode: "INSUFFICIENT_EVIDENCE" as const,
      };
}

function assertC2SupportsMedia(c2: C3EvidenceRow, light: C3EvidenceRow) {
  const inputManifest = record(record(c2.boundedPayload).inputManifest);
  const evidence = Array.isArray(inputManifest.evidence)
    ? inputManifest.evidence
    : [];
  const support = evidence
    .map(record)
    .find((item) => item.evidenceRef === light.evidenceRef);
  if (
    !support ||
    support.payloadHash !== digestCanonical(record(light.boundedPayload))
  ) {
    throw new InstagramC3SemanticError("C2_IDENTITY_MISMATCH");
  }
}

function normalizeMediaType(value: unknown) {
  const raw = field(value).value;
  const normalized = typeof raw === "string" ? raw.toUpperCase() : "IMAGE";
  if (normalized === "REEL") return "REELS" as const;
  if (["IMAGE", "CAROUSEL_ALBUM", "REELS", "VIDEO"].includes(normalized))
    return normalized as "IMAGE" | "CAROUSEL_ALBUM" | "REELS" | "VIDEO";
  throw new InstagramC3SemanticError("MEDIA_TYPE_UNSUPPORTED");
}

function validateRequest(request: InstagramC3ExecutionRequest) {
  if (
    !request.brandProfileId ||
    !request.providerAccountId ||
    !Number.isSafeInteger(request.authorizationGeneration) ||
    request.authorizationGeneration < 1 ||
    !Number.isFinite(request.windowEnd.getTime()) ||
    !Number.isFinite(request.executionCutoff.getTime()) ||
    request.windowEnd > request.executionCutoff
  )
    throw persistenceError("PERSISTENCE_INVARIANT");
}
function safeErrorCode(error: unknown) {
  return error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "SEMANTIC_EXECUTION_FAILED";
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function field(value: unknown): Record<string, unknown> {
  return record(value);
}

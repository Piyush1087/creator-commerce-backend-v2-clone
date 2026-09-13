import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { canonicalJson } from "../../brand-intelligence/contracts/bundle/canonical-json";
import { InstagramIntelligenceAuthorizedImageAcquisitionService } from "../../brand-settings/services/instagram-intelligence-image-acquisition.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import {
  INSTAGRAM_CAROUSEL_MAX_CHILDREN,
  type InstagramCarouselChildrenTruth,
} from "../../instagram/instagram-intelligence-provider.types";
import type { InstagramTemporaryImageArtifact } from "../../instagram/media/instagram-image-acquisition.types";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import {
  INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
  INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
  InstagramVisualTextModelPort,
  finalizeInstagramVisualText,
  normalizeVisibleText,
  type InstagramVisualTextObservation,
} from "../../instagram/media/instagram-visual-text";
import {
  INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
  InstagramB3aVisualModelPort,
  instagramB3aVisualObservationSchema,
} from "./instagram-b3a-visual-observation";

export const INSTAGRAM_W2_CAROUSEL_PROFILE =
  "instagram-carousel-visual-text-w2-v1";
export const INSTAGRAM_W2_NORMALIZATION_VERSION =
  "instagram.media_visual_observations.carousel-w2.v1";
export const INSTAGRAM_W2_CUE_FINALIZER_VERSION =
  "instagram-carousel-atomic-cues-v1";
export const INSTAGRAM_W2_MAX_CONCURRENCY = 3;
export const INSTAGRAM_W2_MAX_CHILD_WORK = 24 * INSTAGRAM_CAROUSEL_MAX_CHILDREN;

type W2Input = Readonly<{
  brandProfileId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  parentMediaId: string;
  children: InstagramCarouselChildrenTruth;
  windowEnd: Date;
  sourceCaptureRef: string;
  sourceEvidenceRefs: readonly string[];
  now?: () => Date;
  signal?: AbortSignal;
}>;

type ChildCoverage = Readonly<{
  providerMediaId: string;
  ordinal: number;
  mediaType: string;
  inspectionMode: "IMAGE_FULL" | "VIDEO_COVER_ONLY" | "UNSUPPORTED";
  state: "AVAILABLE" | "PARTIAL" | "UNKNOWN";
  reasonCode: string;
  visualState: "AVAILABLE" | "UNKNOWN";
  visualReasonCode: string;
  visualTextState: "OBSERVED" | "EXPLICIT_EMPTY" | "UNKNOWN";
  visualTextReasonCode: string;
}>;

export type InstagramW2CarouselResult = Readonly<{
  visualInspection: "INSPECTED" | "UNAVAILABLE";
  visualSemanticResult: "AVAILABLE" | "UNKNOWN";
  reasonCode:
    | "CAROUSEL_CHILDREN_INSPECTED"
    | "CAROUSEL_CHILDREN_PARTIAL"
    | "CAROUSEL_CHILDREN_UNAVAILABLE"
    | "EXACT_CAROUSEL_EXECUTION_REUSED";
  reused: boolean;
  coverage: Readonly<{
    providerAvailability: InstagramCarouselChildrenTruth["availability"];
    providerStopReason: InstagramCarouselChildrenTruth["stopReason"];
    providerChildCountReturned: number;
    childCountRepresented: number;
    childCountAttempted: number;
    childCountVisuallyInspected: number;
    childCountOcrInspected: number;
    visualUnavailableCount: number;
    ocrUnavailableCount: number;
    unsupportedChildCount: number;
    imageFullCount: number;
    videoCoverOnlyCount: number;
    unavailableUnsupportedFailedCount: number;
    state: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
    completeVisualScope: boolean;
    completeVisualTextScope: boolean;
    completeVideoScope: boolean;
    children: readonly ChildCoverage[];
  }>;
  evidenceRefs: readonly string[];
}>;

type SupportedChild = Readonly<{
  child: InstagramCarouselChildrenTruth["children"][number];
  mediaType: "IMAGE" | "VIDEO";
  inspectionMode: "IMAGE_FULL" | "VIDEO_COVER_ONLY";
  artifact: InstagramTemporaryImageArtifact;
  visual?: ReturnType<typeof instagramB3aVisualObservationSchema.parse>;
  visualText?: InstagramVisualTextObservation;
  coverage: ChildCoverage;
  atomicCues: ReturnType<typeof finalizeAtomicCues>;
}>;

@Injectable()
export class InstagramW2CarouselPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acquisition: InstagramIntelligenceAuthorizedImageAcquisitionService,
    private readonly visualModel: InstagramB3aVisualModelPort,
    private readonly visualTextModel: InstagramVisualTextModelPort,
    private readonly writer: InstagramCaptureWriterService,
    private readonly temporaryStore: InstagramImageTemporaryStore,
  ) {}

  async execute(input: W2Input): Promise<InstagramW2CarouselResult> {
    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    validateInput(input);
    await this.acquisition.assertReplayAuthorized({
      brandProfileId: input.brandProfileId,
      integrationId: input.integrationId,
      expectedProviderAccountId: input.providerAccountId,
      expectedAuthorizationGeneration: input.authorizationGeneration,
    });
    const orderedChildren = [...input.children.children].sort(
      (a, b) =>
        a.ordinal - b.ordinal ||
        a.providerMediaId.localeCompare(b.providerMediaId),
    );
    const replayIdentity = digestCanonical({
      profile: INSTAGRAM_W2_CAROUSEL_PROFILE,
      brandProfileId: input.brandProfileId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      parentMediaId: input.parentMediaId,
      childManifest: orderedChildren.map(childIdentity),
      providerAvailability: input.children.availability,
      providerStopReason: input.children.stopReason,
      sourceCaptureRef: input.sourceCaptureRef,
      sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
      windowEnd: input.windowEnd.toISOString(),
      visualContract: INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
      visualPrompt: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
      visualModel: modelIdentity(this.visualModel),
      textContract: INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
      textPrompt: INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
      textModel: modelIdentity(this.visualTextModel),
      cueFinalizer: INSTAGRAM_W2_CUE_FINALIZER_VERSION,
    });
    const replay = await this.loadReplay(input, replayIdentity);
    if (replay)
      return {
        ...replay,
        reused: true,
        reasonCode: "EXACT_CAROUSEL_EXECUTION_REUSED",
      };

    const offerings = await this.prisma.offering.findMany({
      where: { brandProfileId: input.brandProfileId, isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    const completed = await mapBounded(
      orderedChildren,
      INSTAGRAM_W2_MAX_CONCURRENCY,
      async (child) => this.inspectChild(input, child, offerings),
    );
    const successes = completed.filter(
      (row): row is SupportedChild => "artifact" in row,
    );
    const childCoverage: ChildCoverage[] = completed.map((row) =>
      "artifact" in row ? row.coverage : row,
    );
    const coverage = buildCoverage(input.children, childCoverage);
    const completedAt = now().toISOString();
    const metadata = {
      replayIdentity,
      profile: INSTAGRAM_W2_CAROUSEL_PROFILE,
      parentProviderMediaId: input.parentMediaId,
      sourceCaptureRef: input.sourceCaptureRef,
      sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
      coverage,
      visualContractVersion: INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
      visualPromptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
      visualModel: modelIdentity(this.visualModel),
      visualTextContractVersion: INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
      visualTextPromptProfileVersion:
        INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
      visualTextModel: modelIdentity(this.visualTextModel),
      cueFinalizerVersion: INSTAGRAM_W2_CUE_FINALIZER_VERSION,
    } as const;
    const lineage = await this.writer.write({
      brandId: input.brandProfileId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      resourceType: "INSTAGRAM_MEDIA",
      mediaId: input.parentMediaId,
      capabilityId: "instagram.media_visual_observations",
      requestKey: `w2-carousel:${replayIdentity}`,
      providerExecutionRef: `provider-execution:instagram:${replayIdentity}`,
      normalizationContractVersion: INSTAGRAM_W2_NORMALIZATION_VERSION,
      startedAt,
      completedAt,
      ...(coverage.state === "UNAVAILABLE" ? {} : { capturedAt: completedAt }),
      availability:
        coverage.state === "COMPLETE"
          ? "AVAILABLE"
          : coverage.state === "PARTIAL"
            ? "PARTIAL"
            : "UNAVAILABLE",
      retryability:
        coverage.state === "COMPLETE" ? "NOT_APPLICABLE" : "RETRYABLE",
      reasonCodes: [`W2_CAROUSEL_${coverage.state}`],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state:
          coverage.state === "COMPLETE"
            ? "COMPLETE"
            : coverage.state === "PARTIAL"
              ? "PARTIAL"
              : "UNAVAILABLE",
        failureCategories:
          coverage.visualUnavailableCount ||
          coverage.ocrUnavailableCount ||
          coverage.unsupportedChildCount
            ? ["CAROUSEL_CHILD_VISUAL_TEXT"]
            : [],
        detailCodes: childCoverage
          .filter((row) => row.state !== "AVAILABLE")
          .flatMap((row) => [
            ...(row.visualState === "UNKNOWN"
              ? [`${row.ordinal}:${row.visualReasonCode}`]
              : []),
            ...(row.visualTextState === "UNKNOWN"
              ? [`${row.ordinal}:${row.visualTextReasonCode}`]
              : []),
          ]),
      },
      artifacts:
        coverage.state === "UNAVAILABLE"
          ? []
          : [
              { artifactKey: "carousel-coverage", payload: metadata },
              ...successes.map((row) => ({
                artifactKey: `child-${row.child.ordinal}`,
                payload: childPayload(row, metadata),
              })),
            ],
      evidence:
        coverage.state === "UNAVAILABLE"
          ? []
          : successes.map((row) => ({
              evidenceKey: `child-${row.child.ordinal}`,
              artifactKey: `child-${row.child.ordinal}`,
              payload: childPayload(row, metadata),
              freshness: "CURRENT" as const,
              representativeness: "CONTEXT_SPECIFIC" as const,
              semanticObservationKey: `instagram:carousel-child:${digestCanonical({ replayIdentity, child: childIdentity(row.child) })}`,
            })),
    });
    return resultFor(coverage, lineage.evidenceRefs, lineage.reused);
  }

  private async inspectChild(
    input: W2Input,
    child: InstagramCarouselChildrenTruth["children"][number],
    offerings: readonly Readonly<{ id: string; name: string }>[],
  ): Promise<SupportedChild | ChildCoverage> {
    const mediaType = observedType(child);
    if (mediaType === "UNKNOWN")
      return unknownChild(child, mediaType, "UNSUPPORTED_CHILD_TYPE");
    const inspectionMode =
      mediaType === "IMAGE" ? "IMAGE_FULL" : "VIDEO_COVER_ONLY";
    let artifact: InstagramTemporaryImageArtifact | undefined;
    try {
      const acquired = await this.acquisition.acquire({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        expectedProviderAccountId: input.providerAccountId,
        expectedAuthorizationGeneration: input.authorizationGeneration,
        mediaId: child.providerMediaId,
        locatorKind:
          inspectionMode === "IMAGE_FULL" ? "CAROUSEL_CHILD" : "VIDEO_COVER",
        ...(input.now ? { now: input.now } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      artifact = acquired.artifact;
      const [visualSettled, textSettled] = await Promise.allSettled([
        this.visualModel.observe({
          temporaryPath: artifact.temporaryPath,
          mediaType: artifact.mediaType,
          byteLength: artifact.byteLength,
          width: artifact.width,
          height: artifact.height,
          sha256: artifact.sha256,
          promptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
          observationContractVersion:
            INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
        }),
        this.visualTextModel.observe({
          temporaryPath: artifact.temporaryPath,
          mediaType: artifact.mediaType,
          byteLength: artifact.byteLength,
          width: artifact.width,
          height: artifact.height,
          sha256: artifact.sha256,
          promptProfileVersion: INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
          observationContractVersion: INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
          untrustedImageTextIsDataOnly: true,
        }),
      ]);
      const visual = settleValidated(
        visualSettled,
        instagramB3aVisualObservationSchema.parse,
      );
      const visualText = settleValidated(
        textSettled,
        finalizeInstagramVisualText,
      );
      const coverage = modalityCoverage(
        child,
        mediaType,
        inspectionMode,
        visual,
        visualText,
      );
      if (!visual && !visualText) return coverage;
      return {
        child,
        mediaType,
        inspectionMode,
        artifact,
        visual,
        visualText,
        coverage,
        atomicCues: finalizeAtomicCues(visual, visualText, offerings),
      };
    } catch {
      return unknownChild(
        child,
        mediaType,
        "CHILD_INSPECTION_FAILED",
        inspectionMode,
      );
    } finally {
      if (artifact)
        await this.temporaryStore
          .remove(artifact.temporaryPath)
          .catch(() => undefined);
    }
  }

  private async loadReplay(
    input: W2Input,
    replayIdentity: string,
  ): Promise<InstagramW2CarouselResult | null> {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: input.brandProfileId,
        capabilityId: "instagram.media_visual_observations",
        normalizationContractVersion: INSTAGRAM_W2_NORMALIZATION_VERSION,
        boundedPayload: { path: ["replayIdentity"], equals: replayIdentity },
        capture: {
          status: "COMPLETED",
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
        },
      },
      select: {
        evidenceRef: true,
        captureRef: true,
        boundedPayload: true,
        capture: {
          select: {
            createdAt: true,
            contentArtifacts: { select: { inlineContent: true } },
          },
        },
      },
      orderBy: [{ capture: { createdAt: "desc" } }, { evidenceRef: "asc" }],
    });
    const captureRef = rows[0]?.captureRef;
    if (!captureRef) return null;
    const replayRows = rows
      .filter((row) => row.captureRef === captureRef)
      .sort(
        (a, b) =>
          childOrdinal(a.boundedPayload) - childOrdinal(b.boundedPayload),
      );
    const metadata = replayRows[0]?.capture.contentArtifacts
      .map((row) => recordJson(row.inlineContent))
      .find((row) => row.replayIdentity === replayIdentity);
    const coverage = parseCoverage(metadata?.coverage);
    if (
      !coverage ||
      replayRows.length !==
        coverage.children.filter((row) => row.state !== "UNKNOWN").length ||
      replayRows.length === 0
    )
      return null;
    return resultFor(
      coverage,
      replayRows.map((row) => row.evidenceRef),
      true,
    );
  }
}

function childPayload(
  row: SupportedChild,
  metadata: Readonly<Record<string, unknown>>,
) {
  return {
    ...metadata,
    inspectionDepth: "CAROUSEL_FULL_BOUNDED",
    child: {
      providerMediaId: row.child.providerMediaId,
      ordinal: row.child.ordinal,
      mediaType: row.mediaType,
      inspectionMode: row.inspectionMode,
    },
    contentHash: row.artifact.sha256,
    technical: {
      mediaType: row.artifact.mediaType,
      byteLength: row.artifact.byteLength,
      width: row.artifact.width,
      height: row.artifact.height,
    },
    modalityTruth: {
      visualState: row.coverage.visualState,
      visualReasonCode: row.coverage.visualReasonCode,
      visualTextState: row.coverage.visualTextState,
      visualTextReasonCode: row.coverage.visualTextReasonCode,
      overallState: row.coverage.state,
    },
    ...(row.visual ? { observation: row.visual } : {}),
    ...(row.visualText ? { visualText: row.visualText } : {}),
    atomicCues: row.atomicCues,
  };
}

function finalizeAtomicCues(
  visual:
    | ReturnType<typeof instagramB3aVisualObservationSchema.parse>
    | undefined,
  visualText: InstagramVisualTextObservation | undefined,
  offerings: readonly Readonly<{ id: string; name: string }>[],
) {
  const spans = (visualText?.spans ?? []).map((span) =>
    normalizeVisibleText(span),
  );
  const searchable = [
    ...spans,
    ...(visual?.visibleElements ?? []).map(normalizeVisibleText),
  ];
  const ctaPhrases = exactPhrases(spans, [
    "buy now",
    "learn more",
    "link in bio",
    "order now",
    "shop now",
    "sign up",
  ]);
  const disclosurePhrases = exactPhrases(spans, [
    "ad",
    "advertisement",
    "paid partnership",
    "sponsored",
  ]);
  const productLike = exactPhrases(searchable, [
    "collection",
    "pack",
    "product",
    "shop",
  ]);
  const offeringMatches = offerings.filter((offering) =>
    searchable.some((span) =>
      containsExactPhrase(span, normalizeVisibleText(offering.name)),
    ),
  );
  const uniqueOffering =
    offeringMatches.length === 1 ? offeringMatches[0] : null;
  return {
    cta: {
      state: ctaPhrases.length
        ? "OBSERVED"
        : visualText?.state === "EXPLICIT_EMPTY"
          ? "NOT_OBSERVED"
          : "UNKNOWN",
      phrases: ctaPhrases,
      confidence: ctaPhrases.length ? "LOW" : null,
    },
    product: {
      state:
        productLike.length || uniqueOffering
          ? "OBSERVED"
          : visualText?.state === "EXPLICIT_EMPTY" && visual !== undefined
            ? "NOT_OBSERVED"
            : "UNKNOWN",
      phrases: productLike,
      canonicalOfferingId: uniqueOffering?.id ?? null,
      canonicalOfferingMatch: uniqueOffering ? "EXACT_PREEXISTING" : "NONE",
      confidence: productLike.length || uniqueOffering ? "LOW" : null,
    },
    disclosure: {
      state: disclosurePhrases.length
        ? "OBSERVED"
        : visualText?.state === "EXPLICIT_EMPTY"
          ? "NOT_OBSERVED"
          : "UNKNOWN",
      phrases: disclosurePhrases,
      collaborationTruth: "NONE",
      likelyCollabConfidenceCeiling: disclosurePhrases.length ? "LOW" : null,
    },
  } as const;
}

function exactPhrases(spans: readonly string[], vocabulary: readonly string[]) {
  return vocabulary
    .filter((phrase) => spans.some((span) => containsExactPhrase(span, phrase)))
    .sort();
}

function containsExactPhrase(value: string, phrase: string) {
  const source = normalizeVisibleText(value).toLocaleLowerCase("en-US");
  const target = normalizeVisibleText(phrase).toLocaleLowerCase("en-US");
  if (!target) return false;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    "u",
  ).test(source);
}

function buildCoverage(
  children: InstagramCarouselChildrenTruth,
  rows: readonly ChildCoverage[],
): InstagramW2CarouselResult["coverage"] {
  const attempted = rows.filter(
    (row) => row.inspectionMode !== "UNSUPPORTED",
  ).length;
  const visualInspected = rows.filter(
    (row) => row.visualState === "AVAILABLE",
  ).length;
  const ocrInspected = rows.filter(
    (row) => row.visualTextState !== "UNKNOWN",
  ).length;
  const supported = rows.filter((row) => row.state !== "UNKNOWN").length;
  const failures = rows.length - supported;
  const unsupported = rows.filter(
    (row) => row.inspectionMode === "UNSUPPORTED",
  ).length;
  const visualUnavailable = rows.filter(
    (row) => row.visualState === "UNKNOWN",
  ).length;
  const ocrUnavailable = rows.filter(
    (row) => row.visualTextState === "UNKNOWN",
  ).length;
  const enumerationComplete =
    children.availability === "AVAILABLE" &&
    children.stopReason === "EXHAUSTED";
  const completeVisualScope =
    enumerationComplete &&
    visualUnavailable === 0 &&
    rows.length === children.children.length;
  const completeVisualTextScope =
    enumerationComplete &&
    ocrUnavailable === 0 &&
    rows.length === children.children.length;
  const state =
    supported === 0
      ? "UNAVAILABLE"
      : completeVisualScope && completeVisualTextScope
        ? "COMPLETE"
        : "PARTIAL";
  return {
    providerAvailability: children.availability,
    providerStopReason: children.stopReason,
    providerChildCountReturned: children.children.length,
    childCountRepresented: rows.length,
    childCountAttempted: attempted,
    childCountVisuallyInspected: visualInspected,
    childCountOcrInspected: ocrInspected,
    visualUnavailableCount: visualUnavailable,
    ocrUnavailableCount: ocrUnavailable,
    unsupportedChildCount: unsupported,
    imageFullCount: rows.filter(
      (row) =>
        row.inspectionMode === "IMAGE_FULL" && row.visualState === "AVAILABLE",
    ).length,
    videoCoverOnlyCount: rows.filter(
      (row) =>
        row.inspectionMode === "VIDEO_COVER_ONLY" &&
        row.visualState === "AVAILABLE",
    ).length,
    unavailableUnsupportedFailedCount: failures,
    state,
    completeVisualScope,
    completeVisualTextScope,
    completeVideoScope:
      completeVisualScope &&
      rows.every((row) => row.inspectionMode === "IMAGE_FULL"),
    children: rows,
  };
}

function resultFor(
  coverage: InstagramW2CarouselResult["coverage"],
  evidenceRefs: readonly string[],
  reused: boolean,
): InstagramW2CarouselResult {
  return {
    visualInspection: coverage.childCountVisuallyInspected
      ? "INSPECTED"
      : "UNAVAILABLE",
    visualSemanticResult:
      coverage.childCountVisuallyInspected || coverage.childCountOcrInspected
        ? "AVAILABLE"
        : "UNKNOWN",
    reasonCode: reused
      ? "EXACT_CAROUSEL_EXECUTION_REUSED"
      : coverage.state === "COMPLETE"
        ? "CAROUSEL_CHILDREN_INSPECTED"
        : coverage.state === "PARTIAL"
          ? "CAROUSEL_CHILDREN_PARTIAL"
          : "CAROUSEL_CHILDREN_UNAVAILABLE",
    reused,
    coverage,
    evidenceRefs,
  };
}

function observedType(
  child: InstagramCarouselChildrenTruth["children"][number],
): "IMAGE" | "VIDEO" | "UNKNOWN" {
  if (child.mediaType.state !== "OBSERVED") return "UNKNOWN";
  const value = child.mediaType.value.toUpperCase();
  return value === "IMAGE"
    ? "IMAGE"
    : ["VIDEO", "REEL", "REELS"].includes(value)
      ? "VIDEO"
      : "UNKNOWN";
}

function unknownChild(
  child: InstagramCarouselChildrenTruth["children"][number],
  mediaType: string,
  reasonCode: string,
  inspectionMode: ChildCoverage["inspectionMode"] = "UNSUPPORTED",
): ChildCoverage {
  return {
    providerMediaId: child.providerMediaId,
    ordinal: child.ordinal,
    mediaType,
    inspectionMode,
    state: "UNKNOWN",
    reasonCode,
    visualState: "UNKNOWN",
    visualReasonCode: reasonCode,
    visualTextState: "UNKNOWN",
    visualTextReasonCode: reasonCode,
  };
}

function settleValidated<T>(
  settled: PromiseSettledResult<unknown>,
  validate: (value: unknown) => T,
): T | undefined {
  if (settled.status === "rejected") return undefined;
  try {
    return validate(settled.value);
  } catch {
    return undefined;
  }
}

function modalityCoverage(
  child: InstagramCarouselChildrenTruth["children"][number],
  mediaType: "IMAGE" | "VIDEO",
  inspectionMode: "IMAGE_FULL" | "VIDEO_COVER_ONLY",
  visual:
    | ReturnType<typeof instagramB3aVisualObservationSchema.parse>
    | undefined,
  visualText: InstagramVisualTextObservation | undefined,
): ChildCoverage {
  const visualState = visual ? "AVAILABLE" : "UNKNOWN";
  const visualTextState = visualText?.state ?? "UNKNOWN";
  const state =
    visual && visualText
      ? "AVAILABLE"
      : visual || visualText
        ? "PARTIAL"
        : "UNKNOWN";
  return {
    providerMediaId: child.providerMediaId,
    ordinal: child.ordinal,
    mediaType,
    inspectionMode,
    state,
    reasonCode:
      state === "AVAILABLE"
        ? "CHILD_INSPECTED"
        : state === "PARTIAL"
          ? "CHILD_MODALITY_PARTIAL"
          : "CHILD_INSPECTION_FAILED",
    visualState,
    visualReasonCode: visual ? "VISUAL_OBSERVED" : "VISUAL_OBSERVATION_FAILED",
    visualTextState,
    visualTextReasonCode:
      visualText?.state === "OBSERVED"
        ? "VISIBLE_TEXT_OBSERVED"
        : visualText?.state === "EXPLICIT_EMPTY"
          ? "VISIBLE_TEXT_EXPLICIT_EMPTY"
          : "VISUAL_TEXT_OBSERVATION_FAILED",
  };
}

function childIdentity(
  child: InstagramCarouselChildrenTruth["children"][number],
) {
  return {
    providerMediaId: child.providerMediaId,
    ordinal: child.ordinal,
    mediaType: child.mediaType,
    mediaProductType: child.mediaProductType,
  };
}

function modelIdentity(model: {
  providerIdentity?: string;
  modelIdentity: string;
  modelProfileVersion: string;
}) {
  return {
    providerIdentity: model.providerIdentity ?? "UNSPECIFIED",
    modelIdentity: model.modelIdentity,
    modelProfileVersion: model.modelProfileVersion,
  };
}

function digestCanonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function recordJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseCoverage(
  value: unknown,
): InstagramW2CarouselResult["coverage"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as InstagramW2CarouselResult["coverage"];
  const counts = [
    row.providerChildCountReturned,
    row.childCountRepresented,
    row.childCountAttempted,
    row.childCountVisuallyInspected,
    row.childCountOcrInspected,
    row.visualUnavailableCount,
    row.ocrUnavailableCount,
    row.unsupportedChildCount,
    row.imageFullCount,
    row.videoCoverOnlyCount,
    row.unavailableUnsupportedFailedCount,
  ];
  return counts.every(
    (count) => Number.isSafeInteger(count) && count >= 0 && count <= 10,
  ) &&
    Array.isArray(row.children) &&
    row.providerChildCountReturned === row.children.length &&
    row.childCountRepresented === row.children.length &&
    row.childCountAttempted <= row.childCountRepresented &&
    row.children.every(
      (child) =>
        ["AVAILABLE", "PARTIAL", "UNKNOWN"].includes(child.state) &&
        ["AVAILABLE", "UNKNOWN"].includes(child.visualState) &&
        ["OBSERVED", "EXPLICIT_EMPTY", "UNKNOWN"].includes(
          child.visualTextState,
        ),
    ) &&
    row.children.filter((child) => child.state !== "UNKNOWN").length +
      row.unavailableUnsupportedFailedCount ===
      row.childCountRepresented &&
    row.childCountVisuallyInspected ===
      row.children.filter((child) => child.visualState === "AVAILABLE")
        .length &&
    row.childCountOcrInspected ===
      row.children.filter((child) => child.visualTextState !== "UNKNOWN")
        .length &&
    row.visualUnavailableCount ===
      row.children.filter((child) => child.visualState === "UNKNOWN").length &&
    row.ocrUnavailableCount ===
      row.children.filter((child) => child.visualTextState === "UNKNOWN")
        .length &&
    row.unsupportedChildCount ===
      row.children.filter((child) => child.inspectionMode === "UNSUPPORTED")
        .length &&
    row.imageFullCount ===
      row.children.filter(
        (child) =>
          child.inspectionMode === "IMAGE_FULL" &&
          child.visualState === "AVAILABLE",
      ).length &&
    row.videoCoverOnlyCount ===
      row.children.filter(
        (child) =>
          child.inspectionMode === "VIDEO_COVER_ONLY" &&
          child.visualState === "AVAILABLE",
      ).length &&
    ["COMPLETE", "PARTIAL"].includes(row.state)
    ? row
    : null;
}

function childOrdinal(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return Number.MAX_SAFE_INTEGER;
  const child = (value as Record<string, unknown>).child;
  return child &&
    typeof child === "object" &&
    !Array.isArray(child) &&
    Number.isSafeInteger((child as Record<string, unknown>).ordinal)
    ? Number((child as Record<string, unknown>).ordinal)
    : Number.MAX_SAFE_INTEGER;
}

async function mapBounded<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= values.length) return;
        output[index] = await worker(values[index]!);
      }
    }),
  );
  return output;
}

function validateInput(input: W2Input) {
  if (
    !input.brandProfileId.trim() ||
    !input.integrationId.trim() ||
    !input.providerAccountId.trim() ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.parentMediaId) ||
    input.children.children.length > INSTAGRAM_CAROUSEL_MAX_CHILDREN ||
    input.children.children.length > INSTAGRAM_W2_MAX_CHILD_WORK ||
    new Set(input.children.children.map((child) => child.ordinal)).size !==
      input.children.children.length ||
    input.children.children.some(
      (child) =>
        !/^[A-Za-z0-9_-]{1,128}$/.test(child.providerMediaId) ||
        child.ordinal < 0 ||
        child.ordinal >= INSTAGRAM_CAROUSEL_MAX_CHILDREN,
    )
  )
    throw new Error("Invalid Week 2 carousel identity or bound");
}

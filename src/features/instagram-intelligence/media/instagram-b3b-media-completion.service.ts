import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { InstagramIntelligenceAuthorizedReadService } from "../../brand-settings/services/instagram-intelligence-provider-read.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import type {
  InstagramCarouselChildrenTruth,
  InstagramField,
  InstagramMediaInsightsTruth,
  InstagramMediaInventoryTruth,
  InstagramMediaTruth,
} from "../../instagram/instagram-intelligence-provider.types";
import { InstagramB3aImagePipelineService } from "./instagram-b3a-image-pipeline.service";
import {
  INSTAGRAM_B3B_SELECTOR_VERSION,
  selectInstagramB3bCorpus,
} from "./instagram-b3b-selector";

export const INSTAGRAM_B3B_NORMALIZATION_VERSION =
  "instagram.media-completion.b3b.v1";
export const INSTAGRAM_B3B_CAROUSEL_REPRESENTATIVE_VERSION =
  "first-supported-still-by-ordinal-v1";
const MAX_CAPTION_CHARS = 4_096;

type ExecutionInput = Readonly<{
  brandProfileId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  windowEnd: Date;
  now?: () => Date;
  signal?: AbortSignal;
}>;

export type InstagramB3bMediaCompletionResult = Readonly<{
  inventoryAvailability: InstagramMediaInventoryTruth["availability"];
  eligibleCount: number;
  selectedCount: number;
  missingTimestampCount: number;
  media: readonly Readonly<{
    providerMediaId: string;
    selected: boolean;
    visualInspection: "INSPECTED" | "NOT_INSPECTED" | "UNAVAILABLE";
    visualSemanticResult: "AVAILABLE" | "UNKNOWN";
    reason: string;
  }>[];
}>;

@Injectable()
export class InstagramB3bMediaCompletionService {
  constructor(
    private readonly reads: InstagramIntelligenceAuthorizedReadService,
    private readonly writer: InstagramCaptureWriterService,
    private readonly imagePipeline: InstagramB3aImagePipelineService,
  ) {}

  async execute(
    input: ExecutionInput,
  ): Promise<InstagramB3bMediaCompletionResult> {
    const now = input.now ?? (() => new Date());
    const inventoryRead = await this.reads.execute({
      ...readIdentity(input),
      command: { kind: "MEDIA_INVENTORY", windowEnd: input.windowEnd },
    });
    const inventory = inventoryRead.result as InstagramMediaInventoryTruth;
    const eligible = inventory.items.filter(
      (item) => item.timestamp.state === "OBSERVED",
    );
    const selection = selectInstagramB3bCorpus(
      eligible.map((item) => ({
        providerMediaId: item.providerMediaId,
        mediaType: observedString(item.mediaType) ?? "UNKNOWN",
        publishedAt: (item.timestamp as { state: "OBSERVED"; value: string })
          .value,
      })),
    );
    const selected = new Map(
      selection.selections.map((row) => [row.providerMediaId, row]),
    );

    await this.persistInventoryCoverage(input, inventory, selection, now);
    const results: Array<InstagramB3bMediaCompletionResult["media"][number]> =
      [];
    for (const media of eligible) {
      const mediaType = observedString(media.mediaType) ?? "UNKNOWN";
      const selectionRow = selected.get(media.providerMediaId);
      const insightsRead = await this.reads.execute({
        ...readIdentity(input),
        command: {
          kind: "MEDIA_INSIGHTS",
          mediaId: media.providerMediaId,
          mediaType,
        },
      });
      const insights = insightsRead.result as InstagramMediaInsightsTruth;
      let children: InstagramCarouselChildrenTruth | undefined;
      if (selectionRow && mediaType.toUpperCase() === "CAROUSEL_ALBUM") {
        const childRead = await this.reads.execute({
          ...readIdentity(input),
          command: {
            kind: "CAROUSEL_CHILDREN",
            mediaId: media.providerMediaId,
          },
        });
        children = childRead.result as InstagramCarouselChildrenTruth;
      }

      await this.persistLightEvidence(
        input,
        media,
        insights,
        selection,
        selectionRow,
        children,
        now,
      );
      if (!selectionRow) {
        results.push({
          providerMediaId: media.providerMediaId,
          selected: false,
          visualInspection: "NOT_INSPECTED",
          visualSemanticResult: "UNKNOWN",
          reason: "MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS",
        });
        continue;
      }
      results.push(
        await this.inspectSelected(input, media, mediaType, children, now),
      );
    }
    return {
      inventoryAvailability: inventory.availability,
      eligibleCount: selection.eligibleCount,
      selectedCount: selection.selectedCount,
      missingTimestampCount: inventory.coverage.rowsMissingTimestamp,
      media: results,
    };
  }

  private async persistInventoryCoverage(
    input: ExecutionInput,
    inventory: InstagramMediaInventoryTruth,
    selection: ReturnType<typeof selectInstagramB3bCorpus>,
    now: () => Date,
  ) {
    const capturedAt = input.windowEnd.toISOString();
    const missingTimestampMediaIds = inventory.items
      .filter((item) => item.timestamp.state !== "OBSERVED")
      .map((item) => item.providerMediaId)
      .sort();
    const base = writerBase(input, undefined, "inventory", capturedAt, now);
    if (inventory.availability === "UNAVAILABLE") {
      const { capturedAt: _capturedAt, ...failedBase } = base;
      await this.writer.write({
        ...failedBase,
        resourceType: "INSTAGRAM_ACCOUNT",
        capabilityId: "instagram.media_inventory",
        availability: "UNAVAILABLE",
        retryability: "RETRYABLE",
        reasonCodes: [`B3B_INVENTORY_${inventory.coverage.stopReason}`],
        coverage: "SITE_WIDE_BOUNDED",
        acquisitionQuality: {
          state: "UNAVAILABLE",
          failureCategories: ["INVENTORY"],
          detailCodes: [inventory.coverage.stopReason],
        },
        artifacts: [],
        evidence: [],
      });
      return;
    }
    await this.writer.write({
      ...base,
      resourceType: "INSTAGRAM_ACCOUNT",
      capabilityId: "instagram.media_inventory",
      availability: inventory.availability,
      retryability:
        inventory.availability === "AVAILABLE" ? "NOT_APPLICABLE" : "RETRYABLE",
      reasonCodes: [`B3B_INVENTORY_${inventory.coverage.stopReason}`],
      coverage: "SITE_WIDE_BOUNDED",
      acquisitionQuality: {
        state:
          inventory.availability === "AVAILABLE"
            ? "COMPLETE"
            : inventory.availability === "PARTIAL"
              ? "PARTIAL"
              : "UNAVAILABLE",
        failureCategories:
          inventory.availability === "AVAILABLE" ? [] : ["INVENTORY"],
        detailCodes: [inventory.coverage.stopReason],
      },
      artifacts: [
        {
          artifactKey: "inventory-coverage",
          payload: {
            coverage: inventory.coverage,
            missingTimestampMediaIds,
            selector: selection,
          },
        },
      ],
      evidence: [
        {
          evidenceKey: "inventory-coverage",
          artifactKey: "inventory-coverage",
          payload: {
            coverage: inventory.coverage,
            missingTimestampMediaIds,
            selector: selection,
          },
          freshness: "CURRENT",
          representativeness: "PERSISTENT_BRAND_LEVEL",
        },
      ],
    });
  }

  private async persistLightEvidence(
    input: ExecutionInput,
    media: InstagramMediaTruth,
    insights: InstagramMediaInsightsTruth,
    selection: ReturnType<typeof selectInstagramB3bCorpus>,
    selectionRow:
      | ReturnType<typeof selectInstagramB3bCorpus>["selections"][number]
      | undefined,
    children: InstagramCarouselChildrenTruth | undefined,
    now: () => Date,
  ) {
    const capturedAt = now().toISOString();
    const caption = boundedCaption(media.caption);
    const visual = lightVisualCoverage(media, selectionRow, children);
    const payload = {
      providerMediaId: media.providerMediaId,
      mediaType: media.mediaType,
      mediaProductType: media.mediaProductType,
      publishedTimestamp: media.timestamp,
      permalinkAvailability: media.permalink.state,
      caption,
      metrics: insights.metrics,
      metricAvailability: insights.availability,
      coverage: {
        inventory: "ELIGIBLE_30_DAY_POST",
        caption: caption.state,
        metrics: insights.availability,
        visual: visual.coverage,
      },
      selection: selectionRow
        ? {
            selectorVersion: selection.selectorVersion,
            eligibleCount: selection.eligibleCount,
            selectedCount: selection.selectedCount,
            ...selectionRow,
          }
        : {
            selectorVersion: selection.selectorVersion,
            eligibleCount: selection.eligibleCount,
            selectedCount: selection.selectedCount,
            selectionRank: null,
            reasonCodes: ["MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS"],
          },
      visualSemanticResult: "UNKNOWN",
      visualInspection: visual.inspection,
      visualReason: visual.reason,
      ...(children ? { carouselChildren: boundedChildren(children) } : {}),
    };
    await this.writer.write({
      ...writerBase(input, media.providerMediaId, "light", capturedAt, now),
      resourceType: "INSTAGRAM_MEDIA",
      capabilityId: "instagram.media_inventory",
      availability:
        insights.availability === "UNAVAILABLE" ? "PARTIAL" : "AVAILABLE",
      retryability:
        insights.availability === "UNAVAILABLE"
          ? "RETRYABLE"
          : "NOT_APPLICABLE",
      reasonCodes:
        insights.availability === "UNAVAILABLE"
          ? ["B3B_LIGHT_EVIDENCE_METRICS_UNAVAILABLE"]
          : ["B3B_LIGHT_EVIDENCE_AVAILABLE"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: insights.availability === "UNAVAILABLE" ? "PARTIAL" : "COMPLETE",
        failureCategories:
          insights.availability === "UNAVAILABLE" ? ["MEDIA_INSIGHTS"] : [],
        detailCodes: insights.unavailableReason
          ? [insights.unavailableReason]
          : [],
      },
      artifacts: [{ artifactKey: "light-evidence", payload }],
      evidence: [
        {
          evidenceKey: "light-evidence",
          artifactKey: "light-evidence",
          payload,
          freshness: "CURRENT",
          representativeness: "CONTEXT_SPECIFIC",
        },
      ],
    });
  }

  private async inspectSelected(
    input: ExecutionInput,
    media: InstagramMediaTruth,
    mediaType: string,
    children: InstagramCarouselChildrenTruth | undefined,
    now: () => Date,
  ): Promise<InstagramB3bMediaCompletionResult["media"][number]> {
    const normalized = mediaType.toUpperCase();
    let acquisitionMediaId = media.providerMediaId;
    let locatorKind: "IMAGE" | "CAROUSEL_CHILD" | "VIDEO_COVER" = "IMAGE";
    let inspectionDepth:
      | "IMAGE_ONLY"
      | "CAROUSEL_REPRESENTATIVE_ONLY"
      | "COVER_ONLY" = "IMAGE_ONLY";
    let executionProfile: "b3a-v1" | "b3b-carousel-v1" | "b3b-cover-v1" =
      "b3a-v1";
    let visualContext: Record<string, unknown> | undefined;
    if (normalized === "CAROUSEL_ALBUM") {
      const representative = selectRepresentativeChild(children);
      if (!representative)
        return unavailable(
          media.providerMediaId,
          "CAROUSEL_REPRESENTATIVE_UNAVAILABLE",
        );
      acquisitionMediaId = representative.providerMediaId;
      locatorKind = "CAROUSEL_CHILD";
      inspectionDepth = "CAROUSEL_REPRESENTATIVE_ONLY";
      executionProfile = "b3b-carousel-v1";
      visualContext = {
        parentProviderMediaId: media.providerMediaId,
        representativeChild: representative,
        representativeRuleVersion:
          INSTAGRAM_B3B_CAROUSEL_REPRESENTATIVE_VERSION,
      };
    } else if (["REEL", "REELS", "VIDEO"].includes(normalized)) {
      locatorKind = "VIDEO_COVER";
      inspectionDepth = "COVER_ONLY";
      executionProfile = "b3b-cover-v1";
      visualContext = {
        limitations: [
          "VIDEO_NOT_ANALYZED",
          "AUDIO_NOT_ANALYZED",
          "TRANSCRIPT_NOT_ACQUIRED",
        ],
      };
    } else if (normalized !== "IMAGE") {
      return unavailable(media.providerMediaId, "VISUAL_FORMAT_UNSUPPORTED");
    }
    const visual = await this.imagePipeline.execute({
      brandProfileId: input.brandProfileId,
      integrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      mediaId: media.providerMediaId,
      acquisitionMediaId,
      locatorKind,
      inspectionDepth,
      executionProfile,
      ...(visualContext ? { visualContext } : {}),
      selection: "SELECTED",
      now,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return {
      providerMediaId: media.providerMediaId,
      selected: true,
      visualInspection: visual.visualInspection,
      visualSemanticResult: visual.visualSemanticResult,
      reason: visual.reasonCode,
    };
  }
}

function selectRepresentativeChild(
  children: InstagramCarouselChildrenTruth | undefined,
) {
  return children?.children
    .filter(
      (child) => observedString(child.mediaType)?.toUpperCase() === "IMAGE",
    )
    .sort(
      (a, b) =>
        a.ordinal - b.ordinal ||
        a.providerMediaId.localeCompare(b.providerMediaId),
    )[0];
}

function boundedChildren(children: InstagramCarouselChildrenTruth) {
  return {
    availability: children.availability,
    stopReason: children.stopReason,
    representativeRuleVersion: INSTAGRAM_B3B_CAROUSEL_REPRESENTATIVE_VERSION,
    children: [...children.children]
      .sort(
        (a, b) =>
          a.ordinal - b.ordinal ||
          a.providerMediaId.localeCompare(b.providerMediaId),
      )
      .map((child) => ({
        providerMediaId: child.providerMediaId,
        ordinal: child.ordinal,
        mediaType: child.mediaType,
        mediaProductType: child.mediaProductType,
      })),
  };
}

function lightVisualCoverage(
  media: InstagramMediaTruth,
  selection: unknown,
  children: InstagramCarouselChildrenTruth | undefined,
) {
  if (!selection) {
    return {
      coverage: "NOT_INSPECTED",
      inspection: "NOT_INSPECTED",
      reason: "MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS",
    } as const;
  }
  const mediaType = observedString(media.mediaType)?.toUpperCase();
  if (mediaType === "CAROUSEL_ALBUM" && !selectRepresentativeChild(children)) {
    return {
      coverage: "UNAVAILABLE",
      inspection: "UNAVAILABLE",
      reason: "CAROUSEL_REPRESENTATIVE_UNAVAILABLE",
    } as const;
  }
  if (
    !mediaType ||
    !["IMAGE", "CAROUSEL_ALBUM", "REEL", "REELS", "VIDEO"].includes(mediaType)
  ) {
    return {
      coverage: "UNAVAILABLE",
      inspection: "UNAVAILABLE",
      reason: "VISUAL_FORMAT_UNSUPPORTED",
    } as const;
  }
  return {
    coverage: "SELECTED_FOR_INSPECTION",
    inspection: "PENDING",
    reason: "DEEP_SELECTION",
  } as const;
}

function boundedCaption(field: InstagramField<string>) {
  if (field.state !== "OBSERVED" && field.state !== "EXPLICIT_EMPTY")
    return field;
  const sourceContent = field.value.slice(0, MAX_CAPTION_CHARS);
  return {
    state: field.state,
    sourceContent,
    sourceHash: digest(field.value),
    truncated: field.value.length > MAX_CAPTION_CHARS,
  };
}

function observedString(field: InstagramField<string>): string | null {
  return field.state === "OBSERVED" ? field.value : null;
}

function readIdentity(input: ExecutionInput) {
  return {
    brandProfileId: input.brandProfileId,
    integrationId: input.integrationId,
    expectedProviderAccountId: input.providerAccountId,
    expectedAuthorizationGeneration: input.authorizationGeneration,
  };
}

function writerBase(
  input: ExecutionInput,
  mediaId: string | undefined,
  lane: string,
  capturedAt: string,
  now: () => Date,
) {
  const identity = `${input.providerAccountId}:${input.authorizationGeneration}:${mediaId ?? "account"}:${lane}:${input.windowEnd.toISOString()}`;
  return {
    brandId: input.brandProfileId,
    providerAccountId: input.providerAccountId,
    authorizationGeneration: input.authorizationGeneration,
    ...(mediaId ? { mediaId } : {}),
    requestKey: `b3b:${lane}:${digest(identity)}`,
    providerExecutionRef: `provider-execution:instagram:${digest(identity)}`,
    normalizationContractVersion: INSTAGRAM_B3B_NORMALIZATION_VERSION,
    startedAt: capturedAt,
    completedAt: now().toISOString(),
    capturedAt,
  };
}

function unavailable(providerMediaId: string, reason: string) {
  return {
    providerMediaId,
    selected: true,
    visualInspection: "UNAVAILABLE" as const,
    visualSemanticResult: "UNKNOWN" as const,
    reason,
  };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

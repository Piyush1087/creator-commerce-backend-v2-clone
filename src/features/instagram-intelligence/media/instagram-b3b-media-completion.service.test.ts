import { describe, expect, it, vi } from "vitest";

import type {
  InstagramField,
  InstagramMediaTruth,
} from "../../instagram/instagram-intelligence-provider.types";
import { InstagramB3bMediaCompletionService } from "./instagram-b3b-media-completion.service";

const observed = <T>(value: T): InstagramField<T> => ({
  state: "OBSERVED",
  value,
});

function media(index: number, type = "IMAGE"): InstagramMediaTruth {
  return {
    providerMediaId: `media-${String(index).padStart(2, "0")}`,
    mediaType: observed(type),
    mediaProductType: observed("FEED"),
    permalink: { state: "UNAVAILABLE", reason: "FIELD_ABSENT" },
    caption:
      index === 0
        ? { state: "EXPLICIT_EMPTY", value: "" }
        : index === 1
          ? { state: "UNAVAILABLE", reason: "FIELD_ABSENT" }
          : observed(`caption ${index}`),
    timestamp: observed(
      new Date(Date.UTC(2026, 8, 11) - index * 3_600_000).toISOString(),
    ),
  };
}

describe("B3B thinner media completion", () => {
  it("persists every eligible light record, selects 24, bypasses unselected media, and uses one carousel child plus cover-only video", async () => {
    const items = Array.from({ length: 26 }, (_, index) => media(index));
    items[20] = media(20, "CAROUSEL_ALBUM");
    items[21] = media(21, "REEL");
    items.push({
      ...media(99),
      providerMediaId: "missing-time",
      timestamp: {
        state: "UNAVAILABLE",
        reason: "MISSING_OR_INVALID_TIMESTAMP",
      },
    });
    const reads = {
      execute: vi.fn(async ({ command }) => {
        if (command.kind === "MEDIA_INVENTORY")
          return {
            result: {
              availability: "PARTIAL",
              items,
              coverage: {
                windowStart: "2026-08-12T00:00:00.000Z",
                windowEnd: "2026-09-11T00:00:00.000Z",
                pagesAttempted: 2,
                pagesCompleted: 1,
                rowsReturned: 27,
                rowsEligible: 26,
                rowsMissingTimestamp: 1,
                duplicatesDiscarded: 0,
                oldestObservedTimestamp: "2026-09-09T23:00:00.000Z",
                newestObservedTimestamp: "2026-09-11T00:00:00.000Z",
                stopReason: "PROVIDER_FAILURE",
              },
            },
          };
        if (command.kind === "CAROUSEL_CHILDREN")
          return {
            result: {
              availability: "AVAILABLE",
              stopReason: "EXHAUSTED",
              children: [
                {
                  providerMediaId: "child-video",
                  ordinal: 0,
                  mediaType: observed("VIDEO"),
                  mediaProductType: observed("FEED"),
                },
                {
                  providerMediaId: "child-image",
                  ordinal: 1,
                  mediaType: observed("IMAGE"),
                  mediaProductType: observed("FEED"),
                },
              ],
            },
          };
        return {
          result: {
            availability: "AVAILABLE",
            mediaType: command.mediaType,
            metrics: {
              comments: { state: "OBSERVED_ZERO", value: 0 },
              likes: {
                state: "UNAVAILABLE",
                reason: "PROVIDER_DID_NOT_RETURN_METRIC",
              },
              reach: {
                state: "UNSUPPORTED",
                reason: "METRIC_FORMAT_PAIR_UNSUPPORTED",
              },
            },
          },
        };
      }),
    };
    const writer = { write: vi.fn().mockResolvedValue({}) };
    const pipeline = {
      execute: vi.fn().mockResolvedValue({
        visualInspection: "INSPECTED",
        visualSemanticResult: "AVAILABLE",
        reasonCode: "INSPECTED",
      }),
    };
    const service = new InstagramB3bMediaCompletionService(
      reads as never,
      writer as never,
      pipeline as never,
    );
    const result = await service.execute({
      brandProfileId: "brand-a",
      integrationId: "integration-a",
      providerAccountId: "account-a",
      authorizationGeneration: 3,
      windowEnd: new Date("2026-09-11T00:00:00.000Z"),
      now: () => new Date("2026-09-11T00:00:01.000Z"),
    });

    expect(result).toMatchObject({
      eligibleCount: 26,
      selectedCount: 24,
      missingTimestampCount: 1,
    });
    expect(writer.write).toHaveBeenCalledTimes(27);
    expect(pipeline.execute).toHaveBeenCalledTimes(24);
    expect(pipeline.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: "media-20",
        acquisitionMediaId: "child-image",
        locatorKind: "CAROUSEL_CHILD",
        inspectionDepth: "CAROUSEL_REPRESENTATIVE_ONLY",
      }),
    );
    expect(pipeline.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: "media-21",
        acquisitionMediaId: "media-21",
        locatorKind: "VIDEO_COVER",
        inspectionDepth: "COVER_ONLY",
        visualContext: {
          limitations: [
            "VIDEO_NOT_ANALYZED",
            "AUDIO_NOT_ANALYZED",
            "TRANSCRIPT_NOT_ACQUIRED",
          ],
        },
      }),
    );
    const unselected = result.media.filter((row) => !row.selected);
    expect(unselected).toHaveLength(2);
    expect(
      unselected.every(
        (row) =>
          row.visualInspection === "NOT_INSPECTED" &&
          row.visualSemanticResult === "UNKNOWN" &&
          row.reason === "MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS",
      ),
    ).toBe(true);
    expect(JSON.stringify(writer.write.mock.calls)).not.toMatch(
      /NO_CREATOR|NO_OFFERING|NO_COLLAB_SIGNAL|NOT_PRESENT/,
    );

    const lightPayloads = writer.write.mock.calls
      .slice(1)
      .map(([call]) => call.artifacts[0].payload);
    expect(lightPayloads[0].caption).toMatchObject({
      state: "EXPLICIT_EMPTY",
      sourceContent: "",
    });
    expect(lightPayloads[1].caption).toEqual({
      state: "UNAVAILABLE",
      reason: "FIELD_ABSENT",
    });
    expect(lightPayloads[0].metrics.comments).toEqual({
      state: "OBSERVED_ZERO",
      value: 0,
    });
    expect(lightPayloads[0].metrics.likes).toEqual({
      state: "UNAVAILABLE",
      reason: "PROVIDER_DID_NOT_RETURN_METRIC",
    });
  });

  it("chooses the same representative child regardless of incidental child order", async () => {
    const calls: unknown[] = [];
    for (const children of [
      [
        {
          providerMediaId: "b",
          ordinal: 1,
          mediaType: observed("IMAGE"),
          mediaProductType: observed("FEED"),
        },
        {
          providerMediaId: "a",
          ordinal: 0,
          mediaType: observed("IMAGE"),
          mediaProductType: observed("FEED"),
        },
      ],
      [
        {
          providerMediaId: "a",
          ordinal: 0,
          mediaType: observed("IMAGE"),
          mediaProductType: observed("FEED"),
        },
        {
          providerMediaId: "b",
          ordinal: 1,
          mediaType: observed("IMAGE"),
          mediaProductType: observed("FEED"),
        },
      ],
    ]) {
      const reads = {
        execute: vi.fn(async ({ command }) =>
          command.kind === "MEDIA_INVENTORY"
            ? {
                result: {
                  availability: "AVAILABLE",
                  items: [media(0, "CAROUSEL_ALBUM")],
                  coverage: {
                    windowStart: "2026-08-12T00:00:00.000Z",
                    windowEnd: "2026-09-11T00:00:00.000Z",
                    pagesAttempted: 1,
                    pagesCompleted: 1,
                    rowsReturned: 1,
                    rowsEligible: 1,
                    rowsMissingTimestamp: 0,
                    duplicatesDiscarded: 0,
                    oldestObservedTimestamp: "2026-09-11T00:00:00.000Z",
                    newestObservedTimestamp: "2026-09-11T00:00:00.000Z",
                    stopReason: "EXHAUSTED",
                  },
                },
              }
            : command.kind === "CAROUSEL_CHILDREN"
              ? {
                  result: {
                    availability: "AVAILABLE",
                    stopReason: "EXHAUSTED",
                    children,
                  },
                }
              : {
                  result: {
                    availability: "AVAILABLE",
                    mediaType: "CAROUSEL_ALBUM",
                    metrics: {},
                  },
                },
        ),
      };
      const pipeline = {
        execute: vi.fn().mockResolvedValue({
          visualInspection: "INSPECTED",
          visualSemanticResult: "AVAILABLE",
          reasonCode: "INSPECTED",
        }),
      };
      await new InstagramB3bMediaCompletionService(
        reads as never,
        { write: vi.fn().mockResolvedValue({}) } as never,
        pipeline as never,
      ).execute({
        brandProfileId: "brand-a",
        integrationId: "integration-a",
        providerAccountId: "account-a",
        authorizationGeneration: 1,
        windowEnd: new Date("2026-09-11T00:00:00.000Z"),
      });
      calls.push(pipeline.execute.mock.calls[0][0]);
    }
    expect(calls[0]).toMatchObject({ acquisitionMediaId: "a" });
    expect(calls[1]).toMatchObject({ acquisitionMediaId: "a" });
  });

  it("preserves non-visual carousel Evidence when representative acquisition is unavailable", async () => {
    const carousel = media(0, "CAROUSEL_ALBUM");
    const reads = {
      execute: vi.fn(async ({ command }) => {
        if (command.kind === "MEDIA_INVENTORY")
          return {
            result: {
              availability: "AVAILABLE",
              items: [carousel],
              coverage: inventoryCoverage(),
            },
          };
        if (command.kind === "CAROUSEL_CHILDREN")
          return {
            result: {
              availability: "PARTIAL",
              stopReason: "PROVIDER_FAILURE",
              children: [
                {
                  providerMediaId: "video-child",
                  ordinal: 0,
                  mediaType: observed("VIDEO"),
                  mediaProductType: observed("FEED"),
                },
              ],
            },
          };
        return {
          result: {
            availability: "AVAILABLE",
            mediaType: "CAROUSEL_ALBUM",
            metrics: {},
          },
        };
      }),
    };
    const writer = { write: vi.fn().mockResolvedValue({}) };
    const pipeline = { execute: vi.fn() };
    const result = await new InstagramB3bMediaCompletionService(
      reads as never,
      writer as never,
      pipeline as never,
    ).execute(executionInput());
    expect(result.media[0]).toMatchObject({
      visualSemanticResult: "UNKNOWN",
      reason: "CAROUSEL_REPRESENTATIVE_UNAVAILABLE",
    });
    expect(pipeline.execute).not.toHaveBeenCalled();
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(writer.write.mock.calls[1][0].artifacts[0].payload).toMatchObject({
      visualInspection: "UNAVAILABLE",
      visualReason: "CAROUSEL_REPRESENTATIVE_UNAVAILABLE",
      carouselChildren: { availability: "PARTIAL" },
    });
  });

  it("keeps Reel cover failure UNKNOWN with cover-only limitations and existing light Evidence", async () => {
    const reel = media(0, "REEL");
    const reads = {
      execute: vi.fn(async ({ command }) =>
        command.kind === "MEDIA_INVENTORY"
          ? {
              result: {
                availability: "AVAILABLE",
                items: [reel],
                coverage: inventoryCoverage(),
              },
            }
          : {
              result: {
                availability: "AVAILABLE",
                mediaType: "REEL",
                metrics: {},
              },
            },
      ),
    };
    const writer = { write: vi.fn().mockResolvedValue({}) };
    const pipeline = {
      execute: vi.fn().mockResolvedValue({
        visualInspection: "UNAVAILABLE",
        visualSemanticResult: "UNKNOWN",
        reasonCode: "LOCATOR_UNAVAILABLE",
      }),
    };
    const result = await new InstagramB3bMediaCompletionService(
      reads as never,
      writer as never,
      pipeline as never,
    ).execute(executionInput());
    expect(result.media[0]).toMatchObject({
      visualSemanticResult: "UNKNOWN",
      reason: "LOCATOR_UNAVAILABLE",
    });
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(pipeline.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        locatorKind: "VIDEO_COVER",
        inspectionDepth: "COVER_ONLY",
        visualContext: {
          limitations: [
            "VIDEO_NOT_ANALYZED",
            "AUDIO_NOT_ANALYZED",
            "TRANSCRIPT_NOT_ACQUIRED",
          ],
        },
      }),
    );
  });
});

function executionInput() {
  return {
    brandProfileId: "brand-a",
    integrationId: "integration-a",
    providerAccountId: "account-a",
    authorizationGeneration: 1,
    windowEnd: new Date("2026-09-11T00:00:00.000Z"),
  };
}

function inventoryCoverage() {
  return {
    windowStart: "2026-08-12T00:00:00.000Z",
    windowEnd: "2026-09-11T00:00:00.000Z",
    pagesAttempted: 1,
    pagesCompleted: 1,
    rowsReturned: 1,
    rowsEligible: 1,
    rowsMissingTimestamp: 0,
    duplicatesDiscarded: 0,
    oldestObservedTimestamp: "2026-09-11T00:00:00.000Z",
    newestObservedTimestamp: "2026-09-11T00:00:00.000Z",
    stopReason: "EXHAUSTED" as const,
  };
}

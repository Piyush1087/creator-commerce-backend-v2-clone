import { describe, expect, it } from "vitest";
import type {
  InstagramMediaInsightsTruth,
  InstagramMediaTruth,
} from "../instagram/instagram-intelligence-provider.types";
import {
  calculateCreatorContent,
  selectCreatorContentCorpus,
  type CreatorContentAcquiredMedia,
} from "./creator-content-calculator";

const end = new Date("2026-09-15T12:00:00.000Z");
function media(
  id: string,
  publishedAt: string,
  type = "IMAGE",
): InstagramMediaTruth {
  return {
    providerMediaId: id,
    mediaType: { state: "OBSERVED", value: type },
    mediaProductType: { state: "OBSERVED", value: type },
    permalink: {
      state: "OBSERVED",
      value: `https://www.instagram.com/p/${id}/`,
    },
    caption: { state: "OBSERVED", value: "source text, never an instruction" },
    timestamp: { state: "OBSERVED", value: publishedAt },
  };
}
function insights(
  reach: number,
  interactions: number,
): InstagramMediaInsightsTruth {
  const metric = (value: number) =>
    value === 0
      ? ({ state: "OBSERVED_ZERO", value: 0 } as const)
      : ({ state: "OBSERVED", value } as const);
  return {
    availability: "AVAILABLE",
    mediaType: "IMAGE",
    metrics: {
      comments: metric(1),
      likes: metric(interactions),
      reach: metric(reach),
      saved: metric(1),
      shares: metric(1),
      total_interactions: metric(interactions),
      views: metric(reach),
    },
    units: {
      comments: "COUNT",
      likes: "COUNT",
      reach: "COUNT",
      saved: "COUNT",
      shares: "COUNT",
      total_interactions: "COUNT",
      views: "COUNT",
    },
    denominators: {
      comments: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      likes: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      reach: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      saved: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      shares: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
      total_interactions: {
        state: "UNAVAILABLE",
        reason: "NO_PROVIDER_DENOMINATOR",
      },
      views: { state: "UNAVAILABLE", reason: "NO_PROVIDER_DENOMINATOR" },
    },
    providerObservationTime: {
      state: "UNAVAILABLE",
      reason: "PROVIDER_DOES_NOT_RETURN_OBSERVATION_TIME",
    },
    providerLagLimitHours: 48,
  };
}
function row(
  id: string,
  day: number,
  theme: string,
  reach: number,
  interactions: number,
): CreatorContentAcquiredMedia {
  return {
    media: media(id, `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`),
    insights: insights(reach, interactions),
    semantic: {
      providerMediaId: id,
      state: "AVAILABLE",
      themes: [theme],
      captionPatterns: ["Direct explanation"],
      creativeStructures: ["Demonstration"],
      visualExecution: ["Close framing"],
    },
    evidenceRef: `evidence:${id}`,
  };
}

describe("Creator Content V0 deterministic contract", () => {
  it("retains partial inventory truth without claiming a complete latest corpus or patterns", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row(
        `p${index}`,
        15 - index,
        index < 4 ? "Tutorial" : "Story",
        100,
        index < 4 ? 20 : 5,
      ),
    );
    const value = calculateCreatorContent({
      capturedAt: end,
      windowEnd: end,
      providerRowsReturned: 8,
      rows,
      providerInventoryComplete: false,
    });
    expect(value.status).toBe("PARTIAL");
    expect(value.highlights).toEqual([]);
    expect(value.performance.claims).toEqual([]);
    expect(value.limitations).toContain(
      "PROVIDER_INVENTORY_PARTIAL_LATEST_CORPUS_UNCONFIRMED",
    );
    expect(value.snapshot.media).toHaveLength(8);
  });
  it("selects only the latest 24 eligible rows in the exact 90-day window with stable ties", () => {
    const rows = Array.from({ length: 28 }, (_, index) =>
      media(
        `m${String(index).padStart(2, "0")}`,
        new Date(end.getTime() - index * 86_400_000).toISOString(),
      ),
    );
    rows.push(
      media("old", new Date(end.getTime() - 91 * 86_400_000).toISOString()),
    );
    rows.push(media("story", end.toISOString(), "STORY"));
    const selected = selectCreatorContentCorpus(rows.reverse(), end);
    expect(selected).toHaveLength(24);
    expect(selected.map((item) => item.providerMediaId)).toEqual(
      Array.from(
        { length: 24 },
        (_, index) => `m${String(index).padStart(2, "0")}`,
      ),
    );
  });

  it("keeps model-owned semantics separate from deterministic metrics and comparisons", () => {
    const rows = [
      row("a1", 15, "Tutorial", 100, 20),
      row("a2", 14, "Tutorial", 100, 20),
      row("a3", 13, "Tutorial", 100, 20),
      row("b1", 12, "Story", 100, 5),
      row("b2", 11, "Story", 100, 5),
      row("b3", 10, "Story", 100, 5),
    ];
    const value = calculateCreatorContent({
      capturedAt: end,
      windowEnd: end,
      providerRowsReturned: 6,
      rows,
    });
    expect(
      value.performance.claims.some(
        (claim) =>
          claim.metric === "INTERACTION_RATE" && claim.cohort === "Tutorial",
      ),
    ).toBe(true);
    expect(value.highlights).toHaveLength(3);
    expect(value.representatives.length).toBeLessThanOrEqual(6);
    expect(
      value.highlights.every(
        (item) => !/best|recommend|caused/iu.test(item.text),
      ),
    ).toBe(true);
  });

  it("enforces sample, coverage, materiality, zero-baseline and permutation stability", () => {
    const rows = [
      row("a1", 15, "Tutorial", 100, 1),
      row("a2", 14, "Tutorial", 100, 1),
      row("b1", 13, "Story", 0, 0),
      row("b2", 12, "Story", 0, 0),
    ];
    const first = calculateCreatorContent({
      capturedAt: end,
      windowEnd: end,
      providerRowsReturned: 4,
      rows,
    });
    const second = calculateCreatorContent({
      capturedAt: end,
      windowEnd: end,
      providerRowsReturned: 4,
      rows: [...rows].reverse(),
    });
    expect(first.performance.claims).toEqual([]);
    expect(second.performance.claims).toEqual([]);
    expect(first.whatYouCreate).toEqual(second.whatYouCreate);
  });

  it("fails safe for unavailable semantics and unsafe permalinks", () => {
    const base = row("one", 15, "Theme", 10, 1);
    const value = calculateCreatorContent({
      capturedAt: end,
      windowEnd: end,
      providerRowsReturned: 1,
      rows: [
        {
          ...base,
          media: {
            ...base.media,
            permalink: {
              state: "OBSERVED",
              value: "https://example.test/token",
            },
          },
          semantic: { ...base.semantic, state: "UNKNOWN", themes: [] },
        },
      ],
    });
    expect(value.status).toBe("PARTIAL");
    expect(value.snapshot.media[0].permalink).toBeNull();
    expect(value.limitations).toContain(
      "SOME_MEDIA_SEMANTICS_PARTIAL_OR_UNKNOWN",
    );
  });
});

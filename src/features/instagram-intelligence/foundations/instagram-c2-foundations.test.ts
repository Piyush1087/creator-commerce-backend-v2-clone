import { describe, expect, it } from "vitest";

import { exactMedian, exactRatio } from "./instagram-c2-exact-arithmetic";
import {
  buildC2InputManifest,
  calculateAudienceFoundations,
  calculateC2Foundations,
  calculateMetricAggregates,
  calculateSnapshotChange,
  compareAudienceDistributions,
  type C2EvidenceInput,
  type C2InputSnapshot,
  type C2MediaInput,
} from "./instagram-c2-foundations";

const at = "2026-09-12T00:00:00.000Z";
const media = (
  id: string,
  format: string,
  publishedAt: string | undefined,
  metrics: C2MediaInput["metrics"],
  selected = true,
): C2EvidenceInput => ({
  evidenceRef: `evidence:${id}`,
  captureRef: `capture:${id}`,
  capturedAt: at,
  capabilityId: "instagram.media_inventory",
  payload: {
    providerMediaId: id,
    mediaType: { state: "OBSERVED", value: format },
    publishedTimestamp: publishedAt
      ? { state: "OBSERVED", value: publishedAt }
      : { state: "UNAVAILABLE" },
    caption: { state: id === "one" ? "EXPLICIT_EMPTY" : "OBSERVED" },
    visualInspection: selected ? "INSPECTED" : "NOT_INSPECTED",
    selection: { selectionRank: selected ? 1 : null },
    metrics,
  },
});
const inventory: C2EvidenceInput = {
  evidenceRef: "evidence:inventory",
  captureRef: "capture:inventory",
  capturedAt: at,
  capabilityId: "instagram.media_inventory",
  payload: {
    coverage: {
      rowsReturned: 5,
      rowsMissingTimestamp: 1,
      stopReason: "CAP_REACHED",
    },
  },
};
function snapshot(evidence: readonly C2EvidenceInput[]): C2InputSnapshot {
  return {
    brandId: "brand-a",
    providerAccountId: "account-a",
    authorizationGeneration: 4,
    sourceClass: "INSTAGRAM_OWNED",
    executionCutoff: "2026-09-12T00:00:01.000Z",
    windowStart: "2026-08-13T00:00:00.000Z",
    windowEnd: at,
    evidence,
  };
}

describe("Instagram C2 deterministic foundations", () => {
  it("uses exact six-place half-up arithmetic without negative zero", () => {
    expect(exactRatio(1, 3)?.decimal).toBe("0.333333");
    expect(exactRatio(2, 3)?.decimal).toBe("0.666667");
    expect(exactRatio(-1, 10_000_000)?.decimal).toBe("0.000000");
    expect(exactMedian([1, 2])?.decimal).toBe("1.500000");
    expect(exactMedian([1, 2, 9])?.decimal).toBe("2.000000");
    expect(exactMedian([])).toBeNull();
  });

  it("projects the inclusive window, all formats, intervals, shares, captions and visual coverage", () => {
    const result = calculateC2Foundations(
      snapshot([
        inventory,
        media("one", "IMAGE", "2026-08-13T00:00:00.000Z", {}),
        media("two", "CAROUSEL_ALBUM", "2026-08-20T00:00:00.000Z", {}, false),
        media("three", "REEL", "2026-09-01T00:00:00.000Z", {}),
        media("four", "VIDEO", at, {}),
        media("missing", "IMAGE", undefined, {}),
      ]),
    );
    expect(result.corpus).toMatchObject({
      inventoryCount: 5,
      eligibleMediaCount: 4,
      missingTimestampCount: 1,
      inventoryPartial: true,
      distinctPublicationDateCount: 4,
      selectedVisualCount: 3,
      unselectedVisualCount: 1,
    });
    expect(result.corpus.formats.map((row) => row.format)).toEqual([
      "CAROUSEL_ALBUM",
      "IMAGE",
      "REEL",
      "VIDEO",
    ]);
    expect(result.corpus.formats[0]?.formatShare?.decimal).toBe("0.250000");
    expect(result.corpus.postingIntervalsSeconds).toHaveLength(3);
  });

  it("keeps unavailable, unsupported, provider-failed, and observed-zero samples distinct", () => {
    const inputs: C2MediaInput[] = [
      {
        evidenceRef: "1",
        providerMediaId: "1",
        format: "IMAGE",
        metrics: { reach: { state: "OBSERVED_ZERO", value: 0 } },
      },
      {
        evidenceRef: "2",
        providerMediaId: "2",
        format: "IMAGE",
        metrics: { reach: { state: "OBSERVED", value: 5 } },
      },
      {
        evidenceRef: "3",
        providerMediaId: "3",
        format: "REEL",
        metrics: { reach: { state: "UNSUPPORTED" } },
      },
      {
        evidenceRef: "4",
        providerMediaId: "4",
        format: "REEL",
        metrics: { reach: { state: "PROVIDER_FAILURE" } },
      },
      {
        evidenceRef: "5",
        providerMediaId: "5",
        format: "VIDEO",
        metrics: { reach: { state: "UNAVAILABLE" } },
      },
    ];
    const aggregate = calculateMetricAggregates(inputs).find(
      (row) => row.cohort === "ALL_ELIGIBLE" && row.metric === "reach",
    );
    expect(aggregate).toMatchObject({
      eligibleSampleSize: 5,
      supportedSampleSize: 4,
      availableSampleSize: 2,
      unavailableCount: 1,
      unsupportedCount: 1,
      providerFailureCount: 1,
      observedZeroCount: 1,
      sum: "5",
      minimum: "0",
      maximum: "5",
    });
    expect(aggregate?.arithmeticMean?.decimal).toBe("2.500000");
    expect(aggregate?.median?.decimal).toBe("2.500000");
    expect(calculateMetricAggregates([]).every((row) => row.sum === null)).toBe(
      true,
    );
  });

  it("never reconstructs total interactions and handles each reach denominator state", () => {
    const result = calculateC2Foundations(
      snapshot([
        media("good", "IMAGE", at, {
          reach: { state: "OBSERVED", value: 3 },
          likes: { state: "OBSERVED", value: 1 },
        }),
        media("zero", "IMAGE", at, {
          reach: { state: "OBSERVED_ZERO", value: 0 },
          likes: { state: "OBSERVED_ZERO", value: 0 },
        }),
        media("unsupported", "REEL", at, {
          reach: { state: "UNSUPPORTED" },
          likes: { state: "OBSERVED", value: 1 },
        }),
        media("failed", "VIDEO", at, {
          reach: { state: "PROVIDER_FAILURE" },
          likes: { state: "OBSERVED", value: 1 },
        }),
      ]),
    );
    const rate = (id: string) =>
      result.mediaRates.find(
        (row) => row.providerMediaId === id && row.numeratorMetric === "likes",
      );
    expect(rate("good")?.ratio?.decimal).toBe("0.333333");
    expect(rate("zero")?.reason).toBe("DENOMINATOR_ZERO");
    expect(rate("unsupported")?.reason).toBe("DENOMINATOR_UNSUPPORTED");
    expect(rate("failed")?.reason).toBe("DENOMINATOR_UNAVAILABLE");
    expect(
      result.metricAggregates.find(
        (row) =>
          row.metric === "total_interactions" && row.cohort === "ALL_ELIGIBLE",
      )?.sum,
    ).toBeNull();
  });

  it("isolates audience populations and rejects partial denominators", () => {
    const fixture = (
      capabilityId: string,
      limitation: unknown,
      complete: boolean,
    ): C2EvidenceInput => ({
      evidenceRef: `evidence:${capabilityId}`,
      captureRef: `capture:${capabilityId}`,
      capturedAt: at,
      capabilityId,
      payload: {
        breakdown: "AGE",
        timeframe: "THIS_MONTH",
        unit: "COUNT",
        limitation,
        partitionComplete: complete,
        values: [
          { dimension: "18-24", value: 25 },
          { dimension: "25-34", value: 75 },
        ],
      },
    });
    const valid = calculateAudienceFoundations([
      fixture("instagram.audience_followers", null, true),
      fixture("instagram.audience_engaged", null, true),
    ]);
    expect(valid[0]?.buckets[0]?.share?.decimal).toBe("0.250000");
    expect(
      compareAudienceDistributions(valid[0]!, valid[1]!).availability,
    ).toBe("AVAILABLE");
    const partial = calculateAudienceFoundations([
      fixture("instagram.audience_followers", "TOP_45_PROVIDER_LIMIT", false),
    ])[0]!;
    expect(partial.denominatorValid).toBe(false);
    expect(partial.buckets.every((row) => row.share === null)).toBe(true);
  });

  it("implements snapshot states and the fourteen-day boundary with explicit generations", () => {
    const rows = [
      {
        observedAt: "2026-08-29T00:00:00.000Z",
        value: 10,
        providerAccountId: "a",
        authorizationGeneration: 1,
        evidenceRef: "e1",
      },
      {
        observedAt: "2026-09-05T00:00:00.000Z",
        value: 15,
        providerAccountId: "a",
        authorizationGeneration: 2,
        evidenceRef: "e2",
      },
      {
        observedAt: at,
        value: 20,
        providerAccountId: "a",
        authorizationGeneration: 2,
        evidenceRef: "e3",
      },
    ];
    expect(calculateSnapshotChange(rows.slice(0, 1)).state).toBe(
      "CURRENT_STATE_ONLY",
    );
    expect(calculateSnapshotChange(rows.slice(0, 2)).state).toBe(
      "FACTUAL_CHANGE_ELIGIBLE",
    );
    expect(calculateSnapshotChange(rows).trendInterpretationEligible).toBe(
      true,
    );
    expect(
      calculateSnapshotChange(rows).authorizationGenerationLineage,
    ).toEqual([1, 2]);
    expect(
      calculateSnapshotChange([
        ...rows,
        { ...rows[0]!, providerAccountId: "b" },
      ]).reason,
    ).toBe("PROVIDER_ACCOUNT_MISMATCH");
  });

  it("is byte-stable under shuffled Evidence and changes identity with changed Evidence", () => {
    const inputs = [
      inventory,
      media("one", "IMAGE", at, { reach: { state: "OBSERVED", value: 10 } }),
    ];
    const first = calculateC2Foundations(snapshot(inputs));
    const shuffled = calculateC2Foundations(snapshot([...inputs].reverse()));
    expect(shuffled.inputManifest).toEqual(first.inputManifest);
    expect(shuffled.canonicalOutput).toBe(first.canonicalOutput);
    expect(shuffled.valueHash).toBe(first.valueHash);
    expect(
      buildC2InputManifest(
        snapshot([{ ...inputs[1]!, evidenceRef: "changed" }]),
      ).inputHash,
    ).not.toBe(first.inputManifest.inputHash);
    expect(first.corpus.eligibleMediaCount).toBe(1);
    expect(JSON.stringify(first)).not.toMatch(
      /"(signal|pattern|learning|recommendation|causalClaim|likelyCollab|creatorRole|offeringPresence|contentTheme|contentStructure)"\s*:/i,
    );
  });
});

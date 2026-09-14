import { describe, expect, it } from "vitest";

import type { InstagramAudienceInsightsTruth } from "../instagram/instagram-intelligence-provider.types";
import { normalizeCreatorAudience } from "./creator-audience-normalizer";

const breakdowns = ["AGE", "GENDER", "COUNTRY", "CITY"] as const;

function result(
  population: "FOLLOWERS" | "ENGAGED_AUDIENCE",
  breakdown: (typeof breakdowns)[number],
  overrides: Partial<InstagramAudienceInsightsTruth> = {},
): InstagramAudienceInsightsTruth {
  return {
    availability: "AVAILABLE",
    population,
    breakdown,
    timeframe: "THIS_MONTH",
    values: [
      { dimension: "A", value: 60 },
      { dimension: "B", value: 40 },
    ],
    denominator: 100,
    limitation: null,
    ...overrides,
  };
}

function acquisition(results: InstagramAudienceInsightsTruth[]) {
  return {
    capturedAt: "2026-09-14T10:00:00.000Z",
    followerCount: { state: "OBSERVED" as const, value: 1000 },
    results,
  };
}

describe("Creator Audience deterministic V0 normalization", () => {
  it("renders both complete cohorts with valid shares and at most three highlights", () => {
    const results = ["FOLLOWERS", "ENGAGED_AUDIENCE"].flatMap((population) =>
      breakdowns.map((breakdown) =>
        result(population as "FOLLOWERS" | "ENGAGED_AUDIENCE", breakdown),
      ),
    );
    const value = normalizeCreatorAudience({
      acquisition: acquisition(results),
      role: "OWNER",
      now: new Date("2026-09-14T11:00:00Z"),
    });
    expect(value.status).toBe("READY");
    expect(value.cohorts).toHaveLength(2);
    expect(value.cohorts[0].dimensions[0].buckets[0].percentage).toBe(60);
    expect(value.highlights.length).toBeLessThanOrEqual(3);
  });

  it("keeps count-only truth when denominator is absent or invalid", () => {
    const value = normalizeCreatorAudience({
      acquisition: acquisition([
        result("FOLLOWERS", "AGE", { denominator: undefined }),
        result("FOLLOWERS", "CITY", { denominator: 50 }),
      ]),
      role: "ASSISTANT",
    });
    expect(value.status).toBe("PARTIAL");
    expect(
      value.cohorts[0].dimensions
        .filter((item) => item.state === "AVAILABLE")
        .every((item) =>
          item.buckets.every((bucket) => bucket.percentage === null),
        ),
    ).toBe(true);
  });

  it("distinguishes observed follower zero from suppressed demographics", () => {
    const value = normalizeCreatorAudience({
      acquisition: {
        ...acquisition([]),
        followerCount: { state: "OBSERVED_ZERO", value: 0 },
      },
      role: "MANAGER",
    });
    expect(value.cohorts[0].size).toBe(0);
    expect(value.cohorts[0].availability).toBe("UNAVAILABLE");
    expect(value.defaultCohort).toBeNull();
  });

  it("preserves provider suppression, top-45 and failure without fabricating zero", () => {
    const value = normalizeCreatorAudience({
      acquisition: acquisition([
        result("FOLLOWERS", "AGE", {
          availability: "UNAVAILABLE",
          values: [],
          denominator: undefined,
          limitation: "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
        }),
        result("FOLLOWERS", "COUNTRY", {
          limitation: "TOP_45_PROVIDER_LIMIT",
        }),
        result("ENGAGED_AUDIENCE", "CITY", {
          availability: "UNAVAILABLE",
          values: [],
          denominator: undefined,
          limitation: null,
          failureClassification: "TRANSIENT",
        }),
      ]),
      role: "OWNER",
    });
    expect(value.status).toBe("PARTIAL");
    expect(value.limitations).toEqual(
      expect.arrayContaining([
        "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
        "TOP_45_PROVIDER_LIMIT",
        "PROVIDER_FAILURE",
      ]),
    );
  });

  it("uses only compatible valid bases for cross-cohort comparisons", () => {
    const value = normalizeCreatorAudience({
      acquisition: acquisition([
        result("FOLLOWERS", "AGE"),
        result("ENGAGED_AUDIENCE", "AGE", {
          values: [
            { dimension: "A", value: 80 },
            { dimension: "B", value: 20 },
          ],
        }),
        result("FOLLOWERS", "CITY", { denominator: undefined }),
        result("ENGAGED_AUDIENCE", "CITY"),
      ]),
      role: "OWNER",
    });
    expect(value.highlights.some((item) => item.id === "cross-age-a")).toBe(
      true,
    );
    expect(
      value.highlights.some((item) => item.id.startsWith("cross-city")),
    ).toBe(false);
  });

  it.each([
    ["FOLLOWERS", "FOLLOWERS"],
    ["ENGAGED_AUDIENCE", "ENGAGED"],
  ] as const)(
    "renders only the usable %s cohort as the default",
    (population, expected) => {
      const value = normalizeCreatorAudience({
        acquisition: acquisition([result(population, "AGE")]),
        role: "OWNER",
      });
      expect(value.defaultCohort).toBe(expected);
      expect(
        value.cohorts.filter((item) => item.availability !== "UNAVAILABLE"),
      ).toHaveLength(1);
      expect(value.status).toBe("PARTIAL");
    },
  );

  it("keeps both cohorts unusable and emits no fabricated highlight", () => {
    const value = normalizeCreatorAudience({
      acquisition: acquisition([]),
      role: "OWNER",
    });
    expect(value.status).toBe("UNAVAILABLE");
    expect(value.defaultCohort).toBeNull();
    expect(value.highlights).toEqual([]);
  });

  it("marks an eight-day-old snapshot stale while preserving deterministic facts", () => {
    const value = normalizeCreatorAudience({
      acquisition: acquisition([result("FOLLOWERS", "AGE")]),
      role: "OWNER",
      now: new Date("2026-09-22T10:00:00.001Z"),
      currentPreserved: true,
    });
    expect(value.freshness).toEqual({ state: "STALE", staleAfterHours: 192 });
    expect(value.currentPreserved).toBe(true);
    expect(value.cohorts[0].dimensions[0].buckets).not.toHaveLength(0);
  });
});

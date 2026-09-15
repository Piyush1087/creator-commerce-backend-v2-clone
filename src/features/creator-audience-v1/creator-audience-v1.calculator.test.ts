import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeCreatorAudience } from "../creator-audience/creator-audience-normalizer";
import {
  calculateAudienceV1,
  type AudienceV1Snapshot,
  type AudienceV1Content,
} from "./creator-audience-v1.calculator";
import { audienceV1VerifiedContract } from "./creator-audience-v1.runtime";
import { StructuralValidator } from "../brand-intelligence/contracts/validation/structural.validator";

function snapshot(at: string, share = 60): AudienceV1Snapshot {
  const results = (["FOLLOWERS", "ENGAGED_AUDIENCE"] as const).flatMap(
    (population) =>
      (["AGE", "GENDER", "COUNTRY", "CITY"] as const).map((breakdown) => ({
        availability: "AVAILABLE" as const,
        population,
        breakdown,
        timeframe: "THIS_MONTH" as const,
        denominator: 100,
        values: [
          { dimension: "A", value: share },
          { dimension: "B", value: 100 - share },
        ],
        limitation: null,
      })),
  );
  const evidence = results.map((result) => ({
    evidenceRef: `${at}:${result.population}:${result.breakdown}`,
    captureRef: `capture:${at}`,
    resourceRef: "same-resource",
    capabilityId:
      result.population === "FOLLOWERS"
        ? ("instagram.audience_followers" as const)
        : ("instagram.audience_engaged" as const),
    capturedAt: at,
    contentHash: "a".repeat(64),
  }));
  return {
    objectGenerationId: randomUUID(),
    capturedAt: at,
    providerAccountId: "same-account",
    authorizationGeneration: 1,
    value: normalizeCreatorAudience({
      role: "OWNER",
      now: new Date(at),
      acquisition: {
        capturedAt: at,
        results,
        followerCount: { state: "OBSERVED", value: 1000 },
      },
    }),
    evidence,
    breakdowns: results.map((result, index) => ({
      cohort: result.population === "FOLLOWERS" ? "FOLLOWERS" : "ENGAGED",
      dimension: result.breakdown,
      denominator: 100,
      basis: `${result.population}:${result.breakdown}:THIS_MONTH:explicit`,
      evidenceRef: evidence[index].evidenceRef,
    })),
  };
}
const latest = snapshot("2026-09-15T10:00:00.000Z", 70);
const content: AudienceV1Content = {
  objectGenerationId: randomUUID(),
  capturedAt: latest.capturedAt,
  facts: [
    {
      text: "Theme A appeared across 3 eligible posts.",
      evidenceRefs: ["content-1", "content-2", "content-3"],
    },
  ],
  evidence: ["content-1", "content-2", "content-3"].map((evidenceRef) => ({
    evidenceRef,
    captureRef: "content-capture",
    resourceRef: "content-resource",
    capabilityId: "instagram.media_insights",
    capturedAt: latest.capturedAt,
    contentHash: "b".repeat(64),
  })),
};
function calculate(
  history: Array<AudienceV1Snapshot | null> = [],
  acceptedContent: AudienceV1Content | null = null,
  now = new Date(latest.capturedAt),
) {
  return calculateAudienceV1({
    latest,
    history,
    content: acceptedContent,
    now,
  });
}
describe("Audience V1 deterministic source-native calculator", () => {
  it("verifies the pinned compiled bundle", () => {
    expect(audienceV1VerifiedContract().registration.executionEnabled).toBe(
      true,
    );
  });
  it("runs the strict shape through the shared structural validator", () => {
    const bundle = audienceV1VerifiedContract().bundle;
    const validator = new StructuralValidator();
    expect(validator.validate(bundle, calculate()).valid).toBe(true);
    expect(
      validator.validate(bundle, { ...calculate(), persona: "invented" }).valid,
    ).toBe(false);
  });
  it("keeps account count independent of cohort denominators without cross-joining", () => {
    const value = calculate();
    expect(value.overview.accountFollowerCount).toBe(1000);
    expect(value.profiles.map((row) => row.cohortSize)).toEqual([100, 100]);
    expect(value.profiles.map((row) => row.facts.length)).toEqual([4, 4]);
    expect(
      value.overview.facts.every((row) => row.evidenceRefs.length === 1),
    ).toBe(true);
  });
  it("does not infer demographic size or percentage from account size", () => {
    const row = structuredClone(latest);
    row.breakdowns.forEach((item) => {
      item.denominator = null;
    });
    row.value.cohorts.forEach((cohort) =>
      cohort.dimensions.forEach((dim) => {
        dim.denominatorValid = false;
        dim.buckets.forEach((bucket) => {
          bucket.percentage = null;
        });
      }),
    );
    const value = calculateAudienceV1({
      latest: row,
      history: [],
      content: null,
      now: new Date(latest.capturedAt),
    });
    expect(value.profiles.every((item) => item.cohortSize === null)).toBe(true);
    expect(value.overview.facts.every((item) => item.percentage === null)).toBe(
      true,
    );
    expect(value.overview.accountFollowerCount).toBe(1000);
  });
  it("requires three distinct comparable snapshots spanning 14 days", () => {
    expect(
      calculate([snapshot("2026-09-01T10:00:00.000Z")]).change.observations,
    ).toEqual([]);
    expect(
      calculate([
        snapshot("2026-09-10T10:00:00.000Z"),
        snapshot("2026-09-12T10:00:00.000Z"),
      ]).change.observations,
    ).toEqual([]);
    const value = calculate([
      snapshot("2026-09-01T10:00:00.000Z", 50),
      snapshot("2026-09-08T10:00:00.000Z", 60),
    ]);
    expect(value.change.state).toBe("AVAILABLE");
    expect(value.change.observations).toHaveLength(3);
    expect(value.change.observations[0]).toMatchObject({
      percentagePointDelta: 20,
      snapshotCount: 3,
      elapsedDays: 14,
    });
  });
  it("does not bridge a missing middle snapshot", () => {
    expect(
      calculate([
        snapshot("2026-08-20T10:00:00.000Z"),
        null,
        snapshot("2026-09-08T10:00:00.000Z"),
      ]).change.state,
    ).toBe("SERIES_BREAK");
  });
  it.each(["account", "generation", "basis"] as const)(
    "breaks history at changed %s",
    (kind) => {
      const prior = snapshot("2026-09-01T10:00:00.000Z");
      if (kind === "account") prior.providerAccountId = "other";
      if (kind === "generation") prior.authorizationGeneration = 2;
      if (kind === "basis")
        prior.breakdowns.forEach((row) => {
          row.basis = "other";
        });
      expect(
        calculate([prior, snapshot("2026-09-08T10:00:00.000Z")]).change.state,
      ).toBe("SERIES_BREAK");
    },
  );
  it("does not fabricate change from unchanged distributions", () => {
    expect(
      calculate([
        snapshot("2026-09-01T10:00:00.000Z", 70),
        snapshot("2026-09-08T10:00:00.000Z", 70),
      ]).change.state,
    ).toBe("NO_MATERIAL_CHANGE");
  });
  it("keeps Content and Audience separately supported, not preference", () => {
    const value = calculate([], content);
    expect(value.contentContext).toHaveLength(1);
    expect(value.contentContext[0].interpretation).toBe(
      "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
    );
    expect(value.contentContext[0].audienceFact.evidenceRefs).not.toEqual(
      value.contentContext[0].contentFact.evidenceRefs,
    );
    expect(value.highlights).toEqual(latest.value.highlights);
  });
  it("omits Content at 48h and marks Audience stale at 192h", () => {
    expect(
      calculate(
        [],
        content,
        new Date(Date.parse(latest.capturedAt) + 48 * 3_600_000),
      ).contentContext,
    ).toEqual([]);
    const value = calculate(
      [],
      content,
      new Date(Date.parse(latest.capturedAt) + 192 * 3_600_000),
    );
    expect(value.freshness.state).toBe("STALE");
    expect(value.contentContext).toEqual([]);
    expect(value.overview.facts).toHaveLength(8);
  });
});

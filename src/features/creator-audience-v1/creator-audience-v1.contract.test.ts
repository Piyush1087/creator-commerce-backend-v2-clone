import { describe, expect, it } from "vitest";
import {
  AudienceV1ConsumerSchema,
  AudienceV1ManifestSchema,
  audienceV1ReplayKey,
  AUDIENCE_V1_PATHS,
} from "./creator-audience-v1.contract";
import { normalizeCreatorAudience } from "../creator-audience/creator-audience-normalizer";

const baseline = normalizeCreatorAudience({
  acquisition: {
    capturedAt: "2026-09-15T12:00:00.000Z",
    followerCount: { state: "UNAVAILABLE", reason: "UNAVAILABLE" },
    results: [],
  },
  role: "OWNER",
});
const value = {
  ...baseline,
  contractVersion: "creator_audience_v1.1",
  overview: { accountFollowerCount: null, facts: [] },
  profiles: [],
  contentContext: [],
  change: { state: "INSUFFICIENT_COMPARABLE_HISTORY", observations: [] },
};
describe("Audience V1 P0 exact Product V2 contract", () => {
  const observed = normalizeCreatorAudience({
    acquisition: {
      capturedAt: baseline.generatedAt,
      followerCount: { state: "OBSERVED", value: 1000 },
      results: (["FOLLOWERS", "ENGAGED_AUDIENCE"] as const).flatMap(
        (population) =>
          (["AGE", "GENDER", "COUNTRY", "CITY"] as const).map((breakdown) => ({
            availability: "AVAILABLE" as const,
            population,
            breakdown,
            timeframe: "THIS_MONTH" as const,
            denominator: 100,
            values: [
              { dimension: "A", value: 60 },
              { dimension: "B", value: 40 },
            ],
            limitation: null,
          })),
      ),
    },
    role: "OWNER",
  });
  const sourceFact = {
    cohort: "FOLLOWERS" as const,
    dimension: "AGE" as const,
    bucket: "A",
    count: 60,
    percentage: 60,
    evidenceRefs: ["accepted-evidence"],
  };
  const factual = {
    ...value,
    ...observed,
    contractVersion: "creator_audience_v1.1",
    overview: { accountFollowerCount: 1000, facts: [sourceFact] },
    profiles: [
      {
        cohort: "FOLLOWERS",
        cohortSize: 100,
        facts: [sourceFact],
        coverage: { availableDimensions: 4, requiredDimensions: 4 },
        limitations: [],
      },
    ],
  };
  it("admits independent source facts, not a demographic join or account-count cohort", () => {
    const parsed = AudienceV1ConsumerSchema.parse(factual);
    expect(parsed.overview.accountFollowerCount).toBe(1000);
    expect(parsed.profiles[0].cohortSize).toBe(100);
    expect(parsed.profiles[0].facts[0].dimension).toBe("AGE");
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...factual,
        overview: {
          accountFollowerCount: 9999,
          facts: [sourceFact],
        },
      }).success,
    ).toBe(false);
  });
  it("rejects fabricated fact values and percentages without exact source basis", () => {
    for (const change of [
      { count: 999 },
      { percentage: 99 },
      { bucket: "synthetic-person" },
      { dimension: "AGE_GENDER_COUNTRY" },
    ])
      expect(
        AudienceV1ConsumerSchema.safeParse({
          ...factual,
          overview: {
            accountFollowerCount: 1000,
            facts: [{ ...sourceFact, ...change }],
          },
        }).success,
      ).toBe(false);
  });
  it("rejects duplicate cohorts, substituted support cohort and inflated coverage", () => {
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...factual,
        profiles: [factual.profiles[0], factual.profiles[0]],
      }).success,
    ).toBe(false);
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...factual,
        profiles: [
          {
            ...factual.profiles[0],
            cohort: "ENGAGED",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...factual,
        profiles: [
          {
            ...factual.profiles[0],
            coverage: { availableDimensions: 3, requiredDimensions: 4 },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("does not admit stale Audience/Content context as current", () => {
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...factual,
        freshness: { state: "STALE", staleAfterHours: 192 },
        contentContext: [
          {
            audienceFact: sourceFact,
            contentFact: {
              text: "Accepted Content fact",
              evidenceRefs: ["content-evidence"],
              capturedAt: observed.generatedAt,
            },
            interpretation: "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("strictly admits factual no-current without fabricated zero", () => {
    expect(
      AudienceV1ConsumerSchema.parse(value).overview.accountFollowerCount,
    ).toBeNull();
    for (const forbidden of [
      "persona",
      "brandContext",
      "recommendations",
      "psychographics",
      "mediaKit",
    ])
      expect(
        AudienceV1ConsumerSchema.safeParse({ ...value, [forbidden]: [] })
          .success,
      ).toBe(false);
  });
  it("bounds optional highlights/context/profiles/history and rejects history without sufficiency", () => {
    expect(AUDIENCE_V1_PATHS).toHaveLength(4);
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...value,
        contentContext: [{}, {}, {}],
      }).success,
    ).toBe(false);
    expect(
      AudienceV1ConsumerSchema.safeParse({
        ...value,
        change: { state: "SERIES_BREAK", observations: [{}] },
      }).success,
    ).toBe(false);
    expect(
      AudienceV1ManifestSchema.safeParse({
        kind: "CREATOR_AUDIENCE_V1_MANIFEST",
        identity: {},
        evidence: [],
      }).success,
    ).toBe(false);
  });
  it("binds each source and evaluation/profile identity deterministically", () => {
    const identity = {
      ownerScopeId: "11111111-1111-4111-8111-111111111111",
      creatorProfileId: "22222222-2222-4222-8222-222222222222",
      creatorWorkspaceId: "33333333-3333-4333-8333-333333333333",
      integrationId: "44444444-4444-4444-8444-444444444444",
      providerAccountId: "fixture-account",
      authorizationGeneration: 1,
      captureRef: "capture",
      resourceRef: "resource",
      audienceObjectGenerationId: "55555555-5555-4555-8555-555555555555",
      contentObjectGenerationId: null,
      historyObjectGenerationIds: [],
      inputHash: "abc",
      evaluationTime: "2026-09-15T12:00:00.000Z",
    };
    expect(audienceV1ReplayKey(identity)).toBe(
      audienceV1ReplayKey({ ...identity }),
    );
    for (const key of [
      "ownerScopeId",
      "creatorProfileId",
      "creatorWorkspaceId",
      "integrationId",
      "providerAccountId",
      "authorizationGeneration",
      "captureRef",
      "resourceRef",
      "audienceObjectGenerationId",
      "contentObjectGenerationId",
      "historyObjectGenerationIds",
      "inputHash",
      "evaluationTime",
    ] as const)
      expect(
        audienceV1ReplayKey({
          ...identity,
          [key]: String(identity[key]) + "changed",
        } as typeof identity),
      ).not.toBe(audienceV1ReplayKey(identity));
  });
});

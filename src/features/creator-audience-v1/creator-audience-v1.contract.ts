import { z } from "zod";
import { CreatorAudienceConsumerSchema } from "../creator-audience/contracts/creator-audience-v0.contract";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";

export const AUDIENCE_V1_VERSION = "creator_audience_v1.1" as const;
export const AUDIENCE_V1_PRODUCT_COMMIT =
  "27140fdf6cf522419146c3e7a147169b36a33e5e";
export const AUDIENCE_V1_PRODUCT_BLOB =
  "b32f800dc976ca55a75d417ff9db7b807bf50ea6";
export const AUDIENCE_V1_PATHS = [
  "$/f/audience_overview",
  "$/f/audience_profiles",
  "$/f/audience_content_context",
  "$/f/audience_change",
] as const;
export const AUDIENCE_V1_PROCESSOR = "creator_audience_v1" as const;
export const AUDIENCE_V1_MAX_HISTORY = 64;
const ref = z.string().trim().min(1).max(255);
const refs = z.array(ref).min(1).max(64);
const text = z.string().trim().min(1).max(240);
const cohort = z.enum(["FOLLOWERS", "ENGAGED"]);
const dimension = z.enum(["AGE", "GENDER", "COUNTRY", "CITY"]);
const fact = z
  .object({
    cohort,
    dimension,
    bucket: z.string().min(1).max(100),
    count: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100).nullable(),
    evidenceRefs: refs,
  })
  .strict();
export const AudienceV1ConsumerSchema = CreatorAudienceConsumerSchema.extend({
  contractVersion: z.literal(AUDIENCE_V1_VERSION),
  overview: z
    .object({
      accountFollowerCount: z.number().int().nonnegative().nullable(),
      facts: z.array(fact).max(8),
    })
    .strict(),
  profiles: z
    .array(
      z
        .object({
          cohort,
          cohortSize: z.number().int().nonnegative().nullable(),
          facts: z.array(fact).max(4),
          coverage: z
            .object({
              availableDimensions: z.number().int().min(0).max(4),
              requiredDimensions: z.literal(4),
            })
            .strict(),
          limitations: z.array(text).max(16),
        })
        .strict(),
    )
    .max(2),
  contentContext: z
    .array(
      z
        .object({
          audienceFact: fact,
          contentFact: z
            .object({
              text,
              evidenceRefs: refs,
              capturedAt: z.string().datetime(),
            })
            .strict(),
          interpretation: z.literal(
            "SEPARATE_SOURCE_FACTS_NOT_AUDIENCE_PREFERENCE",
          ),
        })
        .strict(),
    )
    .max(2),
  change: z
    .object({
      state: z.enum([
        "NOT_PROCESSED",
        "AVAILABLE",
        "INSUFFICIENT_COMPARABLE_HISTORY",
        "SERIES_BREAK",
        "NO_MATERIAL_CHANGE",
      ]),
      observations: z
        .array(
          z
            .object({
              cohort,
              dimension,
              bucket: z.string().min(1).max(100),
              priorPercentage: z.number().min(0).max(100),
              latestPercentage: z.number().min(0).max(100),
              percentagePointDelta: z.number().min(-100).max(100),
              snapshotCount: z
                .number()
                .int()
                .min(3)
                .max(AUDIENCE_V1_MAX_HISTORY),
              elapsedDays: z.number().int().min(14),
              priorCapturedAt: z.string().datetime(),
              latestCapturedAt: z.string().datetime(),
              evidenceRefs: refs,
            })
            .strict(),
        )
        .max(3),
    })
    .strict(),
})
  .strict()
  .superRefine((value, ctx) => {
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      value.overview.accountFollowerCount !==
      (value.cohorts.find((row) => row.id === "FOLLOWERS")?.size ?? null)
    )
      fail("Account follower count requires accepted source truth");
    if (
      new Set(value.profiles.map((row) => row.cohort)).size !==
      value.profiles.length
    )
      fail("Cohorts remain distinct");
    for (const profile of value.profiles) {
      const source = value.cohorts.find((row) => row.id === profile.cohort);
      if (
        !source ||
        source.availability === "UNAVAILABLE" ||
        profile.facts.some((row) => row.cohort !== profile.cohort) ||
        profile.coverage.availableDimensions !==
          source.dimensions.filter((row) => row.state === "AVAILABLE").length
      )
        fail("Profiles require their own usable source cohort and coverage");
    }
    const currentFacts = [
      ...value.overview.facts,
      ...value.profiles.flatMap((row) => row.facts),
      ...value.contentContext.map((row) => row.audienceFact),
    ];
    for (const item of currentFacts) {
      const source = value.cohorts
        .find((row) => row.id === item.cohort)
        ?.dimensions.find(
          (row) => row.id === item.dimension && row.state === "AVAILABLE",
        );
      const bucket = source?.buckets.find((row) => row.key === item.bucket);
      if (
        !bucket ||
        bucket.count !== item.count ||
        bucket.percentage !== item.percentage ||
        (item.percentage !== null && !source?.denominatorValid)
      )
        fail("Facts require exact independent source dimension support");
    }
    for (const change of value.change.observations) {
      const latest = value.cohorts
        .find((row) => row.id === change.cohort)
        ?.dimensions.find(
          (row) => row.id === change.dimension && row.denominatorValid,
        )
        ?.buckets.find((row) => row.key === change.bucket);
      if (
        latest?.percentage !== change.latestPercentage ||
        new Set(change.evidenceRefs).size !== change.snapshotCount ||
        Date.parse(change.priorCapturedAt) >=
          Date.parse(change.latestCapturedAt) ||
        Math.abs(
          change.percentagePointDelta -
            Math.round(
              (change.latestPercentage - change.priorPercentage) * 10,
            ) /
              10,
        ) > 0.000001
      )
        fail(
          "Change requires exact source percentages, distinct samples and ordered time",
        );
    }
    if (value.change.state !== "AVAILABLE" && value.change.observations.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unavailable history has no observations",
      });
    if (value.freshness.state !== "CURRENT" && value.contentContext.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stale Audience cannot imply current context",
      });
  });
export type AudienceV1Consumer = z.infer<typeof AudienceV1ConsumerSchema>;

export const AudienceV1EvidenceSchema = z
  .object({
    evidenceRef: ref,
    captureRef: ref,
    resourceRef: ref,
    capabilityId: z.enum([
      "instagram.audience_followers",
      "instagram.audience_engaged",
      "instagram.media_insights",
    ]),
    capturedAt: z.string().datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export const AudienceV1IdentitySchema = z
  .object({
    ownerScopeId: z.string().uuid(),
    creatorProfileId: z.string().uuid(),
    creatorWorkspaceId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: z.string().min(1).max(100),
    authorizationGeneration: z.number().int().nonnegative(),
    requestIdentity: ref,
    captureRef: ref,
    resourceRef: ref,
    audienceObjectGenerationId: z.string().uuid(),
    contentObjectGenerationId: z.string().uuid().nullable(),
    historyObjectGenerationIds: z
      .array(z.string().uuid())
      .max(AUDIENCE_V1_MAX_HISTORY),
  })
  .strict();
export const AudienceV1ManifestSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_V1_MANIFEST"),
    identity: AudienceV1IdentitySchema,
    evidence: z.array(AudienceV1EvidenceSchema).min(1).max(536),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.evidence.map((row) => row.evidenceRef)).size !==
      value.evidence.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate Evidence",
      });
  });
export const AudienceV1InputSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_V1_INPUT"),
    value: AudienceV1ConsumerSchema,
  })
  .strict();
export const AudienceV1PayloadSchema = z
  .object({
    kind: z.literal("CREATOR_AUDIENCE_V1_PERSISTENCE"),
    identity: AudienceV1IdentitySchema,
    value: AudienceV1ConsumerSchema,
    evidence: z.array(AudienceV1EvidenceSchema).min(1).max(536),
  })
  .strict();
export type AudienceV1Manifest = z.infer<typeof AudienceV1ManifestSchema>;
export function audienceV1ReplayKey(
  input: Omit<AudienceV1Manifest["identity"], "requestIdentity"> & {
    inputHash: string;
    evaluationTime: string;
  },
): string {
  return `creator-audience-v1:${sha256Canonical({ ...input, profile: AUDIENCE_V1_VERSION, product: AUDIENCE_V1_PRODUCT_BLOB })}`;
}
export function audienceV1EvidenceRefs(
  value: AudienceV1Consumer,
  path?: string,
): string[] {
  const facts =
    path === "$/f/audience_overview"
      ? value.overview.facts
      : path === "$/f/audience_profiles"
        ? value.profiles.flatMap((row) => row.facts)
        : [];
  return [
    ...new Set([
      ...facts.flatMap((row) => row.evidenceRefs),
      ...(!path || path === "$/f/audience_content_context"
        ? value.contentContext.flatMap((row) => [
            ...row.audienceFact.evidenceRefs,
            ...row.contentFact.evidenceRefs,
          ])
        : []),
      ...(!path || path === "$/f/audience_change"
        ? value.change.observations.flatMap((row) => row.evidenceRefs)
        : []),
      ...(!path
        ? [
            ...value.overview.facts.flatMap((row) => row.evidenceRefs),
            ...value.profiles.flatMap((row) =>
              row.facts.flatMap((fact) => fact.evidenceRefs),
            ),
            ...value.highlights.flatMap((row) => row.evidence),
          ]
        : []),
    ]),
  ].sort();
}
export function audienceV1Component(
  value: AudienceV1Consumer,
  path: string,
): unknown {
  if (path === AUDIENCE_V1_PATHS[0]) return value.overview;
  if (path === AUDIENCE_V1_PATHS[1]) return value.profiles;
  if (path === AUDIENCE_V1_PATHS[2]) return value.contentContext;
  if (path === AUDIENCE_V1_PATHS[3]) return value.change;
  throw new Error("AUDIENCE_V1_UNKNOWN_PATH");
}

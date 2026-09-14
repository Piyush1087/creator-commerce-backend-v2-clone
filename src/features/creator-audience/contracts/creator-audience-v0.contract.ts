import { z } from "zod";

export const CREATOR_AUDIENCE_V0_CONTRACT_VERSION =
  "creator_audience_v0.1" as const;
export const CREATOR_AUDIENCE_V0_OBJECT_ID = "creator_audience" as const;
export const CREATOR_AUDIENCE_V0_COMPONENTS = [
  "source_status",
  "audience_highlights",
  "follower_audience",
  "engaged_audience",
  "freshness",
  "limitations",
] as const;
export const CREATOR_AUDIENCE_ROUTE =
  "/api/v1/creator/insights/audience" as const;
export const CREATOR_AUDIENCE_SETTINGS_RECOVERY_ROUTE =
  "/creator/settings/instagram" as const;

export type IntelligenceOwnerScope =
  | Readonly<{ kind: "BRAND"; brandProfileId: string }>
  | Readonly<{
      kind: "CREATOR";
      creatorProfileId: string;
      creatorWorkspaceId: string;
    }>;

export function ownerScopeKey(scope: IntelligenceOwnerScope): string {
  return scope.kind === "BRAND"
    ? `BRAND:${scope.brandProfileId}`
    : `CREATOR:${scope.creatorProfileId}:${scope.creatorWorkspaceId}`;
}

const limitationSchema = z.string().trim().min(1).max(160);
const dimensionSchema = z
  .object({
    id: z.enum(["AGE", "GENDER", "COUNTRY", "CITY"]),
    state: z.enum(["AVAILABLE", "UNAVAILABLE", "PROVIDER_FAILURE"]),
    denominatorValid: z.boolean(),
    buckets: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(100),
            count: z.number().int().nonnegative(),
            percentage: z.number().min(0).max(100).nullable(),
          })
          .strict(),
      )
      .max(45),
    limitations: z.array(limitationSchema).max(8),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.denominatorValid &&
      value.buckets.some((row) => row.percentage !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentages require a valid denominator",
      });
    }
    if (value.state !== "AVAILABLE" && value.buckets.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unavailable dimensions cannot expose buckets",
      });
    }
  });

const cohortSchema = z
  .object({
    id: z.enum(["FOLLOWERS", "ENGAGED"]),
    availability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]),
    size: z.number().int().nonnegative().nullable(),
    dimensions: z.array(dimensionSchema).max(4),
    limitations: z.array(limitationSchema).max(12),
  })
  .strict();

export const CreatorAudienceConsumerSchema = z
  .object({
    contractVersion: z.literal(CREATOR_AUDIENCE_V0_CONTRACT_VERSION),
    generatedAt: z.string().datetime(),
    status: z.enum(["READY", "PARTIAL", "UNAVAILABLE"]),
    context: z
      .object({ role: z.enum(["OWNER", "MANAGER", "ASSISTANT"]) })
      .strict(),
    source: z.literal("INSTAGRAM"),
    sourceStatus: z.enum([
      "CONNECTED",
      "PROCESSING",
      "DISCONNECTED",
      "REAUTH_REQUIRED",
      "CAPABILITY_PARTIAL",
      "CAPABILITY_UNKNOWN",
      "PROVIDER_FAILURE",
    ]),
    snapshotBasis: z
      .object({
        period: z.literal("lifetime"),
        timeframe: z.literal("this_month"),
        capturedAt: z.string().datetime().nullable(),
      })
      .strict(),
    defaultCohort: z.enum(["FOLLOWERS", "ENGAGED"]).nullable(),
    highlights: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            text: z.string().min(1).max(240),
            evidence: z.array(z.string().min(1).max(120)).min(1).max(8),
          })
          .strict(),
      )
      .max(3),
    cohorts: z.array(cohortSchema).max(2),
    freshness: z
      .object({
        state: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
        staleAfterHours: z.literal(192),
      })
      .strict(),
    processingState: z.enum(["IDLE", "PROCESSING", "FAILED"]),
    currentPreserved: z.boolean(),
    limitations: z.array(limitationSchema).max(16),
    settingsRecoveryRoute: z.literal(CREATOR_AUDIENCE_SETTINGS_RECOVERY_ROUTE),
  })
  .strict();

export type CreatorAudienceConsumer = z.infer<
  typeof CreatorAudienceConsumerSchema
>;

export type AudienceHighlightCandidate = Readonly<{
  id: string;
  text: string;
  evidence: readonly string[];
  absolutePercentagePointDelta: number;
}>;

/** Uses donor 5-point notable and 10-point material thresholds; no model call. */
export function finalizeAudienceHighlights(
  candidates: readonly AudienceHighlightCandidate[],
): CreatorAudienceConsumer["highlights"] {
  return [...candidates]
    .filter(
      (candidate) =>
        Number.isFinite(candidate.absolutePercentagePointDelta) &&
        candidate.absolutePercentagePointDelta >= 5 &&
        candidate.evidence.length > 0,
    )
    .sort(
      (left, right) =>
        Number(right.absolutePercentagePointDelta >= 10) -
          Number(left.absolutePercentagePointDelta >= 10) ||
        right.absolutePercentagePointDelta -
          left.absolutePercentagePointDelta ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 3)
    .map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      evidence: [...new Set(candidate.evidence)].sort(),
    }));
}

export interface CreatorAudienceInternalPurgePort {
  purgeCreatorInstagramSource(
    input: Readonly<{
      scope: Extract<IntelligenceOwnerScope, { kind: "CREATOR" }>;
      integrationId: string;
      providerAccountId: string;
      authorizationGeneration: number;
    }>,
  ): Promise<Readonly<{ deletedRows: number }>>;
}

export const CREATOR_AUDIENCE_SETTINGS_BOUNDARY = Object.freeze({
  projectsStateOnly: true,
  requiresCredentialDecryptionInConsumer: false,
  ownsConnect: false,
  ownsReconnect: false,
  ownsDisconnect: false,
  ownsRefresh: false,
  exposesDeleteEndpoint: false,
});

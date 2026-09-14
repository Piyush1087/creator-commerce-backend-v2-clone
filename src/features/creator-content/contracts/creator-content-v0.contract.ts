import { z } from "zod";

export const CREATOR_CONTENT_V0_CONTRACT_VERSION =
  "creator_content_v0.1" as const;
export const CREATOR_CONTENT_V0_OBJECT_ID = "creator_content" as const;
export const CREATOR_CONTENT_ROUTE =
  "/api/v1/creator/insights/content" as const;
export const CREATOR_CONTENT_COMPONENTS = [
  "source_status",
  "content_snapshot",
  "content_highlights",
  "what_you_create",
  "content_performance",
  "representative_content",
  "freshness",
  "limitations",
] as const;
export const CREATOR_CONTENT_COMPARISON_PROFILE = "v0.1" as const;
export const CREATOR_CONTENT_WINDOW_DAYS = 90;
export const CREATOR_CONTENT_MAX_POSTS = 24;

const boundedText = z.string().trim().min(1).max(240);
const evidenceRefs = z.array(z.string().trim().min(1).max(255)).min(1).max(24);
const confidence = z.enum(["LOW", "MEDIUM"]);
const metric = z.enum([
  "INTERACTION_RATE",
  "REACH",
  "VIEWS",
  "LIKES",
  "COMMENTS",
  "SAVES",
  "SHARES",
  "TOTAL_INTERACTIONS",
]);

const mediaSchema = z
  .object({
    providerMediaId: z.string().trim().min(1).max(100),
    publishedAt: z.string().datetime(),
    mediaType: z.enum(["IMAGE", "CAROUSEL_ALBUM", "VIDEO", "REEL"]),
    permalink: z.string().url().max(500).nullable(),
    semanticState: z.enum(["AVAILABLE", "PARTIAL", "UNKNOWN"]),
    themes: z.array(boundedText).max(8),
    captionPatterns: z.array(boundedText).max(6),
    creativeStructures: z.array(boundedText).max(6),
    visualExecution: z.array(boundedText).max(6),
    metrics: z.record(metric, z.number().nonnegative().nullable()),
    evidenceRefs,
  })
  .strict();

export const CreatorContentConsumerSchema = z
  .object({
    contractVersion: z.literal(CREATOR_CONTENT_V0_CONTRACT_VERSION),
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
    snapshot: z
      .object({
        windowDays: z.literal(90),
        windowStart: z.string().datetime(),
        windowEnd: z.string().datetime(),
        eligibleCount: z.number().int().nonnegative().max(24),
        providerRowsReturned: z.number().int().nonnegative(),
        cap: z.literal(24),
        coverage: z.number().min(0).max(1),
        media: z.array(mediaSchema).max(24),
      })
      .strict(),
    highlights: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            kind: z.enum(["PERFORMANCE", "RECURRENCE", "LIMITATION"]),
            text: boundedText,
            confidence,
            evidenceRefs,
          })
          .strict(),
      )
      .max(3),
    whatYouCreate: z
      .object({
        themes: z
          .array(
            z
              .object({
                value: boundedText,
                postCount: z.number().int().positive(),
                evidenceRefs,
              })
              .strict(),
          )
          .max(12),
        formats: z
          .array(
            z
              .object({
                value: z.enum(["IMAGE", "CAROUSEL_ALBUM", "VIDEO", "REEL"]),
                postCount: z.number().int().positive(),
                evidenceRefs,
              })
              .strict(),
          )
          .max(4),
      })
      .strict(),
    performance: z
      .object({
        comparisonProfile: z.literal(CREATOR_CONTENT_COMPARISON_PROFILE),
        claims: z
          .array(
            z
              .object({
                id: z.string().min(1).max(160),
                cohort: boundedText,
                metric,
                direction: z.enum(["HIGHER", "LOWER"]),
                cohortMedian: z.number().nonnegative(),
                complementMedian: z.number().nonnegative(),
                absolutePercentagePointDelta: z.number().nullable(),
                relativeDelta: z.number(),
                cohortSample: z.number().int().nonnegative(),
                complementSample: z.number().int().nonnegative(),
                cohortCoverage: z.number().min(0).max(1),
                complementCoverage: z.number().min(0).max(1),
                confidence,
                evidenceRefs,
              })
              .strict(),
          )
          .max(12),
      })
      .strict(),
    representatives: z
      .array(
        z
          .object({
            providerMediaId: z.string().min(1).max(100),
            publishedAt: z.string().datetime(),
            reason: boundedText,
            permalink: z.string().url().max(500).nullable(),
            evidenceRefs,
          })
          .strict(),
      )
      .max(6),
    freshness: z
      .object({
        state: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
        staleAfterHours: z.literal(48),
        capturedAt: z.string().datetime().nullable(),
      })
      .strict(),
    processingState: z.enum(["IDLE", "PROCESSING", "FAILED"]),
    currentPreserved: z.boolean(),
    limitations: z.array(boundedText).max(24),
    settingsRecoveryRoute: z.literal("/creator/settings/instagram"),
  })
  .strict();

export type CreatorContentConsumer = z.infer<
  typeof CreatorContentConsumerSchema
>;
export type CreatorContentMedia = z.infer<typeof mediaSchema>;

export const CREATOR_CONTENT_SETTINGS_BOUNDARY = Object.freeze({
  projectsStateOnly: true,
  requiresCredentialDecryptionInConsumer: false,
  ownsConnect: false,
  ownsReconnect: false,
  ownsDisconnect: false,
  ownsRefresh: false,
  exposesDeleteEndpoint: false,
});

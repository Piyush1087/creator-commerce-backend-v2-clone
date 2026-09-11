import { z } from "zod";

const timestamp = z.string().datetime();

export const InstagramB4ConsumerSchema = z
  .object({
    contractVersion: z.literal("b4-proof-1.0"),
    connection: z
      .object({
        state: z.enum([
          "CONNECTED",
          "DEGRADED",
          "REAUTH_REQUIRED",
          "NOT_CONNECTED",
        ]),
        account: z
          .object({
            providerAccountId: z.string().min(1),
            handle: z.string().min(1).nullable(),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    window: z
      .object({ start: timestamp, end: timestamp, days: z.literal(30) })
      .strict()
      .nullable(),
    contentBehavior: z
      .object({
        semanticId: z.literal("instagram_content_behavior"),
        objectContractVersion: z.literal("1.0"),
        outputContractVersion: z.literal("1.0"),
        objectState: z.literal("PARTIAL_CURRENT"),
        readiness: z.literal("PARTIAL"),
        freshness: z.enum(["CURRENT", "STALE"]),
        authority: z.literal("CREATOR_SHOP_DERIVED"),
        sourceClass: z.literal("INSTAGRAM_OWNED"),
        protection: z.literal("UNPROTECTED"),
        generatedAt: timestamp,
        currentPreserved: z.boolean(),
        latestProcessing: z
          .object({
            state: z.enum(["HEALTHY", "DEGRADED", "IN_PROGRESS"]),
            reasonCode: z.string().min(1).nullable(),
          })
          .strict(),
        observedImage: z
          .object({
            format: z.literal("IMAGE"),
            description: z.string().min(1).max(500),
            visibleElements: z.array(z.string().min(1).max(120)).max(16),
            dominantColors: z.array(z.string().min(1).max(80)).max(12),
            composition: z.string().min(1).max(300),
          })
          .strict(),
        coverage: z
          .object({
            eligibleCount: z.literal(1),
            observedCount: z.literal(1),
            deepInspectedCount: z.literal(1),
          })
          .strict(),
        evidence: z
          .object({
            count: z.number().int().positive().max(8),
            refs: z.array(z.string().min(1).max(255)).min(1).max(8),
          })
          .strict(),
        limitation: z.literal(
          "Not enough posts to identify patterns or learnings",
        ),
      })
      .strict()
      .nullable(),
    latestProcessing: z
      .object({
        state: z.enum(["NOT_RUN", "HEALTHY", "DEGRADED", "IN_PROGRESS"]),
        reasonCode: z.string().min(1).nullable(),
      })
      .strict(),
    settingsRecoveryPath: z.literal(
      "/brand/settings/integrations?tab=instagram",
    ),
  })
  .strict();

export type InstagramB4Consumer = z.infer<typeof InstagramB4ConsumerSchema>;

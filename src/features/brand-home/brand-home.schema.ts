import { z } from "zod";

import {
  BRAND_HOME_ITEM_KINDS,
  BRAND_HOME_NAVIGATION_DESTINATIONS,
  BRAND_HOME_PRIORITY_TIERS,
  BRAND_HOME_SECTION_IDS,
  BRAND_HOME_SOURCE_DOMAINS,
} from "./brand-home.contract";

const HomeEntityRefSchema = z
  .object({
    type: z.enum(["BRAND", "OFFERING", "CAMPAIGN", "COLLABORATION"]),
    id: z.string().trim().min(1).max(128),
  })
  .strict();

export const BrandHomeItemSchema = z
  .object({
    id: z.string().trim().min(1).max(300),
    kind: z.enum(BRAND_HOME_ITEM_KINDS),
    reasonCode: z.string().trim().min(1).max(128),
    priorityTier: z.enum(BRAND_HOME_PRIORITY_TIERS),
    title: z.string().trim().min(1).max(500),
    summary: z.string().trim().min(1).max(2_000),
    entityRefs: z.array(HomeEntityRefSchema).max(10),
    navigation: z
      .object({
        destinationId: z.enum(BRAND_HOME_NAVIGATION_DESTINATIONS),
        entityRef: HomeEntityRefSchema.optional(),
      })
      .strict(),
    freshness: z
      .object({
        state: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
        observedAt: z.string().datetime(),
        changedAt: z.string().datetime().nullable(),
        dueAt: z.string().datetime().nullable(),
      })
      .strict(),
    sourceDomains: z.array(z.enum(BRAND_HOME_SOURCE_DOMAINS)).min(1),
    limitations: z.array(z.string().trim().min(1).max(500)),
    recommendation: z
      .object({
        text: z.string().trim().min(1).max(4_000),
        basisRefs: z.array(z.string().trim().min(1).max(128)).min(1),
        nonMutating: z.literal(true),
      })
      .strict()
      .optional(),
  })
  .strict();

export const BrandHomeResponseSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    generatedAt: z.string().datetime(),
    status: z.enum(["READY", "PARTIAL", "UNAVAILABLE"]),
    brand: z
      .object({
        id: z.string().trim().min(1).max(128),
        displayName: z.string().trim().min(1).max(500),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            id: z.enum(BRAND_HOME_SECTION_IDS),
            state: z.enum(["READY", "EMPTY", "PARTIAL", "UNAVAILABLE"]),
            items: z.array(BrandHomeItemSchema),
          })
          .strict(),
      )
      .length(BRAND_HOME_SECTION_IDS.length),
    sourceStates: z.array(
      z
        .object({
          sourceDomain: z.enum(BRAND_HOME_SOURCE_DOMAINS),
          state: z.enum(["READY", "PARTIAL", "UNAVAILABLE"]),
          truncated: z.boolean(),
          limitations: z.array(z.string().trim().min(1).max(500)),
        })
        .strict(),
    ),
    truncated: z.boolean(),
    limitations: z.array(z.string().trim().min(1).max(500)),
  })
  .strict()
  .superRefine((response, context) => {
    const ids = response.sections.map((section) => section.id);
    if (ids.some((id, index) => id !== BRAND_HOME_SECTION_IDS[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections"],
        message: "Brand Home sections must use the frozen canonical order",
      });
    }
  });

export type BrandHomeItem = z.infer<typeof BrandHomeItemSchema>;
export type BrandHomeResponse = z.infer<typeof BrandHomeResponseSchema>;

import { z } from "zod";

export const CreatorTierFilterSchema = z.enum([
  "NANO",
  "MICRO",
  "MID",
  "MACRO",
  "MEGA",
]);

export const PlatformContentFormatFilterSchema = z.enum([
  "INSTAGRAM_REEL",
  "INSTAGRAM_STORY",
  "TIKTOK_VIDEO",
  "YOUTUBE_SHORTS",
]);

export const ProductionTimelineFilterSchema = z.enum([
  "URGENT_PIPELINE",
  "STANDARD_RUNWAY",
]);

export const MarketplaceFilterSchema = z.object({
  search_query: z.string().trim().max(100).optional(),
  brand_slug: z.string().trim().max(120).optional(),
  niche: z.string().trim().max(100).optional(),
  deliverable_type: PlatformContentFormatFilterSchema.optional(),
  show_match_eligible_only: z.boolean().optional().default(false),
  creator_tier: z
    .union([z.array(CreatorTierFilterSchema), CreatorTierFilterSchema])
    .optional()
    .transform((value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }),
  target_geography: z.string().length(2).optional(),
  production_timeline: z
    .union([
      z.array(ProductionTimelineFilterSchema),
      ProductionTimelineFilterSchema,
    ])
    .optional()
    .transform((value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }),
});

export type MarketplaceFilterInput = z.infer<typeof MarketplaceFilterSchema>;

import { z } from "zod";

export const CopilotMessageInputSchema = z.object({
  threadId: z.string().uuid().optional(),
  promptMessage: z
    .string()
    .trim()
    .min(1, { message: "Prompt query string cannot be empty parameters." })
    .max(2000, {
      message: "Prompt context limits scale up to 2000 characters maximum.",
    }),
});

export const DesignThemeEnum = z.enum([
  "MINIMAL_STARK",
  "EDITORIAL_LUXE",
  "CYBER_TECH",
  "VIBRANT_KINETIC",
  "PASTEL_MINIMAL",
]);

export const MediaKitSaveSchema = z.object({
  customBioOverride: z.string().trim().max(1000).nullable().optional(),
  activeTheme: DesignThemeEnum,
  showTotalReach: z.boolean().default(true),
  showEngagementRate: z.boolean().default(true),
  showViewsMetric: z.boolean().default(true),
  showRatesColumn: z.boolean().default(true),
  shortFormVideoRate: z.number().min(0).max(1_000_000),
  storyBundleRate: z.number().min(0).max(1_000_000),
  pastBrandLogos: z.array(z.string().url()).max(20),
  isMediaKitPublic: z.boolean().optional(),
});

export const AnalyticsFilterQuerySchema = z.object({
  limitCount: z.coerce.number().int().min(1).max(10).default(5),
});

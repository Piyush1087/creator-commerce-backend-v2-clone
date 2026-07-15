import { z } from "zod";

export const IndustryEnum = z.enum([
  "D2C",
  "SAAS_AI",
  "HEALTHCARE",
  "OFFLINE_SERVICES",
  "D2C_ECOMMERCE",
  "AI_SAAS",
]);

export const SocialHandlesSchema = z.object({
  instagram: z.string().url().nullable().default(null),
  tiktok: z.string().url().nullable().default(null),
  facebook: z.string().url().nullable().default(null),
  youtube: z.string().url().nullable().default(null),
  linkedin: z.string().url().nullable().default(null),
});

export function createUniversalWrapper<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    confidence: z.number().int().min(0).max(100),
    evidence: z.array(
      z.object({
        // Prefer absolute URLs; allow relative provenance for local fallbacks.
        page_url: z.string().min(1),
        page_type: z.string().min(1),
        excerpt: z.string().min(1),
      }),
    ),
    source: z.enum(["AI", "USER", "SYSTEM", "CRAWLER"]).default("CRAWLER"),
    edited: z.boolean().default(false),
  });
}

export const CoreIdentitySnapshotSchema = z.object({
  scan_id: z.string().uuid(),
  brand_name: createUniversalWrapper(z.string().min(1)),
  website_url: createUniversalWrapper(z.string().url()),
  country: createUniversalWrapper(z.string().min(2).max(2)),
  reporting_currency: createUniversalWrapper(z.string().min(3).max(3)),
  brand_logo: createUniversalWrapper(z.string().url().nullable()),
  industry: createUniversalWrapper(z.string().min(1)),
  sub_industry: createUniversalWrapper(z.string().min(1)),
  social_handles: createUniversalWrapper(SocialHandlesSchema),
  tagline: createUniversalWrapper(z.string().nullable()),
  discovered_root_links: z.array(z.string().url()).default([]),
});

export type CoreIdentitySnapshot = z.infer<typeof CoreIdentitySnapshotSchema>;

export type RawScrapeResult = {
  brand_name?: string;
  logo_url?: string;
  country?: string;
  currency?: string;
  socials: Partial<z.infer<typeof SocialHandlesSchema>>;
  tagline?: string;
  source_url: string;
  discovered_links?: string[];
};

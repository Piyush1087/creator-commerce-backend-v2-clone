import { IndustryVertical } from "@prisma/client";
import { z } from "zod";

/** Map gatekeeper / doc aliases onto Prisma IndustryVertical. */
export function normalizeIndustryVertical(raw: string): IndustryVertical {
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, IndustryVertical> = {
    D2C: IndustryVertical.D2C,
    D2C_ECOMMERCE: IndustryVertical.D2C,
    ECOMMERCE: IndustryVertical.D2C,
    SAAS_AI: IndustryVertical.SAAS_AI,
    AI_SAAS: IndustryVertical.SAAS_AI,
    SAAS: IndustryVertical.SAAS_AI,
    HEALTHCARE: IndustryVertical.HEALTHCARE,
    OFFLINE_SERVICES: IndustryVertical.OFFLINE_SERVICES,
    REAL_ESTATE: IndustryVertical.REAL_ESTATE,
    B2B_AGENCY: IndustryVertical.B2B_AGENCY,
    MEDIA: IndustryVertical.MEDIA,
    EDUCATION: IndustryVertical.EDUCATION,
    ENTERTAINMENT: IndustryVertical.ENTERTAINMENT,
    UNKNOWN: IndustryVertical.UNKNOWN,
    GAMBLING: IndustryVertical.GAMBLING,
    ADULT: IndustryVertical.ADULT,
    FRAUDULENT_HIGHRISK: IndustryVertical.FRAUDULENT_HIGH_RISK,
    FRAUDULENT_HIGH_RISK: IndustryVertical.FRAUDULENT_HIGH_RISK,
  };
  return aliases[key] ?? IndustryVertical.UNKNOWN;
}

export const IndustryEnum = z
  .string()
  .min(1)
  .transform((value) => normalizeIndustryVertical(value))
  .pipe(z.nativeEnum(IndustryVertical));

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
  industry: createUniversalWrapper(IndustryEnum),
  sub_industry: createUniversalWrapper(z.string().min(1)),
  social_handles: createUniversalWrapper(SocialHandlesSchema),
  tagline: createUniversalWrapper(z.string().nullable()),
  discovered_root_links: z.array(z.string().url()).default([]),
  // Ordered alternates for the logo (og:image, apple-touch-icon, favicon).
  // The asset mirror walks these when the primary logo URL is dead (404).
  logo_candidates: z.array(z.string().url()).max(5).default([]),
});

export type CoreIdentitySnapshot = z.infer<typeof CoreIdentitySnapshotSchema>;

export type RawScrapeResult = {
  brand_name?: string;
  logo_url?: string;
  /** Ordered fallback logo URLs (absolute), best candidate first. */
  logo_candidates?: string[];
  country?: string;
  currency?: string;
  socials: Partial<z.infer<typeof SocialHandlesSchema>>;
  tagline?: string;
  source_url: string;
  discovered_links?: string[];
};

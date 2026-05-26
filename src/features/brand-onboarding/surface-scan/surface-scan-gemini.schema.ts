import { IndustryVertical, OfferingType } from "@prisma/client";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color");

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Gemini often returns `null` or oversized arrays; normalize before strict validation. */
function asArray(val: unknown): unknown[] {
  if (val == null) {
    return [];
  }
  return Array.isArray(val) ? val : [];
}

function llmStringArray(max: number, maxLen = 80) {
  return z.preprocess(
    (val) =>
      asArray(val)
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, maxLen))
        .filter((s) => s.length > 0)
        .slice(0, max),
    z.array(z.string().max(maxLen)).max(max),
  );
}

function llmUrlArray(max: number) {
  return z.preprocess(
    (val) =>
      asArray(val)
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, max),
    z.array(z.string().url()).max(max),
  );
}

function llmHexColorArray(max: number) {
  return z.preprocess(
    (val) =>
      asArray(val)
        .filter(
          (c): c is string =>
            typeof c === "string" && HEX_RE.test(c.trim()),
        )
        .map((c) => c.trim())
        .slice(0, max),
    z.array(hexColor).max(max),
  );
}

function llmObjectArray<T extends z.ZodTypeAny>(item: T, max: number) {
  return z.preprocess(
    (val) => asArray(val).slice(0, max),
    z.array(item).max(max),
  );
}

const surfaceProductSchema = z.object({
  type: z.nativeEnum(OfferingType),
  name: z.string().min(1).max(200),
  imageUrl: z.string().url().nullable().optional(),
  startingPriceLabel: z.string().max(120).nullable().optional(),
  collectionOrCategory: z.string().max(200).nullable().optional(),
  /** List-view PDP or collection URL seen in markdown / canonical site. */
  url: z.string().url(),
});

const surfaceOfferSchema = z.object({
  name: z.string().max(200),
  couponCode: z.string().max(80).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
});

const surfaceCompetitorSchema = z.object({
  name: z.string().min(1).max(200),
  websiteUrl: z.string().url(),
  logoUrl: z.string().url().nullable().optional(),
  whyCompetitor: z.string().max(500).nullable().optional(),
});

const surfaceLocationSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  address: z.string().min(1).max(500),
  city: z.string().max(120).nullable().optional(),
  zip: z.string().max(40).nullable().optional(),
});

/**
 * Step 2 surface scan — Gemini JSON after Parallel bundles (product “Revised Gemini Surface Scan”).
 * Names mirror the product doc; the HTTP runner maps this onto Prisma models.
 */
export const Step2SurfaceScanGeminiSchema = z.object({
  suggestedIndustry: z.nativeEnum(IndustryVertical),
  brand: z.object({
    name: z.string().min(1).max(200),
    logoUrl: z.string().url().nullable().optional(),
    socialLinks: llmUrlArray(8),
    tagline: z.string().max(300).nullable().optional(),
    /** Short preview for Step 3 (product: max ~200 chars; allow small buffer). */
    shortDescription: z.string().max(500).nullable().optional(),
    subIndustry: z.string().max(200).nullable().optional(),
    industryNiche: z.string().max(200).nullable().optional(),
    primaryHexColors: llmHexColorArray(5),
    headingFont: z.string().max(120).nullable().optional(),
    bodyFont: z.string().max(120).nullable().optional(),
    toneTags: llmStringArray(3),
    aestheticTags: llmStringArray(2),
    audience: z
      .object({
        personaName: z.string().max(120).nullable().optional(),
        ageMin: z.number().int().min(13).max(99).nullable().optional(),
        ageMax: z.number().int().min(13).max(99).nullable().optional(),
        traits: llmStringArray(3),
      })
      .nullable()
      .optional(),
  }),
  products: llmObjectArray(surfaceProductSchema, 6),
  activeOffers: llmObjectArray(surfaceOfferSchema, 8),
  competitors: llmObjectArray(surfaceCompetitorSchema, 5),
  locations: llmObjectArray(surfaceLocationSchema, 12),
});

export type Step2SurfaceScanGeminiPayload = z.infer<
  typeof Step2SurfaceScanGeminiSchema
>;

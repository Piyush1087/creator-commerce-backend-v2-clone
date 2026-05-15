import { IndustryVertical, OfferingType } from "@prisma/client";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color");

/**
 * Step 2 surface scan — Gemini JSON after Parallel bundles (product “Revised Gemini Surface Scan”).
 * Names mirror the product doc; the HTTP runner maps this onto Prisma models.
 */
export const Step2SurfaceScanGeminiSchema = z.object({
  suggestedIndustry: z.nativeEnum(IndustryVertical),
  brand: z.object({
    name: z.string().min(1).max(200),
    logoUrl: z.string().url().nullable().optional(),
    socialLinks: z.array(z.string().url()).max(8).default([]),
    tagline: z.string().max(300).nullable().optional(),
    /** Short preview for Step 3 (product: max ~200 chars; allow small buffer). */
    shortDescription: z.string().max(500).nullable().optional(),
    subIndustry: z.string().max(200).nullable().optional(),
    industryNiche: z.string().max(200).nullable().optional(),
    primaryHexColors: z.array(hexColor).max(5).default([]),
    headingFont: z.string().max(120).nullable().optional(),
    bodyFont: z.string().max(120).nullable().optional(),
    toneTags: z.array(z.string().max(80)).max(3).default([]),
    aestheticTags: z.array(z.string().max(80)).max(2).default([]),
    audience: z
      .object({
        personaName: z.string().max(120).nullable().optional(),
        ageMin: z.number().int().min(13).max(99).nullable().optional(),
        ageMax: z.number().int().min(13).max(99).nullable().optional(),
        traits: z.array(z.string().max(80)).max(3).default([]),
      })
      .nullable()
      .optional(),
  }),
  products: z
    .array(
      z.object({
        type: z.nativeEnum(OfferingType),
        name: z.string().min(1).max(200),
        imageUrl: z.string().url().nullable().optional(),
        startingPriceLabel: z.string().max(120).nullable().optional(),
        collectionOrCategory: z.string().max(200).nullable().optional(),
        /** List-view PDP or collection URL seen in markdown / canonical site. */
        url: z.string().url(),
      }),
    )
    .max(6)
    .default([]),
  activeOffers: z
    .array(
      z.object({
        name: z.string().max(200),
        couponCode: z.string().max(80).nullable().optional(),
        description: z.string().max(400).nullable().optional(),
      }),
    )
    .max(8)
    .default([]),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        websiteUrl: z.string().url(),
        logoUrl: z.string().url().nullable().optional(),
        whyCompetitor: z.string().max(500).nullable().optional(),
      }),
    )
    .max(5)
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string().max(200).nullable().optional(),
        address: z.string().min(1).max(500),
        city: z.string().max(120).nullable().optional(),
        zip: z.string().max(40).nullable().optional(),
      }),
    )
    .max(12)
    .default([]),
});

export type Step2SurfaceScanGeminiPayload = z.infer<
  typeof Step2SurfaceScanGeminiSchema
>;

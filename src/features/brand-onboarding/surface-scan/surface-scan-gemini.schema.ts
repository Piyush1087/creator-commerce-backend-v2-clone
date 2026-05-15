import { IndustryVertical, OfferingType } from "@prisma/client";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color");

export const SurfaceScanGeminiSchema = z.object({
  suggestedIndustry: z.nativeEnum(IndustryVertical),
  brand: z.object({
    name: z.string().min(1).max(200),
    tagline: z.string().max(300).nullable().optional(),
    description: z.string().min(1).max(12_000),
    logoUrl: z.string().url().nullable().optional(),
    subIndustry: z.string().max(200).nullable().optional(),
    industryNiche: z.string().max(200).nullable().optional(),
  }),
  visualIdentity: z.object({
    colors: z.array(hexColor).max(12),
    fonts: z.object({
      heading: z.string().max(120),
      body: z.string().max(120),
    }),
    toneOfVoice: z
      .array(
        z.object({
          label: z.string().max(80),
          description: z.string().max(400),
        }),
      )
      .max(8),
    aesthetic: z.array(z.string().max(80)).max(12),
  }),
  brandValues: z.array(z.string().max(120)).max(20),
  policyFlags: z.array(z.string().max(200)).max(30),
  targetAudience: z.object({
    personaName: z.string().min(1).max(120),
    countries: z.array(z.string().max(80)).max(20),
    ageMin: z.number().int().min(13).max(99),
    ageMax: z.number().int().min(13).max(99),
    affluence: z.number().int().min(1).max(5),
    traits: z.array(z.string().max(60)).max(12),
  }),
  offerings: z
    .array(
      z.object({
        type: z.nativeEnum(OfferingType),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        imageUrl: z.string().url().nullable().optional(),
        url: z.string().url(),
      }),
    )
    .max(24),
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        websiteUrl: z.string().url(),
        logoUrl: z.string().url().nullable().optional(),
        socialHandles: z.array(z.string().max(240)).max(8),
        whyCompetitor: z.string().max(2000).nullable().optional(),
      }),
    )
    .max(12),
  locations: z
    .array(
      z.object({
        name: z.string().max(200).nullable().optional(),
        address: z.string().min(1).max(500),
        city: z.string().max(120).nullable().optional(),
        zip: z.string().max(40).nullable().optional(),
      }),
    )
    .max(24),
});

export type SurfaceScanGeminiPayload = z.infer<typeof SurfaceScanGeminiSchema>;

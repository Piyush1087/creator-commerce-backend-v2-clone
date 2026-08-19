import { z } from "zod";

export const CANONICAL_CREATOR_ARCHETYPE_IDS = [
  "TRENDSETTER",
  "ENTERTAINER",
  "VIRAL_CREATOR",
  "CHALLENGER",
  "LIFESTYLE_INTEGRATOR",
  "STORYTELLER",
  "EDUCATOR",
  "INDUSTRY_EXPERT",
  "DEEP_DIVER",
  "MYTH_BUSTER",
  "RELATABLE_PEER",
  "COMMUNITY_BUILDER",
  "LOCAL_GUIDE",
  "CONVERSATION_STARTER",
  "ADVOCATE",
  "PROBLEM_SOLVER",
  "PRODUCT_REVIEWER",
  "DEAL_HUNTER",
  "COMPARISON_CREATOR",
  "CURATED_COLLECTOR",
  "VISUAL_ARTIST",
  "UGC_CREATOR",
  "CINEMATIC_CREATOR",
  "CREATIVE_DIRECTOR",
  "AESTHETIC_MINIMALIST",
  "FOUNDER_VOICE",
  "COACH",
  "RESEARCHER",
  "THOUGHT_LEADER",
  "DEMONSTRATOR",
] as const;

export const CANONICAL_AUDIENCE_AFFINITY_IDS = [
  "HEALTH",
  "WOMENS_HEALTH",
  "PREGNANCY",
  "NUTRITION",
  "MENTAL_WELLNESS",
  "FERTILITY",
  "SKINCARE",
  "BEAUTY",
  "FASHION",
  "SHOPPING",
  "LUXURY_LIFESTYLE",
  "STREETWEAR",
  "FITNESS",
  "ARTIFICIAL_INTELLIGENCE",
  "PRODUCTIVITY",
  "STARTUPS",
  "SOFTWARE_DEVELOPMENT",
  "AUTOMATION",
  "TECHNOLOGY",
  "PERSONAL_FINANCE",
  "INVESTING",
  "TRAVEL",
  "FOOD",
  "COOKING",
  "PARENTING",
  "BABY_AND_KIDS",
  "HOME_AND_INTERIORS",
  "EDUCATION",
  "CAREER_AND_PRODUCTIVITY",
  "PERSONAL_STYLE",
] as const;

export const canonicalCreatorArchetypeIdSchema = z.enum(CANONICAL_CREATOR_ARCHETYPE_IDS);
export const canonicalAudienceAffinityIdSchema = z.enum(CANONICAL_AUDIENCE_AFFINITY_IDS);

/**
 * Structured Campaign audience geography aligned to Brand Intelligence market geography.
 * City selections are normalized as LOCALITY. Multi-location is represented by multiple rows.
 */
export const canonicalAudienceGeographySchema = z
  .object({
    scope: z.enum(["LOCALITY", "REGION", "COUNTRY", "GLOBAL"]),
    label: z.string().trim().min(1),
    country_code: z.string().trim().regex(/^[A-Z]{2}$/).nullable(),
    locality: z.string().trim().min(1).nullable(),
    region: z.string().trim().min(1).nullable(),
    radius_km: z.number().finite().positive().nullable(),
    is_primary: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "GLOBAL") {
      if (value.country_code !== null || value.locality !== null || value.region !== null || value.radius_km !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GLOBAL geography cannot include country, locality, region, or radius." });
      }
      return;
    }
    if (value.scope === "COUNTRY") {
      if (!value.country_code || value.locality !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "COUNTRY geography requires country_code and no locality." });
      }
      return;
    }
    if (value.scope === "REGION" && !value.region) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "REGION geography requires region." });
    }
    if (value.scope === "LOCALITY" && !value.locality) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["locality"], message: "LOCALITY geography requires locality." });
    }
  });

export const canonicalAudienceGeographiesSchema = z
  .array(canonicalAudienceGeographySchema)
  .min(1)
  .superRefine((value, ctx) => {
    if (!value.some((item) => item.is_primary)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one audience geography must be primary." });
    }
    if (value.some((item) => item.scope === "GLOBAL") && value.length > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GLOBAL geography cannot be combined with other audience geographies." });
    }
  });

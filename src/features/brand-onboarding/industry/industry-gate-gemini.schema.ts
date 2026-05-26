import { z } from "zod";

/**
 * JSON contract for the Step 1 industry gate (Gemini). Maps to Prisma `IndustryVertical` + bucket.
 */
export const IndustryGateGeminiSchema = z.object({
  highLevelIndustry: z.enum([
    "D2C",
    "SAAS_AI",
    "HEALTHCARE",
    "OFFLINE_SERVICES",
    "OTHER",
  ]),
  /** When `highLevelIndustry` is OTHER, free-text vertical (e.g. "Real Estate"). */
  otherIndustryDetail: z.string().max(160).nullable().optional(),
});

export type IndustryGateGeminiPayload = z.infer<
  typeof IndustryGateGeminiSchema
>;

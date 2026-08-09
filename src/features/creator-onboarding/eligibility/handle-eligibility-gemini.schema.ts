import { z } from "zod";

export const HandleEligibilityGeminiSchema = z.object({
  is_approved: z.boolean(),
  eligibility_score: z.number().int().min(0).max(100),
  percentile_rank: z.number().min(0).max(100),
  detected_vertical: z.enum([
    "D2C",
    "SAAS_AI",
    "HEALTHCARE",
    "MEDIA",
    "ENTERTAINMENT",
    "UNKNOWN",
  ]),
});

export type HandleEligibilityGeminiPayload = z.infer<
  typeof HandleEligibilityGeminiSchema
>;

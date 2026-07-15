import { z } from "zod";

/**
 * Stage 0 Gatekeeper JSON contract (change doc Phase 2).
 * Industry values normalize to Prisma `IndustryVertical` in the mapper.
 */
export const GatekeeperGeminiSchema = z.object({
  supported: z.boolean(),
  industry: z.string().min(1).max(64),
  sub_industry: z.string().min(1).max(120),
  confidence: z.number().int().min(0).max(100),
});

export type GatekeeperGeminiPayload = z.infer<typeof GatekeeperGeminiSchema>;

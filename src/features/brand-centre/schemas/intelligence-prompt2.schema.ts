import { z } from "zod";

export const IntelligenceLeakCardSchema = z.object({
  insightTitle: z.string().min(5),
  shortDescription20Words: z.string().min(10).max(150),
  priorityRank: z.enum(["HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"]),
  leakBucket: z.enum(["PDP", "PAID", "ROSTER", "CREATIVE_HOOK"]),
  performanceStatus: z.enum(["GREEN", "YELLOW", "RED"]),
  projectedLiftPercentage: z.number().min(1).max(100),
  drawerDeepDive: z.object({
    underlyingDataLogic: z.string().min(20),
    competitiveDiscrepancy: z.string().min(20),
    actionableStepsChecklist: z
      .array(
        z.object({
          stepId: z.string(),
          stepLabel: z.string().min(5),
          isCompleted: z.boolean().optional().default(false),
        }),
      )
      .min(1),
  }),
});

export const IntelligencePrompt2Schema = z.array(IntelligenceLeakCardSchema);

export type IntelligenceLeakCardPayload = z.infer<
  typeof IntelligenceLeakCardSchema
>;

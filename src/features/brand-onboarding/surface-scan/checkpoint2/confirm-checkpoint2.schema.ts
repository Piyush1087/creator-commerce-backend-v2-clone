import { z } from "zod";

/**
 * Checkpoint 2 confirm body — Surface Intelligence review.
 * Offerings/competitors may be empty until Prompt B/C are wired.
 */
export const ConfirmCheckpoint2BodySchema = z.object({
  confirmed: z.literal(true),
  brandDna: z.unknown().optional(),
  offerings: z.array(z.unknown()).optional(),
  competitors: z.array(z.unknown()).optional(),
});

export type ConfirmCheckpoint2Body = z.infer<
  typeof ConfirmCheckpoint2BodySchema
>;

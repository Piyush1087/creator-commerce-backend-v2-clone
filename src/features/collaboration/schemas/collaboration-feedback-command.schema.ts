import { z } from "zod";

const envelope = {
  collaborationId: z.string().uuid(),
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};

export const submitCollaborationFeedbackSchema = z
  .object({
    ...envelope,
    rating: z.number().int().min(1).max(5),
    reviewText: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

export const revealFeedbackSchema = z.object(envelope).strict();

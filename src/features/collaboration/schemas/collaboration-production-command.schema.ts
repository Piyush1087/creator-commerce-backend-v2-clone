import { z } from "zod";

const commandEnvelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};

const deliverableExecutionId = z.string().uuid();
const submissionVersionId = z.string().uuid();

export const submitDeliverableSchema = z
  .object({
    ...commandEnvelope,
    deliverableExecutionId,
    assetRef: z.string().trim().min(1).max(2048),
    creatorNote: z.string().trim().min(1).max(2000).optional(),
    submissionMetadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const approveDeliverableSchema = z
  .object({ ...commandEnvelope, deliverableExecutionId, submissionVersionId })
  .strict();

export const requestDeliverableRevisionSchema = z
  .object({
    ...commandEnvelope,
    deliverableExecutionId,
    submissionVersionId,
    brandFeedback: z.string().trim().min(3).max(4000),
  })
  .strict();

export const rejectFinalDeliverableSchema = z
  .object({
    ...commandEnvelope,
    deliverableExecutionId,
    submissionVersionId,
    brandFeedback: z.string().trim().min(3).max(4000),
  })
  .strict();

export type SubmitDeliverableInput = z.infer<typeof submitDeliverableSchema>;
export type ApproveDeliverableInput = z.infer<typeof approveDeliverableSchema>;
export type RequestDeliverableRevisionInput = z.infer<
  typeof requestDeliverableRevisionSchema
>;
export type RejectFinalDeliverableInput = z.infer<
  typeof rejectFinalDeliverableSchema
>;

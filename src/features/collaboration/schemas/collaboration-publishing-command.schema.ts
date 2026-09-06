import { z } from "zod";

const envelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};
const deliverableExecutionId = z.string().uuid();
const publishingEvidenceId = z.string().uuid();
const evidence = {
  evidenceRef: z.string().trim().min(1).max(4096),
  platform: z.string().trim().min(1).max(100).optional(),
  creatorNote: z.string().trim().min(1).max(2000).optional(),
  evidenceMetadata: z.record(z.string(), z.unknown()).optional(),
};

export const authorizePublishingSchema = z
  .object({ ...envelope, deliverableExecutionId })
  .strict();
export const declinePublishingSchema = authorizePublishingSchema;
export const submitPublishingEvidenceSchema = z
  .object({ ...envelope, deliverableExecutionId, ...evidence })
  .strict();
export const verifyPublishingSchema = z
  .object({
    ...envelope,
    deliverableExecutionId,
    publishingEvidenceId,
    complianceEvidenceRef: z.string().trim().min(1).max(4096).optional(),
  })
  .strict();
export const requestPublishingCorrectionSchema = z
  .object({
    ...envelope,
    deliverableExecutionId,
    publishingEvidenceId,
    correctionReason: z.string().trim().min(3).max(4000),
  })
  .strict();
export const submitCorrectedPublishingEvidenceSchema =
  submitPublishingEvidenceSchema;
export const blockPublishingComplianceSchema = z
  .object({
    ...envelope,
    collaborationId: z.string().uuid(),
    deliverableExecutionId,
    blockedReason: z.string().trim().min(3).max(4000),
    evidenceRef: z.string().trim().min(1).max(4096).optional(),
  })
  .strict();

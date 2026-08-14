import { z } from "zod";

const commandEnvelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};
const evidenceRef = z.string().trim().min(1).max(2048);

export const collaborationCommandEnvelopeSchema = z
  .object(commandEnvelope)
  .strict();
export const counterCreatorProposalSchema = z
  .object({
    ...commandEnvelope,
    counterFee: z.coerce.number().finite().nonnegative(),
  })
  .strict();
export const declineNegotiationSchema = z
  .object({
    ...commandEnvelope,
    reasonText: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export const confirmEscrowFundingSchema = z
  .object({
    ...commandEnvelope,
    fundingConfirmationRef: evidenceRef,
    escrowLockRef: evidenceRef,
    confirmedAmount: z.coerce.number().finite().nonnegative(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
  })
  .strict();
export const reportManualPaymentSchema = z
  .object({ ...commandEnvelope, paymentEvidenceRef: evidenceRef })
  .strict();
export const disputeManualPaymentSchema = z
  .object({
    ...commandEnvelope,
    reasonText: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type CollaborationCommandEnvelope = z.infer<
  typeof collaborationCommandEnvelopeSchema
>;
export type CounterCreatorProposalInput = z.infer<
  typeof counterCreatorProposalSchema
>;
export type DeclineNegotiationInput = z.infer<typeof declineNegotiationSchema>;
export type ConfirmEscrowFundingInput = z.infer<
  typeof confirmEscrowFundingSchema
>;
export type ReportManualPaymentInput = z.infer<
  typeof reportManualPaymentSchema
>;
export type DisputeManualPaymentInput = z.infer<
  typeof disputeManualPaymentSchema
>;

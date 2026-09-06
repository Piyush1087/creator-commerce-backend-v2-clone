import { z } from "zod";

const envelope = {
  collaborationId: z.string().uuid(),
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};
const money = z.union([
  z.number().finite().nonnegative().multipleOf(0.01),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
]);

export const establishNormalSettlementEligibilitySchema = z
  .object(envelope)
  .strict();
export const requestSettlementExecutionSchema = z.object(envelope).strict();
export const confirmSettlementExecutionSchema = z
  .object({
    ...envelope,
    amount: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase()),
    payoutInstructionRef: z.string().trim().min(1).max(4096),
    payoutExecutionRef: z.string().trim().min(1).max(4096),
    authoritativeConfirmationRef: z.string().trim().min(1).max(4096),
  })
  .strict();
export const confirmRefundExecutionSchema = z
  .object({
    ...envelope,
    amount: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((v) => v.toUpperCase()),
    refundInstructionRef: z.string().trim().min(1).max(4096),
    refundExecutionRef: z.string().trim().min(1).max(4096),
    authoritativeConfirmationRef: z.string().trim().min(1).max(4096),
  })
  .strict();

import { z } from "zod";

const envelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};
const reasonText = z.string().trim().min(1).max(4000).optional();
const evidenceRef = z.string().trim().min(1).max(4096).optional();
const trusted = { ...envelope, collaborationId: z.string().uuid() };
const money = z.union([
  z.number().finite().nonnegative(),
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/),
]);

export const endCollaborationByBrandSchema = z
  .object({ ...envelope, reasonText, evidenceRef })
  .strict();
export const cancelCollaborationByCreatorSchema = z
  .object({ ...envelope, reasonText, evidenceRef })
  .strict();
export const endForCreatorNonPerformanceSchema = z
  .object({ ...trusted, evidenceRef })
  .strict();
export const endForCreatorPublishingNonPerformanceSchema =
  endForCreatorNonPerformanceSchema;
export const applyAdminResolutionSchema = z
  .object({
    ...trusted,
    creatorEntitlementAmount: money,
    brandRefundEntitlementAmount: money,
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    reasonCode: z.literal("ADMIN_RESOLUTION"),
    reasonText,
    resolutionEvidence: z.record(z.string(), z.unknown()).optional(),
    residualObligations: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

import { z } from "zod";

const commandEnvelope = {
  commandId: z.string().trim().min(1).max(200),
  expectedAggregateVersion: z.coerce.number().int().positive(),
};

const evidenceRef = z.string().trim().min(1).max(2048);

export const provideFulfillmentSchema = z
  .object({
    ...commandEnvelope,
    shipmentTrackingRef: z.string().trim().min(1).max(255).optional(),
    courierName: z.string().trim().min(1).max(120).optional(),
    accessEvidenceRef: evidenceRef.optional(),
    redemptionCode: z.string().trim().min(1).max(200).optional(),
    serviceEvidenceRef: evidenceRef.optional(),
    genericFulfillmentEvidence: z
      .object({
        description: z.string().trim().min(3).max(2000),
        evidenceRef: evidenceRef.optional(),
        metadata: z.unknown().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const confirmFulfillmentSchema = z.object(commandEnvelope).strict();

export const reportFulfillmentIssueSchema = z
  .object({
    ...commandEnvelope,
    issueCode: z.string().trim().min(1).max(100),
    description: z.string().trim().min(3).max(2000),
    evidenceRef: evidenceRef.optional(),
  })
  .strict();

export const provideFulfillmentRemediationSchema = z
  .object({
    ...commandEnvelope,
    remediationEvidenceRef: evidenceRef,
  })
  .strict();

export type ProvideFulfillmentInput = z.infer<typeof provideFulfillmentSchema>;
export type ConfirmFulfillmentInput = z.infer<typeof confirmFulfillmentSchema>;
export type ReportFulfillmentIssueInput = z.infer<
  typeof reportFulfillmentIssueSchema
>;
export type ProvideFulfillmentRemediationInput = z.infer<
  typeof provideFulfillmentRemediationSchema
>;

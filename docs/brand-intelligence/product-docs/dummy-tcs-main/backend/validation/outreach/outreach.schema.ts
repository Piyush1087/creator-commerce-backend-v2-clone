import { z } from "zod";
import { entityIdSchema, requestIdSchema } from "../shared/campaign.shared.schema";

// Composer generation and Brand editing are separated from execution eligibility.
// Channel is resolved server-side from creator source/current marketplace resolution.
export const composeOutreachInputSchema = z.object({
  campaignCreatorId: entityIdSchema,
  brandFreeFormInstruction: z.string().optional().default(""),
});

export const initiateEmailOutreachInputSchema = z.object({
  campaignCreatorId: entityIdSchema,
  requestId: requestIdSchema,
  finalSubject: z.string().trim().min(1),
  finalBody: z.string().trim().min(1),
});

export const confirmPriorityDmOutreachInputSchema = z.object({
  campaignCreatorId: entityIdSchema,
  requestId: requestIdSchema,
  finalBody: z.string().trim().min(1),
});

// Attempt sequence, quota, scheduler state, tracking token and execution status are server-owned.
export const retryEmailComposeInputSchema = z.object({
  campaignCreatorId: entityIdSchema,
  requestId: requestIdSchema,
});

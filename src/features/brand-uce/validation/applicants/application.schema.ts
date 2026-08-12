import { z } from "zod";
import {
  entityIdSchema,
  requestIdSchema,
} from "../shared/campaign.shared.schema";

export const createApplicationInputSchema = z.object({
  campaignId: entityIdSchema,
  campaignCreatorId: entityIdSchema,
  campaignAssetId: entityIdSchema,
  briefId: entityIdSchema,
  requestId: requestIdSchema,
});

export const withdrawApplicationInputSchema = z.object({
  applicationId: entityIdSchema,
});
export const approveApplicationInputSchema = z.object({
  applicationId: entityIdSchema,
});
export const rejectApplicationInputSchema = z.object({
  applicationId: entityIdSchema,
});

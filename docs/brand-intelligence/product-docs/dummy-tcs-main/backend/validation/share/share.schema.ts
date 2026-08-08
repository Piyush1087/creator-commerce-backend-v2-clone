import { z } from "zod";
import { campaignShareChannelSchema, entityIdSchema, requestIdSchema } from "../shared/campaign.shared.schema";

export const executeCampaignShareInputSchema = z.object({
  campaignId: entityIdSchema,
  channel: campaignShareChannelSchema,
  requestId: requestIdSchema,
});

// trackingToken, initiatedAt and LINK_CLICKED evidence are server-owned.
// Composer content remains ephemeral for MVP and is intentionally absent from persistence input.

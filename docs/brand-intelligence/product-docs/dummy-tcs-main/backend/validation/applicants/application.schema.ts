import { z } from "zod";
import { entityIdSchema, requestIdSchema } from "../shared/campaign.shared.schema";

export const createApplicationInputSchema = z.object({
  campaignId: entityIdSchema,
  campaignCreatorId: entityIdSchema,
  campaignAssetId: entityIdSchema,
  briefId: entityIdSchema,
  requestId: requestIdSchema,
});

// Application source is derived server-side from valid DIRECT/OUTREACH/SHARE entry evidence.
// Snapshot contents are assembled server-side from authoritative submission-time state.
// Clients must not author attribution or campaign/commercial/brief snapshots.
export const withdrawApplicationInputSchema = z.object({ applicationId: entityIdSchema });
export const approveApplicationInputSchema = z.object({ applicationId: entityIdSchema });
export const rejectApplicationInputSchema = z.object({ applicationId: entityIdSchema });

// No generic updateApplication schema by design. Lifecycle actions are explicit commands.

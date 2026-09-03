import { z } from "zod";

export const EmptyChatCapabilityInputSchema = z.object({}).strict();

export const OfferingChatCapabilityInputSchema = z
  .object({ offeringId: z.string().trim().min(1).max(128) })
  .strict();

export const CampaignChatCapabilityInputSchema = z
  .object({ campaignId: z.string().trim().min(1).max(128) })
  .strict();

export const CollaborationChatCapabilityInputSchema = z
  .object({ collaborationId: z.string().trim().min(1).max(128) })
  .strict();

export const NavigateChatCapabilityInputSchema = z
  .object({
    destinationId: z.enum([
      "HOME",
      "BRAND_CENTRE",
      "OFFERINGS",
      "CAMPAIGNS",
      "COLLABORATIONS",
      "SETTINGS",
      "SETTINGS_INTEGRATIONS",
      "SETTINGS_BILLING",
    ]),
    entity: z
      .object({
        type: z.enum(["BRAND", "OFFERING", "CAMPAIGN", "COLLABORATION"]),
        id: z.string().trim().min(1).max(128),
      })
      .strict()
      .optional(),
  })
  .strict();

import { z } from "zod";
import {
  briefTypeSchema,
  entityIdSchema,
  mediaPlatformSchema,
  mvpCampaignPlatformSchema,
  structuredJsonSchema,
} from "../shared/campaign.shared.schema";

export const addCampaignAssetInputSchema = z.discriminatedUnion("kind", [
  z.object({ campaignId: entityIdSchema, kind: z.literal("BRAND"), brandProfileId: entityIdSchema }),
  z.object({ campaignId: entityIdSchema, kind: z.literal("OFFERING"), offeringId: entityIdSchema }),
  z.object({ campaignId: entityIdSchema, kind: z.literal("OFFER"), brandOfferId: entityIdSchema }),
]);

// Domain command name is "deactivate"; campaign_schema.prisma v1.8 persists this as
// UceCampaignAsset.status = PAUSED. There is intentionally no invented INACTIVE Prisma state.
export const deactivateCampaignAssetInputSchema = z.object({
  campaignId: entityIdSchema,
  campaignAssetId: entityIdSchema,
});

// Current frozen Campaign artifacts enumerate deliverable formats but do not freeze the internal
// keys for each configuration/creativeGuidance JSON object. Do not invent those keys here.
// Format remains discriminated and the JSON boundary is explicit until the deliverable FCS is frozen.
const deliverableBase = z.object({
  displayOrder: z.coerce.number().int().min(0),
  configuration: structuredJsonSchema.optional().nullable(),
  creativeGuidance: structuredJsonSchema.optional().nullable(),
  amplifyTargetDeliverableId: entityIdSchema.optional().nullable(),
});

export const briefDeliverableInputSchema = z.discriminatedUnion("format", [
  deliverableBase.extend({ format: z.literal("REEL_VIDEO") }),
  deliverableBase.extend({ format: z.literal("STORY") }),
  deliverableBase.extend({ format: z.literal("PHOTOSHOOT") }),
  deliverableBase.extend({ format: z.literal("BANNER_CAROUSEL") }),
]);

const briefDraftFields = z.object({
  briefName: z.string().trim().min(1).optional().nullable(),
  creativeIntent: z.string().trim().min(1).optional().nullable(),
  creatorBrief: z.string().trim().min(1).optional().nullable(),
  briefType: briefTypeSchema.optional().nullable(),
  // Draft persistence remains future-ready. Publication is Instagram-only for MVP.
  platform: mediaPlatformSchema.optional().nullable(),
  briefLevelGuidance: structuredJsonSchema.optional().nullable(),
  referenceContent: structuredJsonSchema.optional().nullable(),
  usageRights: structuredJsonSchema.optional().nullable(),
  creatorRequirements: z.string().trim().min(1).optional().nullable(),
  deliverables: z.array(briefDeliverableInputSchema).optional(),
});

export const createBriefDraftInputSchema = z.object({
  campaignAssetId: entityIdSchema,
  creationSource: z.enum(["MANUAL", "AI_RECOMMENDED"]).default("MANUAL"),
}).merge(briefDraftFields);

export const updateBriefDraftInputSchema = z.object({ briefId: entityIdSchema }).merge(briefDraftFields)
  .refine((v) => Object.keys(v).some((k) => k !== "briefId"), { message: "At least one Brief field must be supplied." });

// Publishability requirements supported by the frozen Prisma/domain artifacts.
// More granular content requirements must come from the Brief FCS, not be invented here.
export const publishBriefInputSchema = z.object({
  briefId: entityIdSchema,
  briefName: z.string().trim().min(1),
  creativeIntent: z.string().trim().min(1),
  creatorBrief: z.string().trim().min(1),
  briefType: briefTypeSchema,
  platform: mvpCampaignPlatformSchema,
  deliverables: z.array(briefDeliverableInputSchema).min(1),
  briefLevelGuidance: structuredJsonSchema.optional().nullable(),
  referenceContent: structuredJsonSchema.optional().nullable(),
  usageRights: structuredJsonSchema.optional().nullable(),
  creatorRequirements: z.string().trim().min(1).optional().nullable(),
});

// Exact material-vs-presentational field permissions after publication are service-owned.
export const updatePublishedBriefInputSchema = z.object({
  briefId: entityIdSchema,
  briefName: z.string().trim().min(1).optional(),
  creativeIntent: z.string().trim().min(1).optional(),
  creatorBrief: z.string().trim().min(1).optional(),
  creatorRequirements: z.string().trim().min(1).optional().nullable(),
}).refine((v) => Object.keys(v).some((k) => k !== "briefId"), { message: "At least one Brief field must be supplied." });

export const pauseBriefInputSchema = z.object({ briefId: entityIdSchema });

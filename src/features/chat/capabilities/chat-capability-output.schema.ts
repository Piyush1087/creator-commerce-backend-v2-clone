import { z } from "zod";

import { IntelligenceConsumerResultSchema } from "../../intelligence-consumer/intelligence-consumer.schema";
import { CHAT_CAPABILITY_AVAILABILITY } from "./chat-capability.contract";

const EntityRefSchema = z
  .object({
    type: z.enum(["BRAND", "OFFERING", "CAMPAIGN"]),
    id: z.string().trim().min(1).max(128),
  })
  .strict();

export const WorkspaceContextCapabilityOutputSchema = z
  .object({
    workspaceBrand: EntityRefSchema,
    membershipRole: z.string().trim().min(1).max(64),
    surface: z.enum(["HOME", "WORKSPACE", "MODULE"]),
    capabilities: z.array(
      z
        .object({
          capabilityId: z.string().trim().min(1).max(128),
          availability: z.enum(CHAT_CAPABILITY_AVAILABILITY),
        })
        .strict(),
    ),
  })
  .strict();

export const BrandCurrentCapabilityOutputSchema = z
  .object({
    brandId: z.string().trim().min(1).max(128),
    observedAt: z.string().trim().min(1).max(128),
    canonicalSnapshotRef: z.string().trim().min(1).max(512),
    fields: z.array(
      z
        .object({
          semantic: z.string().trim().min(1).max(128),
          value: z.string().nullable(),
          authority: z.string().trim().min(1).max(128),
          provenanceStatus: z.string().trim().min(1).max(128).optional(),
          resolutionStatus: z.string().trim().min(1).max(128).optional(),
          fallbackUsed: z.boolean(),
          conflictDetected: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export const OfferingListCapabilityOutputSchema = z
  .object({
    offerings: z.array(
      z
        .object({
          offeringId: z.string().trim().min(1).max(128),
          name: z.string(),
          kind: z.string().trim().min(1).max(128),
          subtype: z.string().nullable(),
          lifecycle: z.string().trim().min(1).max(128),
        })
        .strict(),
    ),
  })
  .strict();

export const OfferingReadCapabilityOutputSchema = z
  .object({
    offeringId: z.string().trim().min(1).max(128),
    name: z.string(),
    canonicalKind: z.string().nullable(),
    canonicalSubtype: z.string().nullable(),
    canonicalLifecycle: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string(),
  })
  .strict();

export const IntelligenceCapabilityOutputSchema =
  IntelligenceConsumerResultSchema;

export const CampaignListCapabilityOutputSchema = z.array(
  z
    .object({
      campaign_id: z.string().trim().min(1).max(128),
      campaign_name: z.string(),
      current_status: z.string().trim().min(1).max(128),
      core_objective: z.string().nullable(),
      product_count: z.number().int().nonnegative(),
      brief_count: z.number().int().nonnegative(),
      prospects_count: z.number().int().nonnegative(),
      applicants_count: z.number().int().nonnegative(),
      active_collabs_count: z.number().int().nonnegative(),
      total_spend_to_date: z.number(),
      total_impressions: z.string(),
      budget_pool: z.number(),
      created_at: z.string().trim().min(1).max(128),
      updated_at: z.string().trim().min(1).max(128),
    })
    .strict(),
);

export const CampaignReadCapabilityOutputSchema = z
  .object({
    campaignId: z.string().trim().min(1).max(128),
    campaignName: z.string(),
    currentStatus: z.string().trim().min(1).max(128),
    canEditEssentials: z.boolean(),
    totalInventoryAllocated: z.number().int().nonnegative(),
    pauseWarning: z.string().nullable(),
  })
  .strict();

export const NavigateCapabilityOutputSchema = z
  .object({
    destinationId: z.enum(["HOME", "BRAND_CENTRE", "OFFERINGS", "CAMPAIGNS"]),
    entityRef: EntityRefSchema.optional(),
  })
  .strict();

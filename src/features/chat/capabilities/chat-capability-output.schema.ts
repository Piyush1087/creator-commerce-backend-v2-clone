import { z } from "zod";
import {
  UceCollabStatus,
  UceMilestoneStage,
  UcePipelineHealthStatus,
  UceProductionPhase,
  UceWorkflowActionRole,
} from "@prisma/client";

import { IntelligenceConsumerResultSchema } from "../../intelligence-consumer/intelligence-consumer.schema";
import { CHAT_CAPABILITY_AVAILABILITY } from "./chat-capability.contract";

const EntityRefSchema = z
  .object({
    type: z.enum(["BRAND", "OFFERING", "CAMPAIGN", "COLLABORATION"]),
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

const CollaborationIdentitySchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    name: z.string().max(500),
  })
  .strict();

const CollaborationCreatorSchema = z
  .object({
    displayName: z.string().trim().min(1).max(500),
    instagramHandle: z.string().trim().min(1).max(255).nullable(),
  })
  .strict();

const CollaborationBriefSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    title: z.string().max(500),
  })
  .strict();

const CampaignProductSchema = CollaborationIdentitySchema.nullable();
const TimestampSchema = z.string().datetime();

export const CollaborationListCapabilityOutputSchema = z
  .object({
    collaborations: z.array(
      z
        .object({
          collaborationId: z.string().trim().min(1).max(128),
          campaign: CollaborationIdentitySchema,
          brief: CollaborationBriefSchema,
          campaignProduct: CampaignProductSchema,
          creator: CollaborationCreatorSchema,
          lifecycle: z
            .object({
              stage: z.nativeEnum(UceMilestoneStage),
              status: z.nativeEnum(UceCollabStatus),
              phase: z.nativeEnum(UceProductionPhase),
              paused: z.boolean(),
              terminated: z.boolean(),
            })
            .strict(),
          attention: z
            .object({
              health: z.nativeEnum(UcePipelineHealthStatus),
              actionRequiredBy: z.nativeEnum(UceWorkflowActionRole),
              reasonCodes: z.array(z.string().trim().min(1).max(128)),
              dueAt: TimestampSchema,
            })
            .strict(),
          unreadCount: z.number().int().nonnegative(),
          lastMessageSnippet: z.string().max(200).nullable(),
          lastMessageAt: TimestampSchema.nullable(),
          stageUpdatedAt: TimestampSchema,
          updatedAt: TimestampSchema,
        })
        .strict(),
    ),
  })
  .strict();

export const CollaborationReadCapabilityOutputSchema = z
  .object({
    collaborationId: z.string().trim().min(1).max(128),
    campaign: CollaborationIdentitySchema,
    brief: CollaborationBriefSchema,
    campaignProduct: CampaignProductSchema,
    creator: CollaborationCreatorSchema,
    lifecycle: z
      .object({
        stage: z.nativeEnum(UceMilestoneStage),
        status: z.nativeEnum(UceCollabStatus),
        phase: z.nativeEnum(UceProductionPhase),
        milestone: z.nativeEnum(UceMilestoneStage),
        paused: z.boolean(),
        terminated: z.boolean(),
        pipelineHealth: z.nativeEnum(UcePipelineHealthStatus),
        actionRequiredBy: z.nativeEnum(UceWorkflowActionRole),
      })
      .strict(),
    attention: z
      .object({
        reasonCodes: z.array(z.string().trim().min(1).max(128)),
        currentMilestoneDueAt: TimestampSchema,
        autoApprovalDueAt: TimestampSchema.nullable(),
        productionDueAt: TimestampSchema.nullable(),
      })
      .strict(),
    activity: z
      .object({
        negotiationRounds: z.number().int().nonnegative(),
        fulfillmentIssues: z.number().int().nonnegative(),
        revisionRounds: z.number().int().nonnegative(),
        unreadCount: z.number().int().nonnegative(),
        lastMessageSnippet: z.string().max(200).nullable(),
        lastMessageAt: TimestampSchema.nullable(),
        stageUpdatedAt: TimestampSchema,
        updatedAt: TimestampSchema,
      })
      .strict(),
  })
  .strict();

export const WorkspaceReadinessCapabilityOutputSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    brandId: z.string().trim().min(1).max(128),
    observedAt: TimestampSchema,
    workspace: z
      .object({
        state: z.enum(["READY", "PARTIAL", "ACTION_REQUIRED"]),
        reasonCodes: z.array(z.string().trim().min(1).max(128)),
      })
      .strict(),
    subscription: z
      .object({
        state: z.enum(["FULL_ACCESS", "RESTRICTED_WIND_DOWN"]),
        lifecycleStatus: z.enum([
          "TRIALING",
          "ACTIVE",
          "PAST_DUE",
          "CANCEL_SCHEDULED",
          "TRIAL_EXPIRED",
          "CANCELLED",
          "HALTED",
        ]),
        requiredAction: z.enum([
          "NONE",
          "PAYMENT_REQUIRED",
          "UPDATE_PAYMENT_METHOD",
        ]),
      })
      .strict(),
    applicationCapabilities: z.array(
      z
        .object({
          id: z.string().trim().min(1).max(128),
          state: z.enum(["AVAILABLE", "BLOCKED"]),
          reasonCode: z.string().trim().min(1).max(128),
        })
        .strict(),
    ),
    billing: z
      .object({
        state: z.enum(["READY", "ACTION_REQUIRED", "NOT_APPLICABLE"]),
        missingFieldCodes: z.array(z.string().trim().min(1).max(128)),
        recoveryDestinationId: z.literal("SETTINGS_BILLING").nullable(),
      })
      .strict(),
    setupItems: z.array(
      z
        .object({
          reasonCode: z.string().trim().min(1).max(128),
          title: z.string().trim().min(1).max(500),
          destinationId: z.enum(["BRAND_CENTRE", "SETTINGS_BILLING"]),
        })
        .strict(),
    ),
    limitations: z.array(z.string().max(500)),
  })
  .strict();

export const ProviderReadinessCapabilityOutputSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    brandId: z.string().trim().min(1).max(128),
    observedAt: TimestampSchema,
    providers: z.array(
      z
        .object({
          provider: z.literal("INSTAGRAM"),
          state: z.enum([
            "READY",
            "LIMITED",
            "ACTION_REQUIRED",
            "UNAVAILABLE",
            "NOT_CONNECTED",
          ]),
          reasonCode: z.string().trim().min(1).max(128),
          affectedProductCapabilities: z.array(
            z.enum([
              "PROFILE",
              "INSIGHTS",
              "BUSINESS_DISCOVERY",
              "CREATOR_DISCOVERY",
            ]),
          ),
          humanActionRequired: z.boolean(),
          recoveryDestinationId: z.literal("SETTINGS_INTEGRATIONS").nullable(),
          freshness: z.enum(["CURRENT", "UNKNOWN"]),
        })
        .strict(),
    ),
    limitations: z.array(z.string().max(500)),
  })
  .strict();

export const NavigateCapabilityOutputSchema = z
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
    entityRef: EntityRefSchema.optional(),
  })
  .strict();

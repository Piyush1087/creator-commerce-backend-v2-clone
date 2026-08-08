import { z } from "zod";
import {
  audienceGenderSchema,
  brandSupportTypeSchema,
  campaignCreationSourceSchema,
  campaignCurrencySchema,
  campaignObjectiveSchema,
  compensationTypeSchema,
  dateTimeSchema,
  entityIdSchema,
  mvpCampaignPlatformSchema,
  nonNegativeMoneySchema,
  payoutTermsSchema,
  percentageSchema,
  publishingScheduleSchema,
  structuredJsonSchema,
  taxonomyIdSchema,
  visibilityScopeSchema,
} from "../shared/campaign.shared.schema";

export const campaignStrategyInputSchema = z.object({
  publishingSchedule: publishingScheduleSchema,
  publishFrom: dateTimeSchema.optional().nullable(),
  publishUntil: dateTimeSchema.optional().nullable(),
  coreObjective: campaignObjectiveSchema,
  primaryKpiId: taxonomyIdSchema,
  supportingKpiIds: z.array(taxonomyIdSchema).default([]),
  // MVP Campaign creation is Instagram-only. Future platforms remain persistence-ready but not writable here.
  platforms: z.array(mvpCampaignPlatformSchema).min(1).max(1).default(["INSTAGRAM"]),
  visibilityScope: visibilityScopeSchema.default("EVERYONE"),
}).superRefine((value, ctx) => {
  if (value.publishingSchedule === "EVERGREEN" && value.publishUntil != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishUntil"], message: "Evergreen campaigns cannot supply publishUntil." });
  }
  if (value.publishingSchedule === "SCHEDULED") {
    if (!value.publishFrom) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishFrom"], message: "Scheduled campaigns require publishFrom." });
    if (!value.publishUntil) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishUntil"], message: "Scheduled campaigns require publishUntil." });
    if (value.publishFrom && value.publishUntil && value.publishUntil <= value.publishFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishUntil"], message: "publishUntil must be after publishFrom." });
    }
  }
});

export const campaignTargetingInputSchema = z.object({
  creatorArchetypes: z.array(taxonomyIdSchema).max(5).default([]),
  minimumFollowers: z.coerce.number().int().min(0).default(0),
  maximumFollowers: z.coerce.number().int().min(0).optional().nullable(),
  audienceAgeMin: z.coerce.number().int().min(0),
  audienceAgeMax: z.coerce.number().int().min(0),
  audienceGender: audienceGenderSchema.default("ALL"),
  audienceAffinityIds: z.array(taxonomyIdSchema).max(5).default([]),
  audienceGeographies: structuredJsonSchema,
}).superRefine((value, ctx) => {
  if (value.maximumFollowers != null && value.maximumFollowers < value.minimumFollowers) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maximumFollowers"], message: "maximumFollowers must be >= minimumFollowers." });
  }
  if (value.audienceAgeMax < value.audienceAgeMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["audienceAgeMax"], message: "audienceAgeMax must be >= audienceAgeMin." });
  }
});

export const campaignCommercialsInputSchema = z.object({
  receivesBrandSupport: z.boolean().default(false),
  brandSupportType: brandSupportTypeSchema.optional().nullable(),
  brandSupportEstimatedValue: nonNegativeMoneySchema.optional().nullable(),
  compensationType: compensationTypeSchema,
  commercialOffer: nonNegativeMoneySchema,
  totalCampaignBudget: nonNegativeMoneySchema,
  advancePaymentPercentage: percentageSchema.default(0),
  payoutTerms: payoutTermsSchema,
  currency: campaignCurrencySchema,
}).superRefine((value, ctx) => {
  if (!value.receivesBrandSupport && (value.brandSupportType != null || value.brandSupportEstimatedValue != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["receivesBrandSupport"], message: "Brand-support fields must be empty when receivesBrandSupport is false." });
  }
  if (value.receivesBrandSupport && !value.brandSupportType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandSupportType"], message: "brandSupportType is required when Brand support is enabled." });
  }
});

const campaignDefinitionSchema = z.object({
  brandProfileId: entityIdSchema,
  name: z.string().trim().min(1).max(50),
  creationSource: campaignCreationSourceSchema.default("MANUAL"),
  aiRecommendationId: entityIdSchema.optional().nullable(),
  aiRecommendationVersion: z.string().trim().min(1).optional().nullable(),
  strategy: campaignStrategyInputSchema,
  targeting: campaignTargetingInputSchema,
  commercials: campaignCommercialsInputSchema,
}).superRefine((value, ctx) => {
  if (value.creationSource === "AI_RECOMMENDED" && !value.aiRecommendationId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["aiRecommendationId"], message: "AI-recommended Campaigns require recommendation provenance." });
  }
});

export const createCampaignDraftInputSchema = campaignDefinitionSchema;

// Draft updates remain broad, but IDs/status/system fields are deliberately absent.
export const updateDraftCampaignInputSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  strategy: campaignStrategyInputSchema.optional(),
  targeting: campaignTargetingInputSchema.optional(),
  commercials: campaignCommercialsInputSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "At least one Campaign field must be supplied." });

// Publication is a transition. Whole-Campaign readiness is loaded and checked by the service.
export const publishCampaignInputSchema = z.object({ campaignId: entityIdSchema });

// Structurally valid LIVE/PAUSED edit candidates. Exact field editability is service-owned.
export const updateLiveCampaignInputSchema = z.object({
  campaignId: entityIdSchema,
  name: z.string().trim().min(1).max(50).optional(),
  strategy: campaignStrategyInputSchema.optional(),
  targeting: campaignTargetingInputSchema.optional(),
  commercials: campaignCommercialsInputSchema.optional(),
}).refine((v) => Object.keys(v).some((k) => k !== "campaignId"), { message: "At least one editable Campaign field must be supplied." });

export const campaignLifecycleCommandSchema = z.object({ campaignId: entityIdSchema });
export const pauseCampaignInputSchema = campaignLifecycleCommandSchema;
export const resumeCampaignInputSchema = campaignLifecycleCommandSchema;
export const completeCampaignInputSchema = campaignLifecycleCommandSchema;
export const archiveCampaignInputSchema = campaignLifecycleCommandSchema;

export type CreateCampaignDraftInput = z.infer<typeof createCampaignDraftInputSchema>;
export type UpdateDraftCampaignInput = z.infer<typeof updateDraftCampaignInputSchema>;
export type UpdateLiveCampaignInput = z.infer<typeof updateLiveCampaignInputSchema>;

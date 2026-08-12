import { z } from "zod";

const campaignObjectiveSchema = z.enum(["PULSE", "PROOF", "PRODUCTION", "PUSH"]);
const publishingScheduleSchema = z.enum(["EVERGREEN", "SCHEDULED"]);
const campaignVisibilitySchema = z.enum([
  "PUBLIC",
  "ELIGIBLE_CREATORS_ONLY",
  "INVITE_ONLY",
]);
const audienceGenderSchema = z.enum(["ALL", "FEMALE", "MALE"]);
const compensationModelSchema = z.enum(["FIXED", "NEGOTIABLE"]);
const payoutTermsSchema = z.enum(["NET_7", "NET_15", "NET_30", "NET_45", "NET_60"]);
const advancePaymentSchema = z.union([
  z.literal(0),
  z.literal(25),
  z.literal(50),
  z.literal(75),
  z.literal(100),
]);
const brandSupportTypeSchema = z.enum([
  "PRODUCT",
  "SERVICE",
  "EXPERIENCE",
  "ACCESS_SUBSCRIPTION",
  "OTHER",
]);

const strategySchema = z
  .object({
    campaign_name: z.string().trim().min(3).max(60),
    publishing_schedule: publishingScheduleSchema,
    publish_from: z.string().datetime().optional().nullable(),
    publish_until: z.string().datetime().optional().nullable(),
    core_objective: campaignObjectiveSchema,
    platforms: z.array(z.literal("INSTAGRAM")).length(1),
    campaign_visibility: campaignVisibilitySchema.default("PUBLIC"),
  })
  .superRefine((value, ctx) => {
    if (value.publishing_schedule === "SCHEDULED") {
      if (!value.publish_from) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publish_from"], message: "Scheduled campaigns require publish_from." });
      }
      if (!value.publish_until) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publish_until"], message: "Scheduled campaigns require publish_until." });
      }
      if (value.publish_from && value.publish_until && new Date(value.publish_until) < new Date(value.publish_from)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publish_until"], message: "publish_until must be on or after publish_from." });
      }
    }
    if (value.publishing_schedule === "EVERGREEN" && value.publish_until != null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publish_until"], message: "Evergreen campaigns cannot supply publish_until." });
    }
  });

const targetingSchema = z
  .object({
    creator_archetypes: z.array(z.string().trim().min(1)).min(1).max(5),
    minimum_followers: z.number().int().min(0),
    maximum_followers: z.number().int().min(0).optional().nullable(),
    audience_age_min: z.number().int().min(13).max(65),
    audience_age_max: z.number().int().min(13).max(65),
    audience_gender: audienceGenderSchema,
    audience_affinity_ids: z.array(z.string().trim().min(1)).max(5).default([]),
    audience_geographies: z.array(z.record(z.unknown())).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.maximum_followers != null && value.maximum_followers <= value.minimum_followers) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maximum_followers"], message: "maximum_followers must be greater than minimum_followers." });
    }
    if (value.audience_age_max < value.audience_age_min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["audience_age_max"], message: "audience_age_max must be >= audience_age_min." });
    }
  });

const commercialsSchema = z
  .object({
    receives_brand_support: z.boolean().default(false),
    brand_support_type: brandSupportTypeSchema.optional().nullable(),
    brand_support_estimated_value: z.number().finite().min(0).optional().nullable(),
    compensation_model: compensationModelSchema,
    commercial_offer: z.number().finite().min(0),
    total_campaign_budget: z.number().finite().min(0),
    advance_payment_percentage: advancePaymentSchema,
    payout_terms: payoutTermsSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.receives_brand_support && (value.brand_support_type != null || value.brand_support_estimated_value != null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["receives_brand_support"], message: "Brand-support fields must be empty when support is disabled." });
    }
    if (value.receives_brand_support && !value.brand_support_type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brand_support_type"], message: "brand_support_type is required when support is enabled." });
    }
    if (value.total_campaign_budget < value.commercial_offer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["total_campaign_budget"], message: "total_campaign_budget must be >= commercial_offer." });
    }
  });

export const canonicalCampaignWizardSchema = z.object({
  strategy: strategySchema,
  targeting: targetingSchema,
  commercials: commercialsSchema,
});

export type CanonicalCampaignWizardPayload = z.infer<typeof canonicalCampaignWizardSchema>;

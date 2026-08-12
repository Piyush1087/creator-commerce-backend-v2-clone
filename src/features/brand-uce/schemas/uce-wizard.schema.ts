import { z } from "zod";

export const UceCampaignStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "LIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);
export const UceTimelineStructureSchema = z.enum([
  "FIXED_DATES",
  "DYNAMIC_MILESTONES",
]);
export const UceCampaignObjectiveSchema = z.enum([
  "BRAND_AWARENESS",
  "TRAFFIC_CLICKS",
  "SALES_CONVERSIONS",
]);
/** Product vocab FIXED maps to persistence FIXED_FEE at the service boundary. */
export const UceCompensationTypeSchema = z.enum([
  "FIXED",
  "FIXED_FEE",
  "NEGOTIABLE",
]);
export const UcePayoutTermsSchema = z.enum([
  "IMMEDIATE",
  "NET_7",
  "NET_15",
  "NET_30",
]);
export const UceMediaPlatformSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
]);

export const Step1StrategySchema = z
  .object({
    campaign_name: z.string().min(3).max(255),
    timeline_type: UceTimelineStructureSchema,
    fixed_start_date: z.string().datetime().optional().nullable(),
    fixed_end_date: z.string().datetime().optional().nullable(),
    dynamic_days_limit: z.number().int().positive().optional().nullable(),
    core_objective: UceCampaignObjectiveSchema,
    platform_deliverables: z
      .array(
        z.object({
          platform: UceMediaPlatformSchema,
          formats: z.array(z.string()).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    if (data.timeline_type === "FIXED_DATES") {
      if (!data.fixed_start_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed parameters require an operational start date.",
          path: ["fixed_start_date"],
        });
      }
      if (!data.fixed_end_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed parameters require a clear completion date.",
          path: ["fixed_end_date"],
        });
      }
      if (
        data.fixed_start_date &&
        data.fixed_end_date &&
        new Date(data.fixed_start_date) >= new Date(data.fixed_end_date)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start date must precede end date.",
          path: ["fixed_end_date"],
        });
      }
    }
    if (data.timeline_type === "DYNAMIC_MILESTONES" && !data.dynamic_days_limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dynamic milestones require dynamic_days_limit.",
        path: ["dynamic_days_limit"],
      });
    }
  });

export const UceVisibilityScopeSchema = z.enum([
  "EVERYONE",
  "ELIGIBLE_ONLY",
  "INVITED_ONLY",
]);

export const UceCampaignVisibilitySchema = z.enum([
  "PUBLIC",
  "ELIGIBLE_CREATORS_ONLY",
  "INVITE_ONLY",
]);

export const UceApplicationScopeSchema = z.enum([
  "EVERYONE",
  "ELIGIBLE_ONLY",
  "INVITED_ONLY",
  "DIRECT_BYPASS",
  "BLENDED_SMART_FUNNEL",
  "VETTED_STEALTH",
]);

export const Step2TargetingSchema = z
  .object({
    industry_vertical: z.string().min(1),
    creator_archetypes: z.array(z.string()).min(1),
    follower_tiers: z.array(z.string()).min(1),
    audience_age_min: z.number().int().min(13),
    audience_age_max: z.number().int().max(65),
    audience_gender: z.string().default("ALL"),
    target_locations: z.array(z.string()).min(1),
    disqualifying_keywords: z.array(z.string()).optional().default([]),
    campaign_visibility: UceCampaignVisibilitySchema.optional(),
    visibility_scopes: z
      .array(UceVisibilityScopeSchema)
      .min(1)
      .default(["EVERYONE"]),
    application_scope: UceApplicationScopeSchema.default("EVERYONE"),
  })
  .refine((data) => data.audience_age_min <= data.audience_age_max, {
    message: "Minimum age cannot exceed maximum age.",
    path: ["audience_age_min"],
  });

export const Step3CommercialsSchema = z
  .object({
    compensation_type: UceCompensationTypeSchema,
    fixed_fee_amount: z.number().nonnegative().optional().default(0),
    negotiable_min_fee: z.number().nonnegative().optional().default(0),
    negotiable_max_fee: z.number().nonnegative().optional().default(0),
    total_campaign_budget_pool: z.number().positive(),
    advance_payment_percentage: z.number().int().min(0).max(100),
    final_balance_terms: UcePayoutTermsSchema,
  })
  .superRefine((data, ctx) => {
    if (
      (data.compensation_type === "FIXED" ||
        data.compensation_type === "FIXED_FEE") &&
      data.fixed_fee_amount <= 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fixed compensation requires a positive fixed_fee_amount.",
        path: ["fixed_fee_amount"],
      });
    }
    if (data.compensation_type === "NEGOTIABLE") {
      if (data.negotiable_min_fee >= data.negotiable_max_fee) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "negotiable_min_fee must be below negotiable_max_fee.",
          path: ["negotiable_min_fee"],
        });
      }
      if (data.negotiable_max_fee <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "negotiable_max_fee must be positive.",
          path: ["negotiable_max_fee"],
        });
      }
    }
  });

export const IntegratedCampaignWizardPayloadSchema = z.object({
  strategy: Step1StrategySchema,
  targeting: Step2TargetingSchema,
  commercials: Step3CommercialsSchema,
});

export type IntegratedCampaignWizardPayload = z.infer<
  typeof IntegratedCampaignWizardPayloadSchema
>;

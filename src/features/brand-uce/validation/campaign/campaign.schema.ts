import { z } from "zod";
import {
  advancePaymentPercentageSchema,
  audienceGenderSchema,
  brandSupportTypeSchema,
  campaignCreationSourceSchema,
  campaignNetPaymentTermsSchema,
  campaignObjectiveSchema,
  campaignVisibilitySchema,
  compensationModelSchema,
  dateTimeSchema,
  entityIdSchema,
  mvpCampaignPlatformSchema,
  nonNegativeMoneySchema,
  publishingScheduleSchema,
  structuredJsonSchema,
  taxonomyIdSchema,
} from "../shared/campaign.shared.schema";

export const campaignNameSchema = z.string().trim().min(3).max(60);

const campaignStrategyFields = {
  publishingSchedule: publishingScheduleSchema,
  publishFrom: dateTimeSchema.optional().nullable(),
  publishUntil: dateTimeSchema.optional().nullable(),
  coreObjective: campaignObjectiveSchema,
  // KPI IDs are deliberately absent: Campaign resolves them from the canonical KPI framework.
  platforms: z
    .array(mvpCampaignPlatformSchema)
    .min(1)
    .max(1)
    .default(["INSTAGRAM"]),
  campaignVisibility: campaignVisibilitySchema.default("PUBLIC"),
};

const validatePublishingWindow = (
  value: {
    publishingSchedule?: "EVERGREEN" | "SCHEDULED";
    publishFrom?: Date | null;
    publishUntil?: Date | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.publishingSchedule === "EVERGREEN" && value.publishUntil != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publishUntil"],
      message: "Evergreen campaigns cannot supply publishUntil.",
    });
  }
  if (value.publishingSchedule === "SCHEDULED") {
    if (!value.publishFrom)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishFrom"],
        message: "Scheduled campaigns require publishFrom.",
      });
    if (!value.publishUntil)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishUntil"],
        message: "Scheduled campaigns require publishUntil.",
      });
    if (
      value.publishFrom &&
      value.publishUntil &&
      value.publishUntil < value.publishFrom
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishUntil"],
        message: "publishUntil must be on or after publishFrom.",
      });
    }
  }
};

export const campaignStrategyInputSchema = z
  .object(campaignStrategyFields)
  .superRefine(validatePublishingWindow);
export const campaignStrategyPatchSchema = z
  .object(campaignStrategyFields)
  .partial()
  .superRefine(validatePublishingWindow);

const campaignTargetingFields = {
  creatorArchetypes: z.array(taxonomyIdSchema).max(5),
  minimumFollowers: z.coerce.number().int().min(0),
  maximumFollowers: z.coerce.number().int().min(0).optional().nullable(),
  audienceAgeMin: z.coerce.number().int().min(13).max(65),
  audienceAgeMax: z.coerce.number().int().min(13).max(65),
  audienceGender: audienceGenderSchema,
  audienceAffinityIds: z.array(taxonomyIdSchema).max(5),
  // Storage is JSON, while normalized Google Maps/Places semantics remain service/adapter-owned.
  audienceGeographies: structuredJsonSchema,
};

const validateTargeting = (
  value: {
    minimumFollowers?: number;
    maximumFollowers?: number | null;
    audienceAgeMin?: number;
    audienceAgeMax?: number;
  },
  ctx: z.RefinementCtx,
) => {
  if (
    value.minimumFollowers != null &&
    value.maximumFollowers != null &&
    value.maximumFollowers <= value.minimumFollowers
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maximumFollowers"],
      message: "maximumFollowers must be greater than minimumFollowers.",
    });
  }
  if (
    value.audienceAgeMin != null &&
    value.audienceAgeMax != null &&
    value.audienceAgeMax < value.audienceAgeMin
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["audienceAgeMax"],
      message: "audienceAgeMax must be >= audienceAgeMin.",
    });
  }
};

export const campaignTargetingInputSchema = z
  .object(campaignTargetingFields)
  .superRefine(validateTargeting);
export const campaignTargetingPatchSchema = z
  .object(campaignTargetingFields)
  .partial()
  .superRefine(validateTargeting);

const campaignCommercialFields = {
  receivesBrandSupport: z.boolean(),
  brandSupportType: brandSupportTypeSchema.optional().nullable(),
  brandSupportEstimatedValue: nonNegativeMoneySchema.optional().nullable(),
  compensationModel: compensationModelSchema,
  commercialOffer: nonNegativeMoneySchema,
  totalCampaignBudget: nonNegativeMoneySchema,
  advancePaymentPercentage: advancePaymentPercentageSchema,
  payoutTerms: campaignNetPaymentTermsSchema,
  // Currency is deliberately absent: it is derived from Brand country by CampaignService.
};

const validateCommercials = (
  value: {
    receivesBrandSupport?: boolean;
    brandSupportType?: z.infer<typeof brandSupportTypeSchema> | null;
    brandSupportEstimatedValue?: number | null;
    commercialOffer?: number;
    totalCampaignBudget?: number;
  },
  ctx: z.RefinementCtx,
) => {
  if (
    value.receivesBrandSupport === false &&
    (value.brandSupportType != null || value.brandSupportEstimatedValue != null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["receivesBrandSupport"],
      message:
        "Brand-support fields must be empty when receivesBrandSupport is false.",
    });
  }
  if (value.receivesBrandSupport === true && !value.brandSupportType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["brandSupportType"],
      message: "brandSupportType is required when Brand support is enabled.",
    });
  }
  if (
    value.commercialOffer != null &&
    value.totalCampaignBudget != null &&
    value.totalCampaignBudget < value.commercialOffer
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["totalCampaignBudget"],
      message: "totalCampaignBudget must be >= commercialOffer.",
    });
  }
};

export const campaignCommercialsInputSchema = z
  .object(campaignCommercialFields)
  .superRefine(validateCommercials);
export const campaignCommercialsPatchSchema = z
  .object(campaignCommercialFields)
  .partial()
  .superRefine(validateCommercials);

// Drafts may be incomplete. Invalid entered values are rejected at the field/update boundary while untouched fields may remain absent.
export const createCampaignDraftInputSchema = z.object({
  brandProfileId: entityIdSchema,
  creationSource: z.literal("MANUAL").default("MANUAL"),
  name: campaignNameSchema.optional(),
  strategy: campaignStrategyPatchSchema.optional(),
  targeting: campaignTargetingPatchSchema.optional(),
  commercials: campaignCommercialsPatchSchema.optional(),
});

export const updateDraftCampaignInputSchema = z
  .object({
    name: campaignNameSchema.optional(),
    strategy: campaignStrategyPatchSchema.optional(),
    targeting: campaignTargetingPatchSchema.optional(),
    commercials: campaignCommercialsPatchSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one Campaign field must be supplied.",
  });

// Step-completion schemas are complete snapshots of their respective Create Campaign steps.
// Derived KPI/currency readiness is checked by CampaignService because those values are not Brand-authored inputs.
export const campaignStep1CompletionSchema = z.object({
  name: campaignNameSchema,
  strategy: campaignStrategyInputSchema,
});

export const campaignStep2CompletionSchema =
  campaignTargetingInputSchema.superRefine((value, ctx) => {
    if (value.creatorArchetypes.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["creatorArchetypes"],
        message: "At least one creator archetype is required.",
      });
    }
  });

export const campaignStep3CompletionSchema = campaignCommercialsInputSchema;

// Publication is a transition. CampaignService loads the Draft and performs complete aggregate validation,
// including canonical taxonomy membership, derived KPI/currency readiness, publishing-window date-vs-today rules, and ownership.
export const publishCampaignInputSchema = z.object({
  campaignId: entityIdSchema,
});

// Post-publish edits accept partial structurally valid field patches. Exact lifecycle/creation-source editability is service-owned.
export const updateLiveCampaignInputSchema = z
  .object({
    campaignId: entityIdSchema,
    name: campaignNameSchema.optional(),
    strategy: campaignStrategyPatchSchema.optional(),
    targeting: campaignTargetingPatchSchema.optional(),
    commercials: campaignCommercialsPatchSchema.optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "campaignId"), {
    message: "At least one editable Campaign field must be supplied.",
  });

// Alias makes the schema's PUBLISHED/LIVE/PAUSED scope explicit without breaking existing imports.
export const updatePostPublishCampaignInputSchema =
  updateLiveCampaignInputSchema;

// AI-recommended Campaign creation has no persisted Draft. Its atomic Campaign + Product + Brief launch is a separate service transaction.
export const aiRecommendedCampaignProvenanceSchema = z.object({
  creationSource: z.literal("AI_RECOMMENDED"),
  aiRecommendationId: entityIdSchema,
  aiRecommendationVersion: z.string().trim().min(1),
});

export const campaignLifecycleCommandSchema = z.object({
  campaignId: entityIdSchema,
});
export const pauseCampaignInputSchema = campaignLifecycleCommandSchema;
export const resumeCampaignInputSchema = campaignLifecycleCommandSchema;
export const completeCampaignInputSchema = campaignLifecycleCommandSchema;
export const archiveCampaignInputSchema = campaignLifecycleCommandSchema;

export type CreateCampaignDraftInput = z.infer<
  typeof createCampaignDraftInputSchema
>;
export type UpdateDraftCampaignInput = z.infer<
  typeof updateDraftCampaignInputSchema
>;
export type UpdateLiveCampaignInput = z.infer<
  typeof updateLiveCampaignInputSchema
>;

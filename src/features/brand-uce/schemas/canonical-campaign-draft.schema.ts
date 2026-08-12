import { z } from "zod";

export const canonicalCampaignDraftPathSchema = z.enum([
  "strategy.campaign_name",
  "strategy.publishing_schedule",
  "strategy.publish_from",
  "strategy.publish_until",
  "strategy.core_objective",
  "strategy.campaign_visibility",
  "targeting.creator_archetypes",
  "targeting.minimum_followers",
  "targeting.maximum_followers",
  "targeting.audience_age_min",
  "targeting.audience_age_max",
  "targeting.audience_gender",
  "targeting.audience_affinity_ids",
  "targeting.audience_geographies",
  "commercials.receives_brand_support",
  "commercials.brand_support_type",
  "commercials.brand_support_estimated_value",
  "commercials.compensation_model",
  "commercials.commercial_offer",
  "commercials.total_campaign_budget",
  "commercials.advance_payment_percentage",
  "commercials.payout_terms",
]);

export const canonicalCampaignDraftPatchSchema = z.object({
  path: canonicalCampaignDraftPathSchema,
  value: z.unknown(),
});

export type CanonicalCampaignDraftPath = z.infer<
  typeof canonicalCampaignDraftPathSchema
>;

const valueSchemas: Record<CanonicalCampaignDraftPath, z.ZodTypeAny> = {
  "strategy.campaign_name": z.string().trim().min(3).max(60),
  "strategy.publishing_schedule": z.enum(["EVERGREEN", "SCHEDULED"]),
  "strategy.publish_from": z.string().datetime().nullable(),
  "strategy.publish_until": z.string().datetime().nullable(),
  "strategy.core_objective": z.enum(["PULSE", "PROOF", "PRODUCTION", "PUSH"]),
  "strategy.campaign_visibility": z.enum([
    "PUBLIC",
    "ELIGIBLE_CREATORS_ONLY",
    "INVITE_ONLY",
  ]),
  "targeting.creator_archetypes": z.array(z.string().trim().min(1)).min(1).max(5),
  "targeting.minimum_followers": z.number().int().min(0),
  "targeting.maximum_followers": z.number().int().min(0).nullable(),
  "targeting.audience_age_min": z.number().int().min(13).max(65),
  "targeting.audience_age_max": z.number().int().min(13).max(65),
  "targeting.audience_gender": z.enum(["ALL", "FEMALE", "MALE"]),
  "targeting.audience_affinity_ids": z.array(z.string().trim().min(1)).max(5),
  "targeting.audience_geographies": z.array(z.record(z.unknown())),
  "commercials.receives_brand_support": z.boolean(),
  "commercials.brand_support_type": z
    .enum(["PRODUCT", "SERVICE", "EXPERIENCE", "ACCESS_SUBSCRIPTION", "OTHER"])
    .nullable(),
  "commercials.brand_support_estimated_value": z.number().finite().min(0).nullable(),
  "commercials.compensation_model": z.enum(["FIXED", "NEGOTIABLE"]),
  "commercials.commercial_offer": z.number().finite().min(0),
  "commercials.total_campaign_budget": z.number().finite().min(0),
  "commercials.advance_payment_percentage": z.union([
    z.literal(0),
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(100),
  ]),
  "commercials.payout_terms": z.enum(["NET_7", "NET_15", "NET_30", "NET_45", "NET_60"]),
};

export function parseCanonicalDraftValue(
  path: CanonicalCampaignDraftPath,
  value: unknown,
): unknown {
  return valueSchemas[path].parse(value);
}

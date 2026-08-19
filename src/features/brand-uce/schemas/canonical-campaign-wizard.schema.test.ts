import { describe, expect, it } from "vitest";

import { canonicalCampaignWizardSchema } from "./canonical-campaign-wizard.schema";

const validPayload = {
  strategy: {
    campaign_name: "Summer Skin Reset",
    publishing_schedule: "EVERGREEN" as const,
    publish_from: null,
    publish_until: null,
    core_objective: "PROOF" as const,
    platforms: ["INSTAGRAM"] as const,
    campaign_visibility: "PUBLIC" as const,
  },
  targeting: {
    creator_archetypes: ["EDUCATOR"] as const,
    minimum_followers: 20_000,
    maximum_followers: 100_000,
    audience_age_min: 18,
    audience_age_max: 34,
    audience_gender: "ALL" as const,
    audience_affinity_ids: ["SKINCARE"] as const,
    audience_geographies: [
      {
        scope: "COUNTRY" as const,
        label: "India",
        country_code: "IN",
        locality: null,
        region: null,
        radius_km: null,
        is_primary: true,
      },
    ],
  },
  commercials: {
    receives_brand_support: false,
    brand_support_type: null,
    brand_support_estimated_value: null,
    compensation_model: "FIXED" as const,
    commercial_offer: 10_000,
    total_campaign_budget: 100_000,
    advance_payment_percentage: 25 as const,
    payout_terms: "NET_30" as const,
  },
};

describe("canonical Campaign wizard taxonomy boundary", () => {
  it("accepts canonical affinities and normalized geography", () => {
    expect(canonicalCampaignWizardSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects free-form affinity IDs", () => {
    expect(
      canonicalCampaignWizardSchema.safeParse({
        ...validPayload,
        targeting: { ...validPayload.targeting, audience_affinity_ids: ["MY_CUSTOM_INTEREST"] },
      }).success,
    ).toBe(false);
  });

  it("rejects unnormalized geography labels", () => {
    expect(
      canonicalCampaignWizardSchema.safeParse({
        ...validPayload,
        targeting: { ...validPayload.targeting, audience_geographies: [{ label: "Mumbai" }] },
      }).success,
    ).toBe(false);
  });

  it("allows Global only as a standalone normalized geography", () => {
    const global = {
      scope: "GLOBAL" as const,
      label: "Global",
      country_code: null,
      locality: null,
      region: null,
      radius_km: null,
      is_primary: true,
    };
    expect(
      canonicalCampaignWizardSchema.safeParse({
        ...validPayload,
        targeting: { ...validPayload.targeting, audience_geographies: [global] },
      }).success,
    ).toBe(true);
    expect(
      canonicalCampaignWizardSchema.safeParse({
        ...validPayload,
        targeting: {
          ...validPayload.targeting,
          audience_geographies: [global, ...validPayload.targeting.audience_geographies],
        },
      }).success,
    ).toBe(false);
  });
});

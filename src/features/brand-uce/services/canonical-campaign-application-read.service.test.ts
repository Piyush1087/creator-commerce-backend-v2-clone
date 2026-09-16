import {
  UceBriefStatus,
  UceCampaignAssetStatus,
  UceCampaignStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { projectCanonicalCampaignForApplication } from "./canonical-campaign-application-read.service";
import {
  campaignDefinitionSnapshotRef,
  hashCanonicalCampaignDefinition,
} from "./canonical-campaign-definition";

function campaignFixture() {
  return {
    id: "campaign-1",
    brandProfileId: "brand-1",
    name: "Canonical Campaign",
    status: UceCampaignStatus.PUBLISHED,
    creationSource: "MANUAL",
    canonicalDefinition: null,
    canonicalDefinitionHash: null,
    liveAt: null,
    applicationDeadline: null,
    strategy: { platforms: ["INSTAGRAM"] },
    targeting: {
      visibilityScope: "EVERYONE",
      visibilityScopes: ["EVERYONE"],
    },
    commercials: {
      canonicalVersion: 1,
      commercialOffer: 100,
      currency: "INR",
      receivesBrandSupport: false,
      brandSupportType: null,
      brandSupportEstimatedValue: null,
      totalCampaignBudgetPool: 1000,
    },
    assets: [
      {
        id: "asset-1",
        campaignId: "campaign-1",
        kind: "BRAND",
        status: UceCampaignAssetStatus.ACTIVE,
        canonicalBriefs: [
          {
            id: "brief-1",
            campaignAssetId: "asset-1",
            status: UceBriefStatus.PUBLISHED,
            briefName: "Creator-led launch",
            creativeIntent: "Demonstrate a credible daily routine.",
            creatorBrief: "Show the product clearly in natural daylight.",
            briefType: "CREATOR_LED",
            platform: "INSTAGRAM",
            briefLevelGuidance: null,
            referenceContent: null,
            usageRights: null,
            creatorRequirements: null,
            deliverables: [
              {
                id: "reel-1",
                format: "REEL_VIDEO",
                displayOrder: 0,
                configuration: null,
                creativeGuidance: null,
                amplifyTargetDeliverableId: null,
              },
              {
                id: "reel-2",
                format: "REEL_VIDEO",
                displayOrder: 1,
                configuration: null,
                creativeGuidance: null,
                amplifyTargetDeliverableId: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("C03 canonical Campaign-for-Application adapter", () => {
  it.each(["AWARENESS", "TRUST", "ASSETS", "ACTION"] as const)(
    "preserves the complete Campaign objective handoff for %s",
    (objective) => {
      const fixture = campaignFixture();
      const canonicalDefinition = {
        version: "2.0",
        creationSource: "MANUAL",
        strategy: {
          objective,
          platforms: ["INSTAGRAM"],
          campaign_visibility: "PUBLIC",
        },
        targeting: {},
        commercials: {
          compensation_model: "FIXED",
          receives_brand_support: false,
          brand_support_type: null,
          brand_support_estimated_value: null,
          commercial_offer: 100,
          total_campaign_budget: 1000,
        },
        derived: { currency: "INR" },
      };
      const hash = hashCanonicalCampaignDefinition(canonicalDefinition);
      fixture.canonicalDefinition = canonicalDefinition as never;
      fixture.canonicalDefinitionHash = hash;
      fixture.strategy = {
        ...fixture.strategy,
        coreObjective: objective,
      } as never;

      const result = projectCanonicalCampaignForApplication(fixture as never);

      expect(result.campaign.objectiveHandoff).toEqual({
        status: "AVAILABLE",
        objective,
        objectiveContract: "CAMPAIGN_OBJECTIVE_V1",
        campaignDefinition: {
          version: "2.0",
          snapshotRef: campaignDefinitionSnapshotRef("campaign-1", "2.0", hash),
          hash,
        },
      });
      expect(result.campaign.objective).toBe(objective);
    },
  );

  it("preserves the unavailable handoff and keeps compatibility objective null", () => {
    const fixture = campaignFixture();
    fixture.strategy = {
      ...fixture.strategy,
      coreObjective: "BRAND_AWARENESS",
    } as never;

    const result = projectCanonicalCampaignForApplication(fixture as never);

    expect(result.campaign.objectiveHandoff).toEqual({
      status: "UNAVAILABLE",
      reason: "LEGACY_OBJECTIVE_UNRESOLVED",
    });
    expect(result.campaign.objective).toBeNull();
  });

  it("preserves Brand Assets and repeated Deliverable formats", () => {
    const result = projectCanonicalCampaignForApplication(
      campaignFixture() as never,
    );

    expect(result.adapterVersion).toBe("C03_CAMPAIGN_APPLICATION_READ_V1");
    expect(result.campaign.visibility).toEqual({
      state: "AVAILABLE",
      value: "EVERYONE",
    });
    expect(result.campaign.commercial).toMatchObject({
      state: "AVAILABLE",
      canonicalVersion: 1,
      currency: "INR",
    });
    expect(result.assets[0]).toMatchObject({ kind: "BRAND" });
    expect(result.assets[0].briefs[0].applicationSelection).toEqual({
      state: "AVAILABLE",
    });
    expect(
      result.assets[0].briefs[0].definition.deliverables.map(
        (item) => item.format,
      ),
    ).toEqual(["REEL_VIDEO", "REEL_VIDEO"]);
  });

  it("fails closed for conflicting visibility, legacy zero, and minimal Briefs", () => {
    const fixture = campaignFixture();
    fixture.targeting = {
      visibilityScope: null as never,
      visibilityScopes: ["EVERYONE", "INVITED_ONLY"],
    };
    fixture.commercials = {
      ...fixture.commercials,
      canonicalVersion: null as never,
      commercialOffer: null as never,
      currency: null as never,
      receivesBrandSupport: null as never,
    };
    fixture.assets[0].canonicalBriefs[0] = {
      ...fixture.assets[0].canonicalBriefs[0],
      creativeIntent: null as never,
      creatorBrief: null as never,
      briefType: null as never,
      platform: null as never,
      deliverables: [],
    };

    const result = projectCanonicalCampaignForApplication(fixture as never);

    expect(result.campaign.visibility).toEqual({
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_VISIBILITY_CONFIGURATION_INVALID",
    });
    expect(result.campaign.commercial).toEqual({
      state: "UNAVAILABLE",
      reason: "CAMPAIGN_COMMERCIAL_CONFIGURATION_INVALID",
    });
    expect(result.assets[0].briefs[0].applicationSelection).toEqual({
      state: "UNAVAILABLE",
      reason: "BRIEF_DEFINITION_INCOMPLETE",
    });
  });
});

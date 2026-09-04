import {
  UceBriefStatus,
  UceCampaignAssetStatus,
  UceCampaignStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  CampaignQueryService,
  resolveCampaignPageReadiness,
} from "./campaign-query.service";

const readyAsset = {
  status: UceCampaignAssetStatus.ACTIVE,
  briefs: [
    {
      status: UceBriefStatus.PUBLISHED,
      briefName: "Creator launch brief",
      creativeIntent: "Demonstrate a credible daily routine.",
      creatorBrief: "Show the product in natural daylight.",
      briefType: "CREATOR_LED" as const,
      platform: "INSTAGRAM" as const,
      briefLevelGuidance: null,
      referenceContent: null,
      usageRights: null,
      creatorRequirements: null,
      deliverables: [
        {
          id: "deliverable-1",
          format: "REEL_VIDEO" as const,
          displayOrder: 0,
          configuration: null,
          creativeGuidance: { openingHook: true },
          amplifyTargetDeliverableId: null,
        },
      ],
    },
  ],
};

function queryHarness() {
  const mutations = {
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    executeRaw: vi.fn(),
    transaction: vi.fn(),
  };
  const prisma = {
    uceCampaign: {
      findFirst: vi.fn().mockResolvedValue({
        id: "campaign-1",
        name: "Canonical Campaign",
        status: UceCampaignStatus.PUBLISHED,
        creationSource: "MANUAL",
        applicationDeadline: null,
        products: [],
        assets: [
          {
            id: "asset-1",
            kind: "OFFERING",
            status: UceCampaignAssetStatus.ACTIVE,
            brandProfileId: null,
            offeringId: "offering-1",
            brandOfferId: null,
            brandProfile: null,
            offering: {
              name: "Face Serum",
              type: "PRODUCT",
              imageUrl: null,
            },
            brandOffer: null,
            canonicalBriefs: [
              {
                id: "brief-1",
                campaignAssetId: "asset-1",
                status: UceBriefStatus.PUBLISHED,
                creationSource: "MANUAL",
                briefName: "Creator launch brief",
                creativeIntent: "Demonstrate a credible daily routine.",
                creatorBrief: "Show the product in natural daylight.",
                briefType: "CREATOR_LED",
                platform: "INSTAGRAM",
                briefLevelGuidance: null,
                referenceContent: null,
                usageRights: null,
                creatorRequirements: null,
                legacyCreativeRequirements: null,
                deliverables: [
                  {
                    id: "deliverable-1",
                    format: "REEL_VIDEO",
                    displayOrder: 0,
                    configuration: null,
                    creativeGuidance: { openingHook: true },
                    amplifyTargetDeliverableId: null,
                    legacyFormat: null,
                    legacyQuantity: null,
                    legacyCreativeRequirements: null,
                    legacyPublishingRequired: null,
                  },
                ],
              },
            ],
          },
        ],
        strategy: null,
        targeting: null,
        commercials: {
          compensationType: "FIXED_FEE",
          totalCampaignBudgetPool: 1000,
          canonicalVersion: 1,
          commercialOffer: 100,
          currency: "INR",
        },
        collaborations: [],
      }),
    },
    uceApplication: { count: vi.fn().mockResolvedValue(0) },
    uceCampaignCreator: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: mutations.upsert,
      create: mutations.create,
      update: mutations.update,
      delete: mutations.delete,
    },
    $queryRaw: vi.fn(),
    $executeRaw: mutations.executeRaw,
    $transaction: mutations.transaction,
  };
  const applications = { listApplicants: vi.fn() };
  return {
    prisma,
    applications,
    mutations,
    service: new CampaignQueryService(prisma as never, applications as never),
  };
}

describe("Campaign Page readiness and workspace projection", () => {
  it("keeps lifecycle, readiness, and operational capability distinct", () => {
    const published = resolveCampaignPageReadiness({
      status: UceCampaignStatus.PUBLISHED,
      budgetPool: 1000,
      assets: [readyAsset],
    });
    expect(published.ready).toBe(true);
    expect(published.capabilities.canGoLive).toBe(true);
    expect(published.capabilities.canUseOperationalWorkspaces).toBe(false);

    const liveBlocked = resolveCampaignPageReadiness({
      status: UceCampaignStatus.LIVE,
      budgetPool: 0,
      assets: [readyAsset],
    });
    expect(liveBlocked.ready).toBe(false);
    expect(liveBlocked.missingRequirements).toContain("campaign_budget");
    expect(liveBlocked.capabilities.canUseOperationalWorkspaces).toBe(false);
  });

  it("returns exactly the canonical workspaces and truthful unavailable reporting", async () => {
    const { service } = queryHarness();

    const page = await service.getCampaignPage("brand-1", "campaign-1");

    expect(page.readiness).toMatchObject({ ready: true, activeAssetCount: 1 });
    expect(page.assetsBriefsSummary.assets[0]).toMatchObject({
      campaignAssetId: "asset-1",
      name: "Face Serum",
    });
    expect(page.workspaces.map((workspace) => workspace.workspace)).toEqual([
      "discovery",
      "applicants",
      "collaborations",
    ]);
    expect(
      page.workspaces.every((workspace) => workspace.state === "UNAVAILABLE"),
    ).toBe(true);
    expect(page.performanceSummary).toEqual(
      expect.objectContaining({
        state: "UNAVAILABLE",
        metrics: [],
      }),
    );
    expect(page.productsBriefsSummary.authority).toBe("LEGACY_COMPATIBILITY");
  });

  it("hydrates a legacy-only Campaign without inferring canonical links", async () => {
    const { service, prisma, mutations } = queryHarness();
    prisma.uceCampaign.findFirst.mockResolvedValueOnce({
      id: "campaign-legacy",
      name: "Legacy-only Campaign",
      status: UceCampaignStatus.LIVE,
      creationSource: "MANUAL",
      applicationDeadline: null,
      products: [
        {
          id: "legacy-product-1",
          productName: "Legacy Product",
          isActive: true,
          briefs: [
            {
              id: "legacy-brief-1",
              internalTitle: "Legacy Brief",
              isActive: true,
            },
          ],
        },
      ],
      assets: [],
      strategy: null,
      targeting: null,
      commercials: {
        compensationType: "FIXED_FEE",
        totalCampaignBudgetPool: 1000,
        canonicalVersion: null,
        commercialOffer: null,
        currency: null,
      },
      collaborations: [],
    });
    prisma.uceApplication.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const page = await service.getCampaignPage("brand-1", "campaign-legacy");

    expect(page.assetsBriefsSummary).toMatchObject({
      state: "EMPTY",
      assets: [],
    });
    expect(page.productsBriefsSummary).toMatchObject({
      authority: "LEGACY_COMPATIBILITY",
      state: "READY",
    });
    expect(page.productsBriefsSummary.products[0]).toMatchObject({
      campaignAssetId: "legacy-product-1",
      briefs: [{ briefId: "legacy-brief-1" }],
    });
    expect(page.readiness).toEqual({
      ready: false,
      missingRequirements: [
        "campaign_asset",
        "canonical_brief",
        "campaign_budget",
      ],
      remediation: [
        {
          requirement: "campaign_asset",
          message: "Link a canonical Campaign Asset from Brand Centre.",
        },
        {
          requirement: "canonical_brief",
          message: "Create a canonical Brief beneath an active Campaign Asset.",
        },
        {
          requirement: "campaign_budget",
          message: "Configure a positive Campaign budget.",
        },
      ],
      activeAssetCount: 0,
      readyBriefCount: 0,
    });
    expect(page.hydration).toMatchObject({
      outcome: "POST_LIVE_READINESS_BLOCK",
      executionReady: false,
      primaryFocus: "RESTORE_CAMPAIGN_READINESS",
      postLiveReadinessBlocked: true,
    });
    expect(page.workspaces.map((workspace) => workspace.workspace)).toEqual([
      "discovery",
      "applicants",
      "collaborations",
    ]);
    expect(
      page.workspaces.every((workspace) => workspace.state === "UNAVAILABLE"),
    ).toBe(true);
    expect(page.workspaces[1]).toMatchObject({
      workspace: "applicants",
      instantiated: true,
      count: 1,
    });
    expect(mutations.upsert).not.toHaveBeenCalled();
    expect(mutations.create).not.toHaveBeenCalled();
    expect(mutations.update).not.toHaveBeenCalled();
  });

  it("uses only reads while composing the Campaign Page", async () => {
    const { service, mutations } = queryHarness();

    await service.getCampaignPage("brand-1", "campaign-1");

    expect(mutations.upsert).not.toHaveBeenCalled();
    expect(mutations.create).not.toHaveBeenCalled();
    expect(mutations.update).not.toHaveBeenCalled();
    expect(mutations.delete).not.toHaveBeenCalled();
    expect(mutations.executeRaw).not.toHaveBeenCalled();
    expect(mutations.transaction).not.toHaveBeenCalled();
  });

  it("reads persisted creators without backfill and keeps provider results unavailable", async () => {
    const { service, prisma, mutations } = queryHarness();
    prisma.uceCampaign.findFirst.mockResolvedValueOnce({ id: "campaign-1" });
    prisma.uceCampaignCreator.findMany.mockResolvedValueOnce([
      {
        id: "creator-1",
        socialHandle: "creator",
        source: "MANUAL",
      },
    ]);

    const result = await service.getDiscovery("brand-1", "campaign-1");

    expect(result.provider).toEqual({
      availability: "UNAVAILABLE",
      message:
        "Creator recommendations are not available for this Campaign yet.",
      results: [],
    });
    expect(result.creators[0]).toMatchObject({
      campaignCreatorId: "creator-1",
      intelligenceStatus: "UNAVAILABLE",
    });
    expect(mutations.upsert).not.toHaveBeenCalled();
    expect(mutations.create).not.toHaveBeenCalled();
  });
});

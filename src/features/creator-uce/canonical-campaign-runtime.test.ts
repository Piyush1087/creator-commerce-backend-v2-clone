import { BadRequestException } from "@nestjs/common";
import {
  IndustryVertical,
  OfferingType,
  UceCampaignStatus,
  UceCompensationType,
  UserRole,
} from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { BrandUceAccessService } from "../brand-uce/services/brand-uce-access.service";
import { BrandUceBriefService } from "../brand-uce/services/brand-uce-brief.service";
import { BrandUceCampaignService } from "../brand-uce/services/brand-uce-campaign.service";
import { BrandUceProductService } from "../brand-uce/services/brand-uce-product.service";
import { CampaignApplicationService } from "../brand-uce/services/campaign-application.service";
import { CollaborationProvisionService } from "../collaboration/services/collaboration-provision.service";
import { CreatorUceCampaignsService } from "./services/creator-uce-campaigns.service";

const IDS = {
  brand: "f6c00000-0000-4000-8000-000000000001",
  offering: "f6c00000-0000-4000-8000-000000000002",
  creatorUser: "f6c00000-0000-4000-8000-000000000003",
  noAsset: "f6c00000-0000-4000-8000-000000000010",
  assetOnly: "f6c00000-0000-4000-8000-000000000011",
  legacyOnly: "f6c00000-0000-4000-8000-000000000012",
  ready: "f6c00000-0000-4000-8000-000000000013",
  deliverable: "f6c00000-0000-4000-8000-000000000020",
} as const;

const prisma = new PrismaService();
const access = new BrandUceAccessService(prisma);
const campaigns = new BrandUceCampaignService(prisma, access);
const products = new BrandUceProductService(prisma, access);
const briefs = new BrandUceBriefService(prisma, access);
const eligibility = {
  evaluateTargeting: () => ({
    is_eligible: true,
    tier_match: true,
    region_match: true,
    audience_geo_match: true,
  }),
};
const creatorCampaigns = new CreatorUceCampaignsService(
  prisma,
  eligibility as never,
);
const realtime = { broadcast: async () => undefined };
const provision = new CollaborationProvisionService(prisma, realtime as never);
const applicationService = new CampaignApplicationService(
  prisma,
  access,
  {} as never,
  provision,
);

const creator = {
  id: IDS.creatorUser,
  email: "f6c.creator@example.invalid",
  role: UserRole.CREATOR,
};

const productPayload = (campaignId: string) => ({
  asset_type: "INDIVIDUAL_PRODUCT_SKU" as const,
  campaign_id: campaignId,
  canonical_offering_id: IDS.offering,
  product_name: "F6C Acceptance Serum",
  price: 1200,
  pdp_url: "https://example.invalid/f6c-serum",
  thumbnail_asset_url: null,
  brief_description: "Acceptance-only canonical Offering projection.",
  unique_selling_points: ["Acceptance verified"],
  compliance_do_not_say_tokens: [],
  is_sync_locked: true,
});

const briefPayload = (
  campaignId: string,
  productId: string,
  canonicalAssetId: string,
) => ({
  campaign_id: campaignId,
  product_id: productId,
  canonical_campaign_asset_id: canonicalAssetId,
  brief_name: "F6C Canonical Brief",
  purpose: "Verify canonical runtime acceptance.",
  objective: "Create a repeatable acceptance deliverable.",
  target_influencer_archetype: "EDUCATOR",
  brief_type: "CREATOR_LED" as const,
  mandatory_creator_requirements: "Use acceptance-only fixture content.",
  deliverables_inventory: [
    {
      format_type: "REEL_VIDEO" as const,
      video_aspect_ratio: "9_16_VERTICAL" as const,
      video_duration_range: "15_45S" as const,
      is_reel_amplification: false,
    },
  ],
  content_guidance_matrix: [
    {
      deliverable_id: IDS.deliverable,
      format_type: "REEL_VIDEO" as const,
      is_reel_amplification: false,
      creator_led_details: {
        content_theme: "Acceptance",
        description: "Show the acceptance-only product flow.",
        hook_ideas: ["Canonical from selection to snapshot"],
        recommended_b_rolls: "Product and packaging",
        creator_dos: ["Use test content"],
        creator_donts: ["Do not publish externally"],
        audio_strategy: "DIRECT_VOICEOVER" as const,
        lighting_requirements: "NATURAL_DAYLIGHT" as const,
        background_setting: "Neutral test environment",
        tone_of_voice: "RELATABLE_CASUAL" as const,
        post_caption: "F6C acceptance fixture",
        hashtags_and_mentions: ["#f6cAcceptance"],
      },
    },
  ],
  parent_planner_logistics_snapshot: {
    campaign_fulfillment_deadline_descriptor: "14 days",
    fixed_calendar_target_date: "2030-01-31T00:00:00.000Z",
    is_physical_product_gifting_required: false,
    base_escrow_compensation_payout_float: 0,
    commission_incentive_percentage_float: 0,
    link_in_bio_duration_days: 0,
    paid_ads_boosting_whitelist_duration_days: 0,
    organic_reposting_license_duration_days: 0,
  },
});

async function cleanAcceptanceFixtures() {
  await prisma.collaboration.deleteMany({
    where: {
      campaignId: {
        in: [IDS.noAsset, IDS.assetOnly, IDS.legacyOnly, IDS.ready],
      },
    },
  });
  await prisma.uceApplication.deleteMany({
    where: {
      campaignId: {
        in: [IDS.noAsset, IDS.assetOnly, IDS.legacyOnly, IDS.ready],
      },
    },
  });
  await prisma.uceCampaign.deleteMany({
    where: {
      id: { in: [IDS.noAsset, IDS.assetOnly, IDS.legacyOnly, IDS.ready] },
    },
  });
  await prisma.offering.deleteMany({ where: { id: IDS.offering } });
  await prisma.brandProfile.deleteMany({ where: { id: IDS.brand } });
  await prisma.user.deleteMany({ where: { id: IDS.creatorUser } });
}

async function createCampaign(id: string, status = UceCampaignStatus.DRAFT) {
  return prisma.uceCampaign.create({
    data: {
      id,
      brandProfileId: IDS.brand,
      name: `F6C acceptance ${id.slice(-2)}`,
      status,
      targeting: {
        create: {
          industryVertical: "D2C",
          followerTiers: [],
          targetLocations: [],
        },
      },
      commercials: {
        create: {
          compensationType: UceCompensationType.FIXED_FEE,
          commercialOffer: 1000,
          totalCampaignBudget: 10000,
          fixedFeeAmount: 1000,
          totalCampaignBudgetPool: 10000,
          advancePaymentPercentage: 25,
        },
      },
    },
  });
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "5432" ||
    url.pathname !== "/creator_shop_acceptance"
  ) {
    throw new Error(
      "F6C tests require the local creator_shop_acceptance database",
    );
  }
  await prisma.$connect();
  await cleanAcceptanceFixtures();
  await prisma.brandProfile.create({
    data: {
      id: IDS.brand,
      domain: "f6c-acceptance.example.invalid",
      name: "F6C Acceptance Brand",
      industry: IndustryVertical.D2C,
      brandValues: ["TEST_ONLY"],
      policyFlags: ["ACCEPTANCE_FIXTURE"],
      countryCode: "IN",
    },
  });
  await prisma.offering.create({
    data: {
      id: IDS.offering,
      brandProfileId: IDS.brand,
      type: OfferingType.PRODUCT,
      name: "F6C Acceptance Offering",
      url: "https://example.invalid/f6c-offering",
      locationIds: [],
    },
  });
  await prisma.user.create({
    data: {
      id: IDS.creatorUser,
      email: creator.email,
      role: creator.role,
      creatorProfile: {
        create: {
          instagramHandle: "f6c_acceptance_creator",
          followerCount: 50000,
          primaryRegion: "IN",
        },
      },
    },
  });
  await Promise.all([
    createCampaign(IDS.noAsset),
    createCampaign(IDS.assetOnly),
    createCampaign(IDS.legacyOnly),
    createCampaign(IDS.ready, UceCampaignStatus.LIVE),
  ]);
  await prisma.uceCampaignProduct.create({
    data: {
      campaignId: IDS.legacyOnly,
      productName: "Legacy-only acceptance product",
      assetPayload: { acceptance: true },
    },
  });
  await prisma.uceCampaignBrief.create({
    data: {
      campaignId: IDS.legacyOnly,
      internalTitle: "Legacy-only acceptance brief",
      creativeGuidelines: "Compatibility projection only",
      requiredPlatforms: [],
    },
  });
});

describe.sequential("F6C canonical Campaign runtime", () => {
  let legacyProductId: string;
  let canonicalAssetId: string;
  let legacyBriefId: string;
  let canonicalBriefId: string;
  let applicationId: string;

  it("does not treat missing or legacy-only Asset/Brief rows as ready", async () => {
    const noAsset = await campaigns.getActivationChecklist(
      IDS.brand,
      IDS.noAsset,
    );
    const legacyOnly = await campaigns.getActivationChecklist(
      IDS.brand,
      IDS.legacyOnly,
    );
    expect(noAsset.find((item) => item.key === "product_sku")?.satisfied).toBe(
      false,
    );
    expect(
      legacyOnly.find((item) => item.key === "product_sku")?.satisfied,
    ).toBe(false);
    expect(
      legacyOnly.find((item) => item.key === "active_brief")?.satisfied,
    ).toBe(false);
  });

  it("keeps an Asset without a published canonical Brief not ready", async () => {
    await products.create(
      IDS.brand,
      IDS.assetOnly,
      productPayload(IDS.assetOnly),
    );
    const checklist = await campaigns.getActivationChecklist(
      IDS.brand,
      IDS.assetOnly,
    );
    expect(
      checklist.find((item) => item.key === "product_sku")?.satisfied,
    ).toBe(true);
    expect(
      checklist.find((item) => item.key === "active_brief")?.satisfied,
    ).toBe(false);
  });

  it("persists idempotent canonical Asset/Brief projections and becomes ready", async () => {
    const firstProduct = await products.create(
      IDS.brand,
      IDS.ready,
      productPayload(IDS.ready),
    );
    const secondProduct = await products.create(
      IDS.brand,
      IDS.ready,
      productPayload(IDS.ready),
    );
    legacyProductId = firstProduct.product_id;
    canonicalAssetId = firstProduct.canonical_campaign_asset_id;
    expect(secondProduct.product_id).toBe(legacyProductId);
    expect(secondProduct.canonical_campaign_asset_id).toBe(canonicalAssetId);

    const firstBrief = await briefs.create(
      IDS.brand,
      IDS.ready,
      briefPayload(IDS.ready, legacyProductId, canonicalAssetId),
    );
    const secondBrief = await briefs.create(
      IDS.brand,
      IDS.ready,
      briefPayload(IDS.ready, legacyProductId, canonicalAssetId),
    );
    legacyBriefId = firstBrief.brief_id;
    canonicalBriefId = firstBrief.canonical_brief_id;
    expect(secondBrief.brief_id).toBe(legacyBriefId);
    expect(secondBrief.canonical_brief_id).toBe(canonicalBriefId);
    expect(
      await prisma.uceCampaignAsset.count({ where: { campaignId: IDS.ready } }),
    ).toBe(1);
    expect(
      await prisma.uceBrief.count({
        where: { campaignAssetId: canonicalAssetId },
      }),
    ).toBe(1);
    expect(
      await prisma.uceBriefDeliverable.count({
        where: { briefId: canonicalBriefId },
      }),
    ).toBe(1);

    const checklist = await campaigns.getActivationChecklist(
      IDS.brand,
      IDS.ready,
    );
    expect(checklist.every((item) => item.satisfied)).toBe(true);
    await prisma.uceCampaignProduct.update({
      where: { id: legacyProductId },
      data: { inventoryCount: 3 },
    });
  });

  it("exposes canonical IDs in the creator Campaign read model", async () => {
    const rows = await creatorCampaigns.listOpenCampaigns(creator);
    const campaign = rows.find((row) => row.campaign_id === IDS.ready);
    expect(campaign?.canonical_assets).toEqual([
      expect.objectContaining({
        campaign_asset_id: canonicalAssetId,
        briefs: [
          expect.objectContaining({ canonical_brief_id: canonicalBriefId }),
        ],
      }),
    ]);
  });

  it("rejects absent or mismatched canonical selections", async () => {
    await expect(
      creatorCampaigns.applyToCampaign(creator, IDS.ready, {
        brief_id: legacyBriefId,
        product_id: legacyProductId,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      creatorCampaigns.applyToCampaign(creator, IDS.ready, {
        brief_id: legacyBriefId,
        product_id: legacyProductId,
        canonical_campaign_asset_id: IDS.offering,
        canonical_brief_id: canonicalBriefId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("persists canonical Application references", async () => {
    await creatorCampaigns.applyToCampaign(creator, IDS.ready, {
      brief_id: legacyBriefId,
      product_id: legacyProductId,
      canonical_campaign_asset_id: canonicalAssetId,
      canonical_brief_id: canonicalBriefId,
    });
    const application = await prisma.uceApplication.findFirstOrThrow({
      where: { campaignId: IDS.ready, canonicalBriefId },
    });
    applicationId = application.id;
    expect(application.canonicalCampaignAssetId).toBe(canonicalAssetId);
    expect(application.canonicalBriefId).toBe(canonicalBriefId);
    await applicationService.syncFromLegacyCollaborations(IDS.ready);
    const afterLegacySync = await prisma.uceApplication.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(afterLegacySync.canonicalCampaignAssetId).toBe(canonicalAssetId);
    expect(afterLegacySync.canonicalBriefId).toBe(canonicalBriefId);
    const synchronizedApplications = await prisma.uceApplication.findMany({
      where: { campaignId: IDS.ready },
    });
    expect(synchronizedApplications).toHaveLength(1);
    expect(synchronizedApplications[0].canonicalCampaignAssetId).toBe(
      canonicalAssetId,
    );
    expect(synchronizedApplications[0].canonicalBriefId).toBe(canonicalBriefId);
  });

  it("approves using persisted canonical IDs and provisions one snapshot", async () => {
    const result = await applicationService.approve(
      IDS.brand,
      IDS.ready,
      applicationId,
      IDS.creatorUser,
    );
    const collaboration = await prisma.collaboration.findUniqueOrThrow({
      where: { sourceApplicationId: applicationId },
      include: { snapshot: true },
    });
    expect(result.workflowCollaborationId).toBe(collaboration.id);
    expect(collaboration.campaignAssetId).toBe(canonicalAssetId);
    expect(collaboration.canonicalBriefId).toBe(canonicalBriefId);
    expect(collaboration.sourceApplicationId).toBe(applicationId);
    expect(collaboration.snapshot).not.toBeNull();

    await expect(
      applicationService.approve(
        IDS.brand,
        IDS.ready,
        applicationId,
        IDS.creatorUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.collaboration.count({
        where: { sourceApplicationId: applicationId },
      }),
    ).toBe(1);
  });
});

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
import { BrandUcePipelineService } from "../brand-uce/services/brand-uce-pipeline.service";
import { CampaignApplicationService } from "../brand-uce/services/campaign-application.service";
import { CampaignCommandService } from "../brand-uce/services/campaign-command.service";
import { CampaignQueryService } from "../brand-uce/services/campaign-query.service";
import { CanonicalCampaignCreateService } from "../brand-uce/services/canonical-campaign-create.service";
import { CanonicalCampaignDraftReadService } from "../brand-uce/services/canonical-campaign-draft-read.service";
import { CollaborationProvisionService } from "../collaboration/services/collaboration-provision.service";
import { CreatorUceCampaignsService } from "./services/creator-uce-campaigns.service";

const IDS = {
  brand: "f6c00000-0000-4000-8000-000000000001",
  offering: "f6c00000-0000-4000-8000-000000000002",
  creatorUser: "f6c00000-0000-4000-8000-000000000003",
  secondCreatorUser: "f6c00000-0000-4000-8000-000000000004",
  organization: "f6c00000-0000-4000-8000-000000000005",
  brandOwnerUser: "f6c00000-0000-4000-8000-000000000006",
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
const pipeline = new BrandUcePipelineService(prisma, access, provision);
const applicationService = new CampaignApplicationService(
  prisma,
  access,
  pipeline,
  provision,
);
const campaignQuery = new CampaignQueryService(prisma, applicationService);
const campaignCommands = new CampaignCommandService(
  prisma,
  access,
  campaignQuery,
);
const canonicalCreate = new CanonicalCampaignCreateService(prisma, campaigns);
const canonicalDraftRead = new CanonicalCampaignDraftReadService(prisma);

const creator = {
  id: IDS.creatorUser,
  email: "f6c.creator@example.invalid",
  role: UserRole.CREATOR,
};
const secondCreator = {
  id: IDS.secondCreatorUser,
  email: "f6c.second.creator@example.invalid",
  role: UserRole.CREATOR,
};

const canonicalCampaignPayload = {
  strategy: {
    campaign_name: "F6 Full Runtime Acceptance",
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
  await prisma.uceCampaign.deleteMany({
    where: {
      name: {
        startsWith: canonicalCampaignPayload.strategy.campaign_name,
      },
    },
  });
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
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [IDS.creatorUser, IDS.secondCreatorUser, IDS.brandOwnerUser],
      },
    },
  });
  await prisma.organization.deleteMany({ where: { id: IDS.organization } });
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
  await prisma.organization.create({
    data: { id: IDS.organization, name: "F6C Acceptance Organization" },
  });
  await prisma.user.create({
    data: {
      id: IDS.brandOwnerUser,
      email: "f6c.brand.owner@example.invalid",
      role: UserRole.BRAND,
      organizationId: IDS.organization,
    },
  });
  await prisma.brandProfile.create({
    data: {
      id: IDS.brand,
      organizationId: IDS.organization,
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
  await prisma.user.create({
    data: {
      id: IDS.secondCreatorUser,
      email: secondCreator.email,
      role: secondCreator.role,
      creatorProfile: {
        create: {
          instagramHandle: "f6c_second_acceptance_creator",
          followerCount: 60000,
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
  let fullCampaignId: string;
  let legacyProductId: string;
  let canonicalAssetId: string;
  let legacyBriefId: string;
  let canonicalBriefId: string;
  let applicationId: string;

  it("autosaves, hydrates, and atomically publishes a canonical Campaign", async () => {
    const draft = await canonicalCreate.createDraft(IDS.brand);
    fullCampaignId = draft.campaignId;
    expect(draft.status).toBe("DRAFT");
    expect(draft.creationSource).toBe("MANUAL");

    const patches = [
      [
        "strategy.campaign_name",
        canonicalCampaignPayload.strategy.campaign_name,
      ],
      [
        "strategy.publishing_schedule",
        canonicalCampaignPayload.strategy.publishing_schedule,
      ],
      ["strategy.publish_from", canonicalCampaignPayload.strategy.publish_from],
      [
        "strategy.publish_until",
        canonicalCampaignPayload.strategy.publish_until,
      ],
      [
        "strategy.core_objective",
        canonicalCampaignPayload.strategy.core_objective,
      ],
      [
        "strategy.campaign_visibility",
        canonicalCampaignPayload.strategy.campaign_visibility,
      ],
      [
        "targeting.creator_archetypes",
        canonicalCampaignPayload.targeting.creator_archetypes,
      ],
      [
        "targeting.minimum_followers",
        canonicalCampaignPayload.targeting.minimum_followers,
      ],
      [
        "targeting.maximum_followers",
        canonicalCampaignPayload.targeting.maximum_followers,
      ],
      [
        "targeting.audience_age_min",
        canonicalCampaignPayload.targeting.audience_age_min,
      ],
      [
        "targeting.audience_age_max",
        canonicalCampaignPayload.targeting.audience_age_max,
      ],
      [
        "targeting.audience_gender",
        canonicalCampaignPayload.targeting.audience_gender,
      ],
      [
        "targeting.audience_affinity_ids",
        canonicalCampaignPayload.targeting.audience_affinity_ids,
      ],
      [
        "targeting.audience_geographies",
        canonicalCampaignPayload.targeting.audience_geographies,
      ],
      [
        "commercials.receives_brand_support",
        canonicalCampaignPayload.commercials.receives_brand_support,
      ],
      [
        "commercials.brand_support_type",
        canonicalCampaignPayload.commercials.brand_support_type,
      ],
      [
        "commercials.brand_support_estimated_value",
        canonicalCampaignPayload.commercials.brand_support_estimated_value,
      ],
      [
        "commercials.compensation_model",
        canonicalCampaignPayload.commercials.compensation_model,
      ],
      [
        "commercials.commercial_offer",
        canonicalCampaignPayload.commercials.commercial_offer,
      ],
      [
        "commercials.total_campaign_budget",
        canonicalCampaignPayload.commercials.total_campaign_budget,
      ],
      [
        "commercials.advance_payment_percentage",
        canonicalCampaignPayload.commercials.advance_payment_percentage,
      ],
      [
        "commercials.payout_terms",
        canonicalCampaignPayload.commercials.payout_terms,
      ],
    ] as const;

    for (const [path, value] of patches) {
      await canonicalCreate.autosaveField(IDS.brand, fullCampaignId, {
        path,
        value,
      });
    }
    await canonicalCreate.autosaveField(IDS.brand, fullCampaignId, {
      path: "strategy.campaign_name",
      value: canonicalCampaignPayload.strategy.campaign_name,
    });

    const hydrated = await canonicalDraftRead.getDraft(
      IDS.brand,
      fullCampaignId,
    );
    expect(hydrated.draft).toEqual({
      strategy: expect.objectContaining({
        campaign_name: canonicalCampaignPayload.strategy.campaign_name,
        core_objective: "PROOF",
      }),
      targeting: expect.objectContaining({
        minimum_followers: 20_000,
        audience_affinity_ids: ["SKINCARE"],
      }),
      commercials: expect.objectContaining({
        commercial_offer: 10_000,
        total_campaign_budget: 100_000,
      }),
    });
    expect(
      await prisma.uceCampaign.count({ where: { id: fullCampaignId } }),
    ).toBe(1);

    await expect(
      canonicalCreate.publishDraft(IDS.brand, fullCampaignId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.uceCampaign.findUniqueOrThrow({
        where: { id: fullCampaignId },
        select: { status: true },
      }),
    ).toEqual({ status: "DRAFT" });
    expect(
      await prisma.uceCampaignReportingSnapshot.count({
        where: { campaignId: fullCampaignId },
      }),
    ).toBe(0);

    const product = await products.create(
      IDS.brand,
      fullCampaignId,
      productPayload(fullCampaignId),
    );
    const brief = await briefs.create(
      IDS.brand,
      fullCampaignId,
      briefPayload(
        fullCampaignId,
        product.product_id,
        product.canonical_campaign_asset_id,
      ),
    );
    await canonicalCreate.publishDraft(
      IDS.brand,
      fullCampaignId,
      canonicalCampaignPayload,
    );

    const persisted = await prisma.uceCampaign.findUniqueOrThrow({
      where: { id: fullCampaignId },
      include: {
        strategy: true,
        targeting: true,
        commercials: true,
        assets: { include: { briefs: true } },
      },
    });
    expect(persisted.status).toBe("PUBLISHED");
    expect(persisted.creationSource).toBe("MANUAL");
    expect(persisted.publishedAt).not.toBeNull();
    expect(persisted.strategy?.canonicalObjective).toBe("PROOF");
    expect(persisted.targeting?.minimumFollowers).toBe(20_000);
    expect(Number(persisted.commercials?.totalCampaignBudget)).toBe(100_000);
    expect(persisted.assets).toHaveLength(1);
    expect(persisted.assets[0].id).toBe(product.canonical_campaign_asset_id);
    expect(persisted.assets[0].briefs[0].id).toBe(brief.canonical_brief_id);
    expect(persisted.canonicalDefinition).toEqual(
      expect.objectContaining({ version: "1.2", creationSource: "MANUAL" }),
    );
    expect(
      await prisma.uceCampaignReportingSnapshot.count({
        where: { campaignId: fullCampaignId },
      }),
    ).toBe(1);
    await expect(
      canonicalCreate.publishDraft(
        IDS.brand,
        fullCampaignId,
        canonicalCampaignPayload,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.uceCampaignReportingSnapshot.count({
        where: { campaignId: fullCampaignId },
      }),
    ).toBe(1);

    const cards = await campaigns.listCampaigns(IDS.brand, {
      search: canonicalCampaignPayload.strategy.campaign_name,
    });
    expect(cards).toEqual([
      expect.objectContaining({
        campaign_id: fullCampaignId,
        product_count: 1,
        brief_count: 1,
      }),
    ]);
    const page = await campaignQuery.getCampaignPage(IDS.brand, fullCampaignId);
    expect(page.hydration.executionReady).toBe(true);
    expect(page.productsBriefsSummary.products[0].campaignAssetId).toBe(
      product.canonical_campaign_asset_id,
    );
  });

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

  it("uses canonical Asset/Brief authority in Campaign Page and detail reads", async () => {
    const page = await campaignQuery.getCampaignPage(IDS.brand, IDS.ready);
    expect(page.hydration.executionReady).toBe(true);
    expect(page.productsBriefsSummary.products).toEqual([
      expect.objectContaining({
        campaignAssetId: canonicalAssetId,
        briefs: [expect.objectContaining({ briefId: canonicalBriefId })],
      }),
    ]);

    const legacyOnlyPage = await campaignQuery.getCampaignPage(
      IDS.brand,
      IDS.legacyOnly,
    );
    expect(legacyOnlyPage.hydration.executionReady).toBe(false);
    expect(legacyOnlyPage.productsBriefsSummary.products).toEqual([]);

    await expect(
      campaignQuery.getProductDetails(IDS.brand, IDS.ready, canonicalAssetId),
    ).resolves.toEqual(
      expect.objectContaining({ campaignAssetId: canonicalAssetId }),
    );
    await expect(
      campaignQuery.getBriefDetails(IDS.brand, IDS.ready, canonicalBriefId),
    ).resolves.toEqual(
      expect.objectContaining({
        briefId: canonicalBriefId,
        campaignAssetId: canonicalAssetId,
      }),
    );
  });

  it("shares an owned ready Campaign idempotently and records a click", async () => {
    const first = await campaignCommands.executeShare(
      IDS.brand,
      IDS.ready,
      "COPY_LINK",
      "f6c-share-ready",
    );
    const replay = await campaignCommands.executeShare(
      IDS.brand,
      IDS.ready,
      "COPY_LINK",
      "f6c-share-ready",
    );
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.trackingToken).toBe(first.trackingToken);
    await expect(
      campaignCommands.recordShareClick(first.trackingToken),
    ).resolves.toEqual({ ok: true, campaignId: IDS.ready });
    await expect(
      campaignCommands.executeShare(
        IDS.offering,
        IDS.ready,
        "COPY_LINK",
        "f6c-share-wrong-owner",
      ),
    ).rejects.toThrow("Campaign not found");
    await expect(
      campaignCommands.executeShare(
        IDS.brand,
        IDS.noAsset,
        "COPY_LINK",
        "f6c-share-draft",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      campaignCommands.executeShare(
        IDS.brand,
        "f6c00000-0000-4000-8000-000000000099",
        "COPY_LINK",
        "f6c-share-missing",
      ),
    ).rejects.toThrow("Campaign not found");
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

    await expect(
      creatorCampaigns.applyToCampaign(creator, IDS.ready, {
        brief_id: legacyBriefId,
        product_id: legacyProductId,
        canonical_campaign_asset_id: canonicalAssetId,
        canonical_brief_id: canonicalBriefId,
      }),
    ).rejects.toThrow("already have a pipeline row");

    await creatorCampaigns.applyToCampaign(secondCreator, IDS.ready, {
      brief_id: legacyBriefId,
      product_id: legacyProductId,
      canonical_campaign_asset_id: canonicalAssetId,
      canonical_brief_id: canonicalBriefId,
    });
    const secondApplication = await prisma.uceApplication.findFirstOrThrow({
      where: {
        campaignId: IDS.ready,
        campaignCreator: { creatorProfile: { userId: IDS.secondCreatorUser } },
      },
    });
    await applicationService.reject(
      IDS.brand,
      IDS.ready,
      secondApplication.id,
      IDS.brand,
      "F6 acceptance rejection",
    );
    const rejected = await prisma.uceApplication.findUniqueOrThrow({
      where: { id: secondApplication.id },
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectedAt).not.toBeNull();
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

    const rejectedApplication = await prisma.uceApplication.findFirstOrThrow({
      where: { campaignId: IDS.ready, status: "REJECTED" },
    });
    const invalidApproval = await prisma.uceApplication.create({
      data: {
        requestId: "f6c-invalid-approval",
        campaignId: IDS.ready,
        campaignCreatorId: rejectedApplication.campaignCreatorId,
        campaignAssetId: legacyProductId,
        briefId: legacyBriefId,
        status: "PENDING",
        source: "DIRECT",
      },
    });
    await expect(
      applicationService.approve(
        IDS.brand,
        IDS.ready,
        invalidApproval.id,
        IDS.brand,
      ),
    ).rejects.toThrow("Canonical Campaign Asset and Brief are required");
    const rolledBack = await prisma.uceApplication.findUniqueOrThrow({
      where: { id: invalidApproval.id },
      include: { collaboration: true },
    });
    expect(rolledBack.status).toBe("PENDING");
    expect(rolledBack.approvedAt).toBeNull();
    expect(rolledBack.collaboration).toBeNull();
    await prisma.uceApplication.delete({ where: { id: invalidApproval.id } });

    const applicants = await campaignQuery.getApplicants(IDS.brand, IDS.ready);
    expect(applicants.applicants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ applicationStatus: "APPROVED" }),
        expect.objectContaining({ applicationStatus: "REJECTED" }),
      ]),
    );
  });

  it("enforces supported lifecycle transitions and canonical timestamps", async () => {
    await expect(
      campaigns.goLiveCampaign(IDS.brand, fullCampaignId),
    ).resolves.toEqual(expect.objectContaining({ current_status: "LIVE" }));
    expect(
      (
        await prisma.uceCampaign.findUniqueOrThrow({
          where: { id: fullCampaignId },
        })
      ).liveAt,
    ).not.toBeNull();
    await expect(
      campaigns.publishCampaign(IDS.brand, IDS.ready),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      campaigns.pauseCampaign(IDS.brand, IDS.ready),
    ).resolves.toEqual(expect.objectContaining({ current_status: "PAUSED" }));
    await expect(
      campaigns.pauseCampaign(IDS.brand, IDS.ready),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      campaigns.resumeCampaign(IDS.brand, IDS.ready),
    ).resolves.toEqual(expect.objectContaining({ current_status: "LIVE" }));
    await expect(
      campaigns.completeCampaign(IDS.brand, IDS.ready),
    ).resolves.toEqual(
      expect.objectContaining({ current_status: "COMPLETED" }),
    );
    await expect(
      campaigns.resumeCampaign(IDS.brand, IDS.ready),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      campaigns.archiveCampaign(IDS.brand, IDS.ready),
    ).resolves.toEqual(expect.objectContaining({ current_status: "ARCHIVED" }));
    const persisted = await prisma.uceCampaign.findUniqueOrThrow({
      where: { id: IDS.ready },
    });
    expect(persisted.completedAt).not.toBeNull();
    expect(persisted.archivedAt).not.toBeNull();
  });
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  UceBriefCreationSource,
  UceBriefStatus,
  UceBriefType,
  UceCampaignAssetStatus,
  UceCampaignStatus,
  UceDeliverableFormat,
  UceMediaPlatform,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CanonicalCampaignBriefService } from "./canonical-campaign-brief.service";

const ids = {
  asset: "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451",
  brief: "dce46eb4-4f70-4400-9b5d-9855f6f3f8ca",
  reel: "883c2613-98c8-4ce4-b98a-ec85d5ba11ca",
};

const input = {
  campaign_asset_id: ids.asset,
  creation_source: UceBriefCreationSource.MANUAL,
  brief_name: "Creator launch brief",
  creative_intent: "Demonstrate the product in a credible daily routine.",
  creator_brief: "Show the product clearly in natural daylight.",
  brief_type: UceBriefType.CREATOR_LED,
  platform: UceMediaPlatform.INSTAGRAM,
  usage_rights: { organicDays: 30 },
  deliverables: [
    {
      deliverable_id: ids.reel,
      format: UceDeliverableFormat.REEL_VIDEO,
      display_order: 0,
      creative_guidance: { openingHook: true },
    },
  ],
};

function row(status: UceBriefStatus = UceBriefStatus.DRAFT) {
  return {
    id: ids.brief,
    campaignAssetId: ids.asset,
    status,
    creationSource: UceBriefCreationSource.MANUAL,
    briefName: input.brief_name,
    creativeIntent: input.creative_intent,
    creatorBrief: input.creator_brief,
    briefType: input.brief_type,
    platform: input.platform,
    briefLevelGuidance: null,
    referenceContent: null,
    usageRights: input.usage_rights,
    creatorRequirements: null,
    publishedAt:
      status === UceBriefStatus.DRAFT ? null : new Date("2026-09-04T00:00:00Z"),
    pausedAt: null,
    legacyCreativeRequirements: null,
    legacyIsActive: status === UceBriefStatus.PUBLISHED,
    createdAt: new Date("2026-09-04T00:00:00Z"),
    updatedAt: new Date("2026-09-04T00:00:00Z"),
    campaignAsset: { status: UceCampaignAssetStatus.ACTIVE },
    deliverables: [
      {
        id: ids.reel,
        briefId: ids.brief,
        format: UceDeliverableFormat.REEL_VIDEO,
        displayOrder: 0,
        configuration: null,
        creativeGuidance: { openingHook: true },
        amplifyTargetDeliverableId: null,
        legacyFormat: null,
        legacyQuantity: null,
        legacyCreativeRequirements: null,
        legacyPublishingRequired: null,
        createdAt: new Date("2026-09-04T00:00:00Z"),
        updatedAt: new Date("2026-09-04T00:00:00Z"),
      },
    ],
  };
}

function fixture(status: UceCampaignStatus = UceCampaignStatus.DRAFT) {
  const canonicalCampaignBrief = {
    create: vi.fn().mockResolvedValue({ id: ids.brief }),
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(row()),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row()),
    update: vi.fn().mockResolvedValue(row(UceBriefStatus.PUBLISHED)),
  };
  const canonicalBriefDeliverable = {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const prisma = {
    uceCampaignAsset: {
      findFirst: vi.fn().mockResolvedValue({ id: ids.asset }),
    },
    uceCampaignStrategy: {
      findUnique: vi.fn().mockResolvedValue({ platforms: ["INSTAGRAM"] }),
    },
    canonicalCampaignBrief,
    canonicalBriefDeliverable,
    $transaction: vi.fn(
      async (
        callback: (tx: {
          canonicalCampaignBrief: typeof canonicalCampaignBrief;
          canonicalBriefDeliverable: typeof canonicalBriefDeliverable;
        }) => unknown,
      ) => callback({ canonicalCampaignBrief, canonicalBriefDeliverable }),
    ),
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({ status }),
  };
  return {
    service: new CanonicalCampaignBriefService(
      prisma as never,
      access as never,
    ),
    prisma,
    access,
  };
}

describe("CanonicalCampaignBriefService", () => {
  it("creates an incomplete-capable canonical Draft under the active Asset", async () => {
    const { service, prisma } = fixture();

    const result = await service.create("brand-1", "campaign-1", input);

    expect(prisma.uceCampaignAsset.findFirst).toHaveBeenCalledWith({
      where: {
        id: input.campaign_asset_id,
        campaignId: "campaign-1",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    expect(prisma.canonicalCampaignBrief.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignAssetId: input.campaign_asset_id,
          status: "DRAFT",
          legacyCreativeRequirements: null,
        }),
      }),
    );
    expect(result.readiness.ready).toBe(false);
    expect(result.readiness.missing_requirements).toContain("status");
  });

  it("publishes only after rich content, active Asset, and Campaign platform validation", async () => {
    const { service, prisma } = fixture();

    const result = await service.publish("brand-1", "campaign-1", ids.brief);

    expect(prisma.uceCampaignStrategy.findUnique).toHaveBeenCalledWith({
      where: { campaignId: "campaign-1" },
      select: { platforms: true },
    });
    expect(prisma.canonicalCampaignBrief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(result.readiness).toEqual({
      ready: true,
      missing_requirements: [],
    });
  });

  it("keeps a backfilled minimal Brief unavailable for publication", async () => {
    const { service, prisma } = fixture();
    prisma.canonicalCampaignBrief.findFirst.mockResolvedValue({
      ...row(),
      briefName: "Legacy Brief",
      creativeIntent: null,
      creatorBrief: null,
      briefType: null,
      platform: null,
      deliverables: [],
    });

    await expect(
      service.publish("brand-1", "campaign-1", ids.brief),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.canonicalCampaignBrief.update).not.toHaveBeenCalled();
  });

  it("rejects an Asset outside the Campaign ancestry path", async () => {
    const { service, prisma } = fixture();
    prisma.uceCampaignAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.create("brand-1", "campaign-1", input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.canonicalCampaignBrief.create).not.toHaveBeenCalled();
  });

  it.each([UceCampaignStatus.COMPLETED, UceCampaignStatus.ARCHIVED])(
    "keeps %s Campaign Briefs read-only",
    async (status) => {
      const { service, prisma } = fixture(status);

      await expect(
        service.create("brand-1", "campaign-1", input),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.canonicalCampaignBrief.create).not.toHaveBeenCalled();
    },
  );

  it("lists Briefs only through Campaign-owned Assets", async () => {
    const { service, prisma } = fixture();

    await service.list("brand-1", "campaign-1");

    expect(prisma.canonicalCampaignBrief.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignAsset: { campaignId: "campaign-1" } },
      }),
    );
  });
});

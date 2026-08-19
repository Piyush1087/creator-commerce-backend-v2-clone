import { ConflictException, NotFoundException } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CanonicalCampaignBriefService } from "./canonical-campaign-brief.service";

const input = {
  campaign_asset_id: "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451",
  title: "Creator launch brief",
  creative_requirements: "Show the product clearly in natural daylight.",
  deliverables: [
    {
      format: "Instagram Reel",
      quantity: 1,
      creative_requirements: "Include a clear opening hook.",
      publishing_required: true,
    },
  ],
};

function fixture(status: UceCampaignStatus = UceCampaignStatus.DRAFT) {
  const created = {
    id: "brief-1",
    campaignAssetId: input.campaign_asset_id,
    title: input.title,
    creativeRequirements: input.creative_requirements,
    isActive: true,
    createdAt: new Date("2026-08-15T00:00:00Z"),
    deliverables: [
      {
        id: "deliverable-1",
        format: "Instagram Reel",
        quantity: 1,
        creativeRequirements: "Include a clear opening hook.",
        publishingRequired: true,
      },
    ],
  };
  const prisma = {
    uceCampaignAsset: { findFirst: vi.fn().mockResolvedValue({ id: "asset" }) },
    canonicalCampaignBrief: {
      create: vi.fn().mockResolvedValue(created),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
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
  it("creates a Brief only under the supplied active Campaign Asset", async () => {
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
        }),
      }),
    );
    expect(result.readiness).toEqual({
      ready: true,
      missing_requirements: [],
    });
  });

  it("rejects an Asset outside the Campaign ownership path", async () => {
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

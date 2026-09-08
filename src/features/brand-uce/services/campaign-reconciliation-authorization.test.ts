import { ConflictException, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BrandUceController } from "../brand-uce.controller";
import { CampaignAssetSelectionKind } from "../dto/brand-uce-campaign-asset.dto";
import { BrandUceCampaignAssetService } from "./brand-uce-campaign-asset.service";
import { CanonicalCampaignBriefService } from "./canonical-campaign-brief.service";

describe("Campaign reconciliation authorization boundaries", () => {
  it("keeps every new controller route behind authenticated Brand identity", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      BrandUceController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it("forwards the authenticated Brand identity through every new endpoint", async () => {
    const auth = {
      resolveBrandProfileId: vi.fn().mockResolvedValue("brand-1"),
    };
    const assets = {
      listSelectable: vi.fn(),
      listForCampaign: vi.fn(),
      select: vi.fn(),
    };
    const canonicalBriefs = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      publish: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    const controller = new BrandUceController(
      auth as never,
      {} as never,
      assets as never,
      {} as never,
      {} as never,
      canonicalBriefs as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const request = { user: { id: "user-1" } } as never;
    const assetInput = {
      kind: CampaignAssetSelectionKind.OFFERING,
      entity_id: "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451",
    };
    const briefInput = {
      campaign_asset_id: "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451",
      title: "Owned Campaign Brief",
      creative_requirements: "Use truthful product demonstrations.",
      deliverables: [
        {
          format: "Reel",
          quantity: 1,
          creative_requirements: "Show the product clearly.",
          publishing_required: true,
        },
      ],
    };

    await controller.listSelectableCampaignAssets(request);
    await controller.listCampaignAssets(request, "campaign-1");
    await controller.selectCampaignAsset(request, "campaign-1", assetInput);
    await controller.listCanonicalBriefs(request, "campaign-1");
    await controller.createCanonicalBrief(request, "campaign-1", briefInput);
    await controller.updateCanonicalBrief(request, "campaign-1", "brief-1", {
      title: "Updated owned Brief",
    });
    await controller.publishCanonicalBrief(request, "campaign-1", "brief-1");
    await controller.pauseCanonicalBrief(request, "campaign-1", "brief-1");
    await controller.resumeCanonicalBrief(request, "campaign-1", "brief-1");

    expect(auth.resolveBrandProfileId).toHaveBeenCalledTimes(9);
    expect(assets.listSelectable).toHaveBeenCalledWith("brand-1");
    expect(assets.listForCampaign).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
    );
    expect(assets.select).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      assetInput,
    );
    expect(canonicalBriefs.list).toHaveBeenCalledWith("brand-1", "campaign-1");
    expect(canonicalBriefs.create).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      briefInput,
    );
    expect(canonicalBriefs.update).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      "brief-1",
      { title: "Updated owned Brief" },
    );
    expect(canonicalBriefs.publish).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      "brief-1",
    );
    expect(canonicalBriefs.pause).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      "brief-1",
    );
    expect(canonicalBriefs.resume).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
      "brief-1",
    );
  });

  it("scopes selectable Brand Centre entities to the authenticated Brand", async () => {
    const prisma = {
      brandProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      offering: { findMany: vi.fn().mockResolvedValue([]) },
      brandOffer: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new BrandUceCampaignAssetService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.listSelectable("brand-1");

    expect(prisma.brandProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "brand-1" } }),
    );
    expect(prisma.offering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          brandProfileId: "brand-1",
          canonicalLifecycle: "ACTIVE",
          canonicalKind: { not: null },
        },
      }),
    );
    expect(prisma.brandOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brandProfileId: "brand-1", isActive: true },
      }),
    );
  });

  it("does not query or link Assets when the Campaign is foreign", async () => {
    const prisma = {
      offering: { findFirst: vi.fn() },
      uceCampaignAsset: { findMany: vi.fn(), create: vi.fn() },
    };
    const access = {
      assertCampaignOwned: vi
        .fn()
        .mockRejectedValue(new NotFoundException("Campaign not found")),
    };
    const service = new BrandUceCampaignAssetService(
      prisma as never,
      access as never,
      {} as never,
    );

    await expect(
      service.listForCampaign("brand-other", "campaign-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.select("brand-other", "campaign-1", {
        kind: CampaignAssetSelectionKind.OFFERING,
        entity_id: "offering-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.uceCampaignAsset.findMany).not.toHaveBeenCalled();
    expect(prisma.offering.findFirst).not.toHaveBeenCalled();
    expect(prisma.uceCampaignAsset.create).not.toHaveBeenCalled();
  });

  it("filters Campaign Asset reads by both Campaign and Brand ownership", async () => {
    const prisma = {
      uceCampaignAsset: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const access = {
      assertCampaignOwned: vi.fn().mockResolvedValue({
        id: "campaign-1",
        status: UceCampaignStatus.DRAFT,
      }),
    };
    const service = new BrandUceCampaignAssetService(
      prisma as never,
      access as never,
      {} as never,
    );

    await service.listForCampaign("brand-1", "campaign-1");

    expect(prisma.uceCampaignAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: "campaign-1",
          OR: [
            { brandProfileId: "brand-1" },
            { offering: { brandProfileId: "brand-1" } },
            { brandOffer: { brandProfileId: "brand-1" } },
          ],
        },
      }),
    );
  });

  it.each([UceCampaignStatus.COMPLETED, UceCampaignStatus.ARCHIVED])(
    "rejects Asset linking for terminal %s Campaigns",
    async (status) => {
      const prisma = {
        offering: { findFirst: vi.fn() },
        uceCampaignAsset: { create: vi.fn() },
      };
      const access = {
        assertCampaignOwned: vi.fn().mockResolvedValue({ status }),
      };
      const service = new BrandUceCampaignAssetService(
        prisma as never,
        access as never,
        {} as never,
      );

      await expect(
        service.select("brand-1", "campaign-1", {
          kind: CampaignAssetSelectionKind.OFFERING,
          entity_id: "offering-1",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.offering.findFirst).not.toHaveBeenCalled();
      expect(prisma.uceCampaignAsset.create).not.toHaveBeenCalled();
    },
  );

  it("does not inspect Briefs when the requested Campaign is foreign", async () => {
    const prisma = {
      canonicalCampaignBrief: { findMany: vi.fn(), findFirst: vi.fn() },
    };
    const access = {
      assertCampaignOwned: vi
        .fn()
        .mockRejectedValue(new NotFoundException("Campaign not found")),
    };
    const service = new CanonicalCampaignBriefService(
      prisma as never,
      access as never,
      {} as never,
    );

    await expect(
      service.list("brand-other", "campaign-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update("brand-other", "campaign-1", "brief-1", {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.canonicalCampaignBrief.findMany).not.toHaveBeenCalled();
    expect(prisma.canonicalCampaignBrief.findFirst).not.toHaveBeenCalled();
  });

  it("requires a canonical Brief Asset to be active and owned by the requested Campaign", async () => {
    const prisma = {
      uceCampaignAsset: { findFirst: vi.fn().mockResolvedValue(null) },
      canonicalCampaignBrief: { create: vi.fn() },
    };
    const access = {
      assertCampaignOwned: vi.fn().mockResolvedValue({
        status: UceCampaignStatus.DRAFT,
      }),
    };
    const service = new CanonicalCampaignBriefService(
      prisma as never,
      access as never,
      {} as never,
    );

    await expect(
      service.create("brand-1", "campaign-1", {
        campaign_asset_id: "asset-other",
        title: "Owned Campaign Brief",
        creative_requirements: "Use truthful product demonstrations.",
        deliverables: [
          {
            format: "Reel",
            quantity: 1,
            creative_requirements: "Show the product clearly.",
            publishing_required: true,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.uceCampaignAsset.findFirst).toHaveBeenCalledWith({
      where: {
        id: "asset-other",
        campaignId: "campaign-1",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    expect(prisma.canonicalCampaignBrief.create).not.toHaveBeenCalled();
  });

  it("PATCH cannot move a Brief to another Campaign Asset", async () => {
    const updated = {
      id: "brief-1",
      campaignAssetId: "asset-1",
      status: "DRAFT",
      creationSource: "MANUAL",
      briefName: "Updated owned Brief",
      creativeIntent: null,
      creatorBrief: null,
      briefType: null,
      platform: null,
      briefLevelGuidance: null,
      referenceContent: null,
      usageRights: null,
      creatorRequirements: null,
      publishedAt: null,
      pausedAt: null,
      legacyCreativeRequirements: "Use truthful product demonstrations.",
      legacyIsActive: false,
      createdAt: new Date("2026-08-15T00:00:00.000Z"),
      updatedAt: new Date("2026-08-15T00:00:00.000Z"),
      campaignAsset: { status: "ACTIVE" },
      deliverables: [],
    };
    const tx = {
      uceCampaign: {
        findFirst: vi.fn().mockResolvedValue({
          status: UceCampaignStatus.DRAFT,
        }),
      },
      canonicalBriefDeliverable: { deleteMany: vi.fn() },
      canonicalCampaignBrief: {
        findFirst: vi.fn().mockResolvedValue(updated),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const prisma = {
      canonicalCampaignBrief: {
        findFirst: vi.fn().mockResolvedValue(updated),
      },
      $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
    };
    const access = {
      assertCampaignOwned: vi.fn().mockResolvedValue({
        status: UceCampaignStatus.DRAFT,
      }),
    };
    const service = new CanonicalCampaignBriefService(
      prisma as never,
      access as never,
      { lockCampaign: vi.fn().mockResolvedValue(undefined) } as never,
    );

    await service.update("brand-1", "campaign-1", "brief-1", {
      title: "Updated owned Brief",
      campaign_asset_id: "asset-other",
    } as never);

    expect(prisma.canonicalCampaignBrief.findFirst).toHaveBeenCalledWith({
      where: { id: "brief-1", campaignAsset: { campaignId: "campaign-1" } },
      include: expect.any(Object),
    });
    expect(tx.canonicalCampaignBrief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "brief-1" },
        data: expect.not.objectContaining({
          campaignAssetId: expect.anything(),
        }),
      }),
    );
  });
});

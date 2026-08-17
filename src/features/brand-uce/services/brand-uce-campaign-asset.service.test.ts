import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { CampaignAssetSelectionKind } from "../dto/brand-uce-campaign-asset.dto";
import { BrandUceCampaignAssetService } from "./brand-uce-campaign-asset.service";

function harness() {
  const prisma = {
    brandProfile: { findUnique: vi.fn() },
    offering: { findMany: vi.fn(), findFirst: vi.fn() },
    brandOffer: { findMany: vi.fn(), findFirst: vi.fn() },
    uceCampaignProduct: { create: vi.fn() },
    uceCampaignAsset: {
      create: vi.fn().mockImplementation(({ data }) => ({
        id: "asset-1",
        kind: data.kind,
        status: "ACTIVE",
        brandProfileId: data.brandProfileId ?? null,
        offeringId: data.offeringId ?? null,
        brandOfferId: data.brandOfferId ?? null,
        brandProfile: data.brandProfileId
          ? { name: "Brand", logoUrl: null }
          : null,
        offering: data.offeringId
          ? { name: "Offering", type: "PRODUCT", imageUrl: null }
          : null,
        brandOffer: data.brandOfferId ? { offerName: "Offer" } : null,
      })),
      findMany: vi.fn(),
    },
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }),
  };
  return {
    prisma,
    access,
    service: new BrandUceCampaignAssetService(prisma as never, access as never),
  };
}

describe("BrandUceCampaignAssetService", () => {
  it.each([
    [CampaignAssetSelectionKind.BRAND, "brand-1", "brandProfileId"],
    [CampaignAssetSelectionKind.OFFERING, "offering-1", "offeringId"],
    [CampaignAssetSelectionKind.OFFER, "offer-1", "brandOfferId"],
  ])(
    "creates an explicit %s reference without creating a legacy Product",
    async (kind, entityId, field) => {
      const { prisma, service } = harness();
      prisma.offering.findFirst.mockResolvedValue({ id: entityId });
      prisma.brandOffer.findFirst.mockResolvedValue({ id: entityId });

      await service.select("brand-1", "campaign-1", {
        kind,
        entity_id: entityId,
      });

      expect(prisma.uceCampaignAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ [field]: entityId }),
        }),
      );
      expect(prisma.uceCampaignProduct.create).not.toHaveBeenCalled();
    },
  );

  it("rejects a cross-Brand Offering selection", async () => {
    const { service } = harness();

    await expect(
      service.select("brand-1", "campaign-1", {
        kind: CampaignAssetSelectionKind.OFFERING,
        entity_id: "other-brand-offering",
      }),
    ).rejects.toThrow("not found or unavailable");
  });

  it("maps duplicate canonical references to a stable conflict", async () => {
    const { prisma, service } = harness();
    prisma.offering.findFirst.mockResolvedValue({ id: "offering-1" });
    prisma.uceCampaignAsset.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.select("brand-1", "campaign-1", {
        kind: CampaignAssetSelectionKind.OFFERING,
        entity_id: "offering-1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CampaignAssetSelectionKind } from "../dto/brand-uce-campaign-asset.dto";
import { BrandUceCampaignAssetService } from "./brand-uce-campaign-asset.service";
import {
  campaignAssetReconciliationState,
  campaignLifecycleProjection,
} from "./brand-uce-campaign.service";

function harness() {
  const prisma = {
    offering: { findFirst: vi.fn() },
    brandOffer: { findFirst: vi.fn() },
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
    },
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }),
  };
  return {
    prisma,
    service: new BrandUceCampaignAssetService(prisma as never, access as never),
  };
}

describe("G1A Campaign Asset authority", () => {
  it("keeps lifecycle state separate when live Campaign readiness is lost", () => {
    expect(
      campaignLifecycleProjection(UceCampaignStatus.ACTIVE, false, true, false),
    ).toEqual(
      expect.objectContaining({
        can_pause: true,
        can_activate: false,
        can_resume: false,
      }),
    );
    expect(
      campaignLifecycleProjection(UceCampaignStatus.DRAFT, false, true, false)
        .can_activate,
    ).toBe(false);
  });
  it.each([
    [CampaignAssetSelectionKind.BRAND, "brand-1", "brandProfileId"],
    [CampaignAssetSelectionKind.OFFERING, "offering-1", "offeringId"],
    [CampaignAssetSelectionKind.OFFER, "offer-1", "brandOfferId"],
  ])("creates explicit %s selection", async (kind, entityId, field) => {
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
  });

  it("rejects cross-Brand selection", async () => {
    const { service } = harness();
    await expect(
      service.select("brand-1", "campaign-1", {
        kind: CampaignAssetSelectionKind.OFFERING,
        entity_id: "other-brand-offering",
      }),
    ).rejects.toThrow("not found or unavailable");
  });

  it("blocks active execution until a canonical Asset exists and keeps terminal history read-only", () => {
    expect(
      campaignAssetReconciliationState(UceCampaignStatus.ACTIVE, 0, 1),
    ).toEqual({
      isTerminal: false,
      requiresAssetReconciliation: true,
      canExecuteCampaign: false,
    });
    expect(
      campaignAssetReconciliationState(UceCampaignStatus.ACTIVE, 1, 1)
        .canExecuteCampaign,
    ).toBe(true);
    expect(
      campaignAssetReconciliationState(UceCampaignStatus.ARCHIVED, 0, 1)
        .canExecuteCampaign,
    ).toBe(false);
  });
});

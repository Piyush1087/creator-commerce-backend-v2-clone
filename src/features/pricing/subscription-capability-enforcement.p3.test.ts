import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BrandEscrowComputationService } from "../brand-escrow/services/brand-escrow-computation.service";
import { BrandEscrowHardenedService } from "../brand-escrow/services/brand-escrow-hardened.service";
import { BrandEscrowService } from "../brand-escrow/services/brand-escrow.service";
import { BrandUceCampaignService } from "../brand-uce/services/brand-uce-campaign.service";

function restrictedCapability() {
  return {
    assertCapability: vi
      .fn()
      .mockRejectedValue(new ForbiddenException("SUBSCRIPTION_RESTRICTED")),
  };
}

describe("P3 domain commit-boundary enforcement", () => {
  it.each(["publishCampaign", "goLiveCampaign", "resumeCampaign"] as const)(
    "denies campaign activation through %s before persistence",
    async (method) => {
      const prisma = { uceCampaign: { findFirst: vi.fn() } };
      const capabilities = restrictedCapability();
      const service = new BrandUceCampaignService(
        prisma as never,
        { assertCampaignOwned: vi.fn() } as never,
        capabilities as never,
      );
      await expect(
        service[method]("brand-1", "campaign-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.uceCampaign.findFirst).not.toHaveBeenCalled();
      expect(capabilities.assertCapability).toHaveBeenCalledWith(
        "brand-1",
        "CAMPAIGN_PUBLISH",
      );
    },
  );

  it("denies top-up before ledger or provider side effects", async () => {
    const prisma = {
      brandEscrowVault: { findUnique: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
    };
    const razorpay = { createOrder: vi.fn() };
    const service = new BrandEscrowService(
      prisma as never,
      razorpay as never,
      {} as never,
      {} as never,
      restrictedCapability() as never,
    );
    await expect(
      service.createCardTopUpIntent("brand-1", 100, "key-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.brandEscrowVault.findUnique).not.toHaveBeenCalled();
    expect(prisma.escrowTransactionLedger.create).not.toHaveBeenCalled();
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it("denies normal reserve before opening a transaction", async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new BrandEscrowComputationService(
      prisma as never,
      {} as never,
      {} as never,
      restrictedCapability() as never,
    );
    await expect(
      service.executeStage2Lock({
        brandProfileId: "brand-1",
        collaborationId: "collab-1",
        grossCreatorQuote: 100,
        expectedTdsPercentage: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("denies hardened reserve before idempotency or balance mutation", async () => {
    const prisma = { $transaction: vi.fn() };
    const idempotency = { registerIntent: vi.fn() };
    const service = new BrandEscrowHardenedService(
      prisma as never,
      idempotency as never,
      {} as never,
      {} as never,
      restrictedCapability() as never,
    );
    await expect(
      service.secureCollaborationFundsHardened(
        {
          brandProfileId: "brand-1",
          collaborationId: "collab-1",
          grossCreatorQuote: 100,
          expectedTdsPercentage: 0,
        },
        "key-1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(idempotency.registerIntent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

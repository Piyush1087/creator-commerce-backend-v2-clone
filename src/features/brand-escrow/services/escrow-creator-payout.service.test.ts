import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { EscrowCreatorPayoutService } from "./escrow-creator-payout.service";

describe("BS09 P3 creator payout lifecycle", () => {
  it("denies inactive membership inside the canonical payout service", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      brandTeamMember: {
        findUnique: vi.fn().mockResolvedValue({
          isActive: false,
          role: "CAMPAIGN_MANAGER",
        }),
      },
      collaboration: { findUnique: vi.fn() },
    };
    const service = new EscrowCreatorPayoutService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      {} as never,
    );

    await expect(
      service.approveAndStart({
        collaborationId: "collab-1",
        brandProfileId: "brand-1",
        approvedByUserId: "user-1",
        tranche: "ADVANCE_30",
      }),
    ).rejects.toThrow("Active Brand payout authority required");
    expect(tx.collaboration.findUnique).not.toHaveBeenCalled();
  });

  it("persists approval and attempt before provider processing without moving funds", async () => {
    const logical = {
      id: "payout-1",
      collaborationId: "collab-1",
      escrowLockId: "lock-1",
      brandProfileId: "brand-1",
      creatorProfileId: "creator-1",
      tranche: "ADVANCE_30",
      contractedAmount: new Decimal(20000),
      currency: "INR",
      status: "APPROVED",
      processingAt: null,
      currentProviderPayoutId: null,
    };
    const attempt = {
      id: "attempt-1",
      payoutId: "payout-1",
      providerIdempotencyKey: "creator-payout:payout-1:attempt-1",
      status: "CREATED",
    };
    const tx = {
      $queryRaw: vi.fn(),
      brandTeamMember: {
        findUnique: vi.fn().mockResolvedValue({
          isActive: true,
          role: "CAMPAIGN_MANAGER",
        }),
      },
      collaboration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "collab-1",
          brandProfileId: "brand-1",
          creatorUserId: "user-creator",
          currentStage: "STAGE_3_LOGISTICS",
          commercials: {
            finalQuote: new Decimal(100000),
            advance30Amount: new Decimal(20000),
            balance70Amount: new Decimal(80000),
          },
          escrowLock: {
            id: "lock-1",
            grossCreatorQuote: new Decimal(100000),
            netCreatorPayoutPool: new Decimal(100000),
            lockReleasedViaRefund: false,
            finalTrancheDisbursed: false,
            advanceTrancheDisbursed: false,
          },
          finalization: null,
        }),
      },
      creatorProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: "creator-1" }),
      },
      brandEscrowVault: {
        findUnique: vi.fn().mockResolvedValue({ currency: "INR" }),
        update: vi.fn(),
      },
      escrowCreatorPayout: {
        upsert: vi.fn().mockResolvedValue(logical),
        findUnique: vi.fn().mockResolvedValue(logical),
        update: vi.fn(),
      },
      creatorSettlementProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "settlement-1",
          accountHolderName: "Creator",
          bankAccountNumber: "1234",
          ifscCode: "IFSC0001",
          razorpayContactId: "contact-1",
          razorpayFundAccountId: "fund-1",
        }),
      },
      escrowCreatorPayoutAttempt: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(attempt),
        create: vi.fn().mockResolvedValue(attempt),
        update: vi.fn(),
      },
      collaborationEscrowLock: {
        findUnique: vi.fn().mockResolvedValue({
          lockReleasedViaRefund: false,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (value: any) =>
        typeof value === "function" ? value(tx) : Promise.all(value),
      ),
      escrowCreatorPayout: {
        update: vi.fn().mockResolvedValue({ ...logical, status: "PROCESSING" }),
      },
      escrowCreatorPayoutAttempt: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          ...attempt,
          payout: { ...logical, status: "PROCESSING" },
        }),
      },
      creatorSettlementProfile: { update: vi.fn() },
    };
    const provider = {
      assertConfigured: vi.fn(),
      createPayout: vi.fn().mockResolvedValue({
        id: "provider-1",
        status: "processing",
      }),
    };
    const service = new EscrowCreatorPayoutService(
      prisma as never,
      provider as never,
    );

    const result = await service.approveAndStart({
      collaborationId: "collab-1",
      brandProfileId: "brand-1",
      approvedByUserId: "brand-user",
      tranche: "ADVANCE_30",
    });

    expect(tx.escrowCreatorPayout.upsert.mock.calls[0][0].create).toMatchObject(
      {
        contractedAmount: new Decimal(20000),
        currency: "INR",
        status: "APPROVED",
      },
    );
    expect(
      tx.escrowCreatorPayoutAttempt.create.mock.invocationCallOrder[0],
    ).toBeLessThan(provider.createPayout.mock.invocationCallOrder[0]);
    expect(provider.createPayout.mock.calls[0][0]).toMatchObject({
      amountPaise: 2000000,
      fundAccountId: "fund-1",
      idempotencyKey: attempt.providerIdempotencyKey,
    });
    expect(tx.brandEscrowVault.update).not.toHaveBeenCalled();
    expect(result).toEqual({ state: "PROCESSING", payout_id: "payout-1" });
  });

  it("provider-confirmed advance consumes the exact contracted amount once", async () => {
    const payout = {
      id: "payout-1",
      collaborationId: "collab-1",
      escrowLockId: "lock-1",
      brandProfileId: "brand-1",
      tranche: "ADVANCE_30",
      contractedAmount: new Decimal(20000),
      currency: "INR",
      status: "PROCESSING",
      currentProviderPayoutId: "provider-1",
    };
    const tx = {
      $queryRaw: vi.fn(),
      escrowCreatorPayoutAttempt: {
        findUnique: vi.fn().mockResolvedValue({
          id: "attempt-1",
          payoutId: "payout-1",
          status: "PROCESSING",
          payout,
        }),
        update: vi.fn(),
      },
      collaborationEscrowLock: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "lock-1",
          platformCommissionFee: new Decimal(7000),
          platformCommissionGst: new Decimal(1260),
        }),
        update: vi.fn(),
      },
      brandEscrowVault: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "vault-1",
          lockedCampaignFunds: new Decimal(108260),
          totalPooledBalance: new Decimal(108260),
        }),
        update: vi.fn(),
      },
      collaborationCommercial: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          advance30Amount: new Decimal(20000),
        }),
        update: vi.fn(),
      },
      collaborationFinalization: { update: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
      escrowCreatorPayout: {
        update: vi.fn().mockResolvedValue({ ...payout, status: "PAID" }),
      },
    };
    const service = new EscrowCreatorPayoutService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      {} as never,
    );

    const result = await service.reconcileProviderPayout(
      "provider-1",
      "processed",
    );

    const mutation = tx.brandEscrowVault.update.mock.calls[0][0].data;
    expect(mutation.lockedCampaignFunds.decrement.toNumber()).toBe(20000);
    expect(mutation.totalPooledBalance.decrement.toNumber()).toBe(20000);
    expect(mutation).not.toHaveProperty("availableBalance");
    expect(tx.collaborationEscrowLock.update.mock.calls[0][0].data).toEqual({
      advanceTrancheDisbursed: true,
    });
    expect(tx.escrowTransactionLedger.create).toHaveBeenCalledTimes(1);
    expect(
      tx.escrowTransactionLedger.create.mock.calls[0][0].data,
    ).toMatchObject({
      transactionType: "CREATOR_PAYOUT",
      amount: new Decimal(20000),
    });
    expect(result?.state).toBe("PAID");
  });
});

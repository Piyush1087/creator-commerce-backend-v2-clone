import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { BrandEscrowInterlockService } from "./brand-escrow-interlock.service";

describe("BS09 P2C1 collaboration refund idempotency", () => {
  const input = {
    collaborationId: "collab-1",
    reasonCode: "MUTUAL_TERMINATION" as const,
    diagnosticNotes: "test",
  };

  it("moves the full unused reserve from locked to available exactly once", async () => {
    const tx = {
      collaborationEscrowLock: {
        findUnique: vi.fn().mockResolvedValue({
          id: "lock-1",
          brandProfileId: "brand-1",
          totalEscrowLockedAmount: new Decimal(108260),
          netCreatorPayoutPool: new Decimal(100000),
          advanceTrancheDisbursed: false,
          finalTrancheDisbursed: false,
          lockReleasedViaRefund: false,
        }),
        update: vi.fn(),
      },
      brandEscrowVault: {
        findUnique: vi.fn().mockResolvedValue({
          id: "vault-1",
          currency: "INR",
        }),
        update: vi.fn(),
      },
      escrowTransactionLedger: { create: vi.fn() },
      collaborationCommercial: { updateMany: vi.fn() },
      collaborationMessage: { create: vi.fn() },
    };
    const service = new BrandEscrowInterlockService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      {} as never,
    );

    const result = await service.executeAutomatedRefund(input);

    expect(result.amount_returned).toBe(108260);
    expect(tx.brandEscrowVault.update).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: {
        lockedCampaignFunds: { decrement: new Decimal(108260) },
        availableBalance: { increment: new Decimal(108260) },
      },
    });
    expect(tx.collaborationEscrowLock.update).toHaveBeenCalledWith({
      where: { id: "lock-1" },
      data: { lockReleasedViaRefund: true },
    });
    expect(tx.escrowTransactionLedger.create).toHaveBeenCalledTimes(1);
    expect(tx.escrowTransactionLedger.create.mock.calls[0][0].data).toMatchObject(
      {
        transactionType: "COLLAB_REFUND",
        idempotencyKey: "collab-refund:collab-1",
      },
    );
  });

  it("returns ALREADY_REVERSED without a second mutation or ledger entry", async () => {
    const tx = {
      collaborationEscrowLock: {
        findUnique: vi.fn().mockResolvedValue({ lockReleasedViaRefund: true }),
      },
      brandEscrowVault: { findUnique: vi.fn(), update: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
      collaborationCommercial: { updateMany: vi.fn() },
      collaborationMessage: { create: vi.fn() },
    };
    const service = new BrandEscrowInterlockService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      {} as never,
    );

    const result = await service.executeAutomatedRefund(input);

    expect(result).toEqual({
      collaboration_id: "collab-1",
      refund_status: "ALREADY_REVERSED",
      amount_returned: 0,
    });
    expect(tx.brandEscrowVault.update).not.toHaveBeenCalled();
    expect(tx.escrowTransactionLedger.create).not.toHaveBeenCalled();
    expect(tx.collaborationCommercial.updateMany).not.toHaveBeenCalled();
  });
});

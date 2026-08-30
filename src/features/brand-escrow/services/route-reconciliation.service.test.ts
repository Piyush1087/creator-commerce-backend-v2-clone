import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { RouteReconciliationService } from "./route-reconciliation.service";
import { RouteTransferService } from "./route-transfer.service";

describe("Route reconciliation invariants", () => {
  it("does not regress processed transfer truth on an out-of-order pending event", async () => {
    const update = vi.fn().mockImplementation(({ data }) => data);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      routeTransferAttempt: {
        findUnique: vi.fn().mockResolvedValue({
          id: "attempt-1",
          state: "PROCESSED",
          settlementState: "PENDING",
          onHold: false,
          onHoldUntil: null,
          processedAt: new Date("2026-01-01T00:00:00Z"),
          failedAt: null,
        }),
        update,
      },
    };
    const service = new RouteReconciliationService(
      {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      } as never,
      {} as never,
    );

    await service.reconcileTransfer({
      transferId: "tr_synthetic",
      providerState: "pending",
    });

    expect(update.mock.calls[0][0].data).toMatchObject({
      state: "PROCESSED",
      settlementState: "PENDING",
    });
  });

  it("reserves pending reversal amounts when enforcing the cumulative cap", async () => {
    const createReversal = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      routeTransferReversal: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createReversal,
      },
      routeTransferAttempt: {
        findUnique: vi.fn().mockResolvedValue({
          id: "attempt-1",
          transferId: "tr_synthetic",
          amount: new Decimal(100),
          currency: "INR",
          state: "PROCESSED",
          reversals: [
            { state: "PENDING", amount: new Decimal(60) },
            { state: "FAILED", amount: new Decimal(90) },
          ],
        }),
      },
    };
    const service = new RouteTransferService(
      {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      } as never,
      { createReversal: vi.fn() } as never,
      {} as never,
    );

    await expect(
      service.createReversal({
        transferAttemptId: "attempt-1",
        amount: 41,
        currency: "INR",
        idempotencyKey: "reversal-command-2",
        resolutionReferenceId: "resolution-2",
      }),
    ).rejects.toThrow("Cumulative reversal exceeds transfer amount");
    expect(createReversal).not.toHaveBeenCalled();
  });

  it("restores settled accounting exactly once after provider-confirmed partial reversal", async () => {
    const reversalRecord = {
      id: "reversal-record-1",
      reversalId: "rev_provider_1",
      transferAttemptId: "attempt-1",
      amount: new Decimal(25),
      currency: "INR",
      state: "PENDING",
      transferAttempt: {
        id: "attempt-1",
        transferId: "tr_provider_1",
        amount: new Decimal(100),
        state: "PROCESSED",
        settlementState: "SETTLED",
        obligation: {
          id: "obligation-1",
          vaultId: "vault-1",
          brandProfileId: "brand-1",
          collaborationId: "collab-1",
        },
        reversals: [] as Array<{
          id: string;
          state: string;
          amount: Decimal;
        }>,
      },
    };
    const vaultUpdate = vi.fn();
    const ledgerCreate = vi.fn();
    const reversalUpdate = vi.fn().mockImplementation(({ data }) => {
      Object.assign(reversalRecord, data);
      return reversalRecord;
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      routeTransferReversal: {
        findUnique: vi.fn().mockImplementation(() => reversalRecord),
        update: reversalUpdate,
      },
      brandEscrowVault: { update: vaultUpdate },
      escrowTransactionLedger: { create: ledgerCreate },
      routeTransferAttempt: { update: vi.fn() },
      creatorPayoutObligation: { update: vi.fn() },
    };
    const notifications = { enqueueWithinTransaction: vi.fn() };
    const service = new RouteReconciliationService(
      {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      } as never,
      notifications as never,
    );

    await service.reconcileReversal({
      reversalId: "rev_provider_1",
      providerState: "processed",
    });
    await service.reconcileReversal({
      reversalId: "rev_provider_1",
      providerState: "processed",
    });

    expect(vaultUpdate).toHaveBeenCalledTimes(1);
    expect(vaultUpdate).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: {
        totalPooledBalance: { increment: new Decimal(25) },
        lockedCampaignFunds: { increment: new Decimal(25) },
      },
    });
    expect(ledgerCreate).toHaveBeenCalledTimes(1);
    expect(notifications.enqueueWithinTransaction).toHaveBeenCalledTimes(1);
  });
});

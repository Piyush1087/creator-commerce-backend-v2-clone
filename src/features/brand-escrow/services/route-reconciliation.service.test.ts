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
});

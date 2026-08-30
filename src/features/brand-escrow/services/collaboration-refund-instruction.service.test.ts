import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { CollaborationRefundInstructionService } from "./collaboration-refund-instruction.service";

const instruction = {
  instructionId: "refund-resolution:collab-1:brand",
  collaborationId: "collab-1",
  brandProfileId: "brand-1",
  amount: new Decimal(75),
  currency: "INR",
  issuedAt: new Date("2026-09-05T00:00:00Z"),
  financialResolutionReference: "resolution-1",
};

const successHarness = () => {
  const executed = {
    id: "refund-record-1",
    refundInstructionId: instruction.instructionId,
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    collaborationRefundInstruction: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(executed),
    },
    collaboration: {
      findUnique: vi.fn().mockResolvedValue({ brandProfileId: "brand-1" }),
    },
    collaborationEscrowLock: {
      findUnique: vi.fn().mockResolvedValue({
        totalEscrowLockedAmount: new Decimal(100),
        netCreatorPayoutPool: new Decimal(100),
        lockReleasedViaRefund: false,
      }),
    },
    brandEscrowVault: {
      findUnique: vi.fn().mockResolvedValue({
        id: "vault-1",
        currency: "INR",
        lockedCampaignFunds: new Decimal(100),
      }),
      update: vi.fn(),
    },
    escrowTransactionLedger: {
      create: vi.fn().mockResolvedValue({ id: "ledger-1" }),
    },
    collaborationMessage: { create: vi.fn() },
  };
  const notifications = { enqueueWithinTransaction: vi.fn() };
  const allocations = { assertRefundAllocation: vi.fn() };
  const service = new CollaborationRefundInstructionService(
    {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    } as never,
    notifications as never,
    allocations as never,
  );
  return { allocations, executed, notifications, service, tx };
};

describe("trusted Collaboration refund instruction", () => {
  it("moves only the exact internal amount and emits after durable execution", async () => {
    const { allocations, executed, notifications, service, tx } =
      successHarness();

    await expect(service.consumeRefundInstruction(instruction)).resolves.toBe(
      executed,
    );
    expect(allocations.assertRefundAllocation).toHaveBeenCalledWith(
      tx,
      "collab-1",
      expect.any(Object),
      new Decimal(75),
    );
    expect(tx.brandEscrowVault.update).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: {
        lockedCampaignFunds: { decrement: new Decimal(75) },
        availableBalance: { increment: new Decimal(75) },
      },
    });
    expect(tx.brandEscrowVault.update.mock.calls[0][0].data).not.toHaveProperty(
      "totalPooledBalance",
    );
    expect(tx.escrowTransactionLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transactionType: "COLLAB_REFUND",
        amount: new Decimal(75),
        idempotencyKey:
          "collab-refund-instruction:refund-resolution:collab-1:brand",
      }),
    });
    expect(notifications.enqueueWithinTransaction).toHaveBeenCalledTimes(1);
  });

  it("replays the same instruction without another execution", async () => {
    const existing = {
      id: "refund-record-1",
      refundInstructionId: instruction.instructionId,
      collaborationId: instruction.collaborationId,
      brandProfileId: instruction.brandProfileId,
      amount: instruction.amount,
      currency: instruction.currency,
      financialResolutionReference: instruction.financialResolutionReference,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      collaborationRefundInstruction: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      brandEscrowVault: { update: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
    };
    const service = new CollaborationRefundInstructionService(
      {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.consumeRefundInstruction(instruction)).resolves.toBe(
      existing,
    );
    expect(tx.brandEscrowVault.update).not.toHaveBeenCalled();
    expect(tx.escrowTransactionLedger.create).not.toHaveBeenCalled();
  });

  it("rejects the same instruction ID with changed economics", async () => {
    const existing = {
      collaborationId: instruction.collaborationId,
      brandProfileId: instruction.brandProfileId,
      amount: new Decimal(74),
      currency: instruction.currency,
      financialResolutionReference: instruction.financialResolutionReference,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      collaborationRefundInstruction: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
    };
    const service = new CollaborationRefundInstructionService(
      {
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(service.consumeRefundInstruction(instruction)).rejects.toThrow(
      "Refund instruction identity was reused with different economics",
    );
  });
});

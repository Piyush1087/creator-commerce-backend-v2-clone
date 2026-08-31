import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { EscrowFundingAttributionService } from "./escrow-funding-attribution.service";

describe("BS04 funding-lot FIFO attribution", () => {
  it("reserves oldest economic capacity first with deterministic lot tie-breaks", async () => {
    const lotUpdate = vi.fn();
    const allocationUpsert = vi.fn();
    const tx = {
      escrowFundingLot: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "legacy-opening:vault-1",
            availableAmount: new Decimal(100),
          },
          { id: "lot-b", availableAmount: new Decimal(100) },
          { id: "lot-c", availableAmount: new Decimal(100) },
        ]),
        update: lotUpdate,
      },
      collaborationFundingLotAllocation: { upsert: allocationUpsert },
    };
    await new EscrowFundingAttributionService().reserveAvailable(tx as never, {
      vaultId: "vault-1",
      brandProfileId: "brand-1",
      collaborationId: "collab-1",
      currency: "INR",
      amount: new Decimal(120),
    });

    expect(lotUpdate.mock.calls.map((call) => call[0].where.id)).toEqual([
      "legacy-opening:vault-1",
      "lot-b",
    ]);
    expect(
      lotUpdate.mock.calls.map((call) =>
        call[0].data.lockedAmount.increment.toNumber(),
      ),
    ).toEqual([100, 20]);
    expect(allocationUpsert).toHaveBeenCalledTimes(2);
  });

  it("fails closed when aggregate vault AVAILABLE lacks lot authority", async () => {
    const tx = {
      escrowFundingLot: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "lot-a", availableAmount: new Decimal(30) },
          ]),
        update: vi.fn(),
      },
      collaborationFundingLotAllocation: { upsert: vi.fn() },
    };
    await expect(
      new EscrowFundingAttributionService().reserveAvailable(tx as never, {
        vaultId: "vault-1",
        brandProfileId: "brand-1",
        collaborationId: "collab-1",
        currency: "INR",
        amount: new Decimal(50),
      }),
    ).rejects.toThrow("does not reconcile with the vault");
  });

  it("restores a Collaboration refund to the exact locked source lot", async () => {
    const allocationUpdate = vi.fn();
    const lotUpdate = vi.fn();
    const tx = {
      collaborationFundingLotAllocation: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { lockedAmount: new Decimal(100) },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "collab-lot-a",
            fundingLotId: "lot-a",
            lockedAmount: new Decimal(100),
            payoutAllocations: [],
          },
        ]),
        update: allocationUpdate,
      },
      escrowFundingLot: { update: lotUpdate },
    };

    await new EscrowFundingAttributionService().releaseCollaborationLocked(
      tx as never,
      {
        vaultId: "vault-1",
        collaborationId: "collab-1",
        currency: "INR",
        amount: new Decimal(40),
      },
    );

    expect(allocationUpdate).toHaveBeenCalledWith({
      where: { id: "collab-lot-a" },
      data: {
        lockedAmount: { decrement: new Decimal(40) },
        releasedAmount: { increment: new Decimal(40) },
      },
    });
    expect(lotUpdate).toHaveBeenCalledWith({
      where: { id: "lot-a" },
      data: {
        lockedAmount: { decrement: new Decimal(40) },
        availableAmount: { increment: new Decimal(40) },
      },
    });
  });

  it("allocates a Creator obligation FIFO across the Collaboration's exact locked lots", async () => {
    const create = vi.fn();
    const tx = {
      collaborationFundingLotAllocation: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { lockedAmount: new Decimal(100) },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "collab-lot-a",
            fundingLotId: "lot-a",
            lockedAmount: new Decimal(60),
            payoutAllocations: [],
          },
          {
            id: "collab-lot-b",
            fundingLotId: "lot-b",
            lockedAmount: new Decimal(40),
            payoutAllocations: [],
          },
        ]),
      },
      creatorPayoutFundingAllocation: { create },
    };

    await new EscrowFundingAttributionService().allocateCreatorObligation(
      tx as never,
      {
        obligationId: "obligation-1",
        vaultId: "vault-1",
        collaborationId: "collab-1",
        currency: "INR",
        amount: new Decimal(75),
      },
    );

    expect(
      create.mock.calls.map((call) => ({
        fundingLotId: call[0].data.fundingLotId,
        amount: call[0].data.allocatedAmount.toNumber(),
      })),
    ).toEqual([
      { fundingLotId: "lot-a", amount: 60 },
      { fundingLotId: "lot-b", amount: 15 },
    ]);
  });

  it("consumes Creator settlement lineage and restores the same lot on Route reversal", async () => {
    const payoutUpdate = vi.fn();
    const collaborationUpdate = vi.fn();
    const lotUpdate = vi.fn();
    const payoutRows = [
      {
        id: "payout-lot-a",
        obligationId: "obligation-1",
        collaborationAllocationId: "collab-lot-a",
        fundingLotId: "lot-a",
        allocatedAmount: new Decimal(60),
        consumedAmount: new Decimal(0),
        reversedAmount: new Decimal(0),
      },
      {
        id: "payout-lot-b",
        obligationId: "obligation-1",
        collaborationAllocationId: "collab-lot-b",
        fundingLotId: "lot-b",
        allocatedAmount: new Decimal(40),
        consumedAmount: new Decimal(0),
        reversedAmount: new Decimal(0),
      },
    ];
    const tx = {
      creatorPayoutFundingAllocation: {
        findMany: vi.fn().mockImplementation(() => payoutRows),
        update: payoutUpdate,
      },
      collaborationFundingLotAllocation: { update: collaborationUpdate },
      escrowFundingLot: { update: lotUpdate },
    };
    const service = new EscrowFundingAttributionService();

    await service.consumeCreatorSettlement(tx as never, {
      obligationId: "obligation-1",
      vaultId: "vault-1",
      collaborationId: "collab-1",
      currency: "INR",
      amount: new Decimal(75),
    });
    expect(
      lotUpdate.mock.calls.map((call) =>
        call[0].data.consumedAmount.increment.toNumber(),
      ),
    ).toEqual([60, 15]);

    payoutRows[0].consumedAmount = new Decimal(60);
    payoutRows[1].consumedAmount = new Decimal(15);
    payoutUpdate.mockClear();
    collaborationUpdate.mockClear();
    lotUpdate.mockClear();
    await service.restoreCreatorReversal(
      tx as never,
      "obligation-1",
      new Decimal(65),
    );

    expect(
      lotUpdate.mock.calls.map((call) =>
        call[0].data.lockedAmount.increment.toNumber(),
      ),
    ).toEqual([60, 5]);
    expect(
      collaborationUpdate.mock.calls.map((call) =>
        call[0].data.consumedAmount.decrement.toNumber(),
      ),
    ).toEqual([60, 5]);
  });
});

import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { EscrowFinancialAllocationService } from "./escrow-financial-allocation.service";

const obligation = (amount: number, confirmedReversals: number[] = []) => ({
  entitlementAmount: new Decimal(amount),
  transfers: [
    {
      reversals: confirmedReversals.map((value) => ({
        amount: new Decimal(value),
      })),
    },
  ],
});

const harness = (input?: {
  obligations?: ReturnType<typeof obligation>[];
  refunds?: number;
}) => ({
  creatorPayoutObligation: {
    findMany: vi.fn().mockResolvedValue(input?.obligations ?? []),
  },
  collaborationRefundInstruction: {
    aggregate: vi.fn().mockResolvedValue({
      _sum: {
        amount:
          input?.refunds === undefined ? null : new Decimal(input.refunds),
      },
    }),
  },
  escrowTransactionLedger: { findMany: vi.fn().mockResolvedValue([]) },
});

const authority = {
  netCreatorPayoutPool: new Decimal(100),
  totalEscrowLockedAmount: new Decimal(100),
};

describe("BS09 cumulative economic allocation fence", () => {
  const service = new EscrowFinancialAllocationService();

  it("allows sequential Creator instructions of 25 then 75", async () => {
    await expect(
      service.assertCreatorAllocation(
        harness({ obligations: [obligation(25)] }) as never,
        "collab-1",
        authority,
        new Decimal(75),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a different instruction whose cumulative 70 plus 40 exceeds the pool", async () => {
    await expect(
      service.assertCreatorAllocation(
        harness({ obligations: [obligation(70)] }) as never,
        "collab-1",
        authority,
        new Decimal(40),
      ),
    ).rejects.toThrow(
      "Cumulative Creator payout instructions exceed the canonical Creator pool",
    );
  });

  it.each([
    { label: "ADVANCE + BALANCE", prior: 30, next: 70 },
    { label: "FULL after ADVANCE", prior: 30, next: 100 },
    { label: "RESOLUTION after BALANCE", prior: 70, next: 30 },
  ])("applies one cumulative fence to $label", async ({ prior, next }) => {
    const assertion = service.assertCreatorAllocation(
      harness({ obligations: [obligation(prior)] }) as never,
      "collab-1",
      authority,
      new Decimal(next),
    );
    if (prior + next <= 100) await expect(assertion).resolves.toBeUndefined();
    else
      await expect(assertion).rejects.toThrow(
        "Cumulative Creator payout instructions exceed the canonical Creator pool",
      );
  });

  it("allows compatible Creator and Brand refund legs from one split resolution", async () => {
    await expect(
      service.assertRefundAllocation(
        harness({ obligations: [obligation(25)] }) as never,
        "collab-1",
        authority,
        new Decimal(75),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects split-resolution over-allocation", async () => {
    await expect(
      service.assertRefundAllocation(
        harness({ obligations: [obligation(25)] }) as never,
        "collab-1",
        authority,
        new Decimal(90),
      ),
    ).rejects.toThrow(
      "Combined financial instructions exceed the Collaboration locked authority",
    );
  });

  it("restores economic capacity only for provider-confirmed reversal amounts", async () => {
    await expect(
      service.assertRefundAllocation(
        harness({ obligations: [obligation(100, [25])] }) as never,
        "collab-1",
        authority,
        new Decimal(25),
      ),
    ).resolves.toBeUndefined();
  });

  it("does not free refund capacity for an unconfirmed reversal", async () => {
    await expect(
      service.assertRefundAllocation(
        harness({ obligations: [obligation(100)] }) as never,
        "collab-1",
        authority,
        new Decimal(25),
      ),
    ).rejects.toThrow(
      "Combined financial instructions exceed the Collaboration locked authority",
    );
  });
});

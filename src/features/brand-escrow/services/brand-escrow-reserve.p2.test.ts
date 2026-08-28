import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { EscrowComputationEngine } from "./escrow-computation.engine";
import { BrandEscrowComputationService } from "./brand-escrow-computation.service";

describe("BS09 P2 canonical reserve economics", () => {
  const engine = new EscrowComputationEngine();

  it("uses fixed INR 7% commission, GST on commission, and zero TDS", () => {
    const result = engine.calculateStructure({
      grossCreatorQuote: 100000,
      currency: "INR",
      expectedTdsPercentage: 2,
      platformTakeRate: 0.05,
    });
    expect(result.platformCommissionFee.toNumber()).toBe(7000);
    expect(result.platformCommissionGst.toNumber()).toBe(1260);
    expect(result.totalEscrowLockedAmount.toNumber()).toBe(108260);
    expect(result.netCreatorPayoutPool.toNumber()).toBe(100000);
    expect(result.calculatedTdsDeduction.toNumber()).toBe(0);
  });

  it("uses fixed USD economics without GST or an INR cap", () => {
    const result = engine.calculateStructure({
      grossCreatorQuote: 100,
      currency: "USD",
      expectedTdsPercentage: 2,
      platformTakeRate: 0.06,
    });
    expect(result.platformCommissionFee.toNumber()).toBe(7);
    expect(result.platformCommissionGst.toNumber()).toBe(0);
    expect(result.totalEscrowLockedAmount.toNumber()).toBe(107);
    expect(result.netCreatorPayoutPool.toNumber()).toBe(100);
  });

  it("derives reserve from persisted finalQuote and ignores client economics", async () => {
    const ledgerCreate = vi.fn();
    const commercialUpdate = vi.fn();
    const lock = {
      id: "lock-1",
      collaborationId: "collab-1",
      grossCreatorQuote: new Decimal(100000),
      platformCommissionFee: new Decimal(7000),
      platformCommissionGst: new Decimal(1260),
      totalEscrowLockedAmount: new Decimal(108260),
      calculatedTdsDeduction: new Decimal(0),
      netCreatorPayoutPool: new Decimal(100000),
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          vault_id: "vault-1",
          brand_id: "brand-1",
          total_pooled_balance: 200000,
          locked_campaign_funds: 0,
          available_balance: 200000,
          currency: "INR",
        },
      ]),
      collaboration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "collab-1",
          brandProfileId: "brand-1",
          payoutMode: "ESCROW",
          currentStage: "STAGE_2_SECUREMENT",
          commercials: { finalQuote: new Decimal(100000) },
        }),
      },
      collaborationEscrowLock: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(lock),
      },
      brandEscrowVault: { update: vi.fn() },
      escrowTransactionLedger: { create: ledgerCreate },
      collaborationCommercial: { update: commercialUpdate },
    };
    const prisma = {
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const service = new BrandEscrowComputationService(
      prisma as never,
      engine,
      {} as never,
      { assertCapability: vi.fn() } as never,
    );
    const result = await service.executeStage2Lock({
      collaborationId: "collab-1",
      brandProfileId: "brand-1",
      grossCreatorQuote: 1,
      expectedTdsPercentage: 2,
    });
    expect(result.total_reserve).toBe(108260);
    expect(ledgerCreate.mock.calls[0][0].data.transactionType).toBe("RESERVE");
    expect(commercialUpdate.mock.calls[0][0].data).not.toHaveProperty(
      "finalQuote",
    );
    expect(commercialUpdate.mock.calls[0][0].data.escrowVaultId).toBe(
      "vault-1",
    );
  });

  it("returns AWAITING_FUNDS without lock, balance mutation, or ledger", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          vault_id: "vault-1",
          brand_id: "brand-1",
          total_pooled_balance: 100,
          locked_campaign_funds: 0,
          available_balance: 100,
          currency: "INR",
        },
      ]),
      collaboration: {
        findUnique: vi.fn().mockResolvedValue({
          id: "collab-1",
          brandProfileId: "brand-1",
          payoutMode: "ESCROW",
          currentStage: "STAGE_2_SECUREMENT",
          commercials: { finalQuote: new Decimal(100000) },
        }),
      },
      collaborationEscrowLock: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      brandEscrowVault: { update: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
      collaborationCommercial: { update: vi.fn() },
    };
    const service = new BrandEscrowComputationService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      engine,
      {} as never,
      { assertCapability: vi.fn() } as never,
    );
    const result = await service.executeStage2Lock({
      collaborationId: "collab-1",
      brandProfileId: "brand-1",
      grossCreatorQuote: 1,
      expectedTdsPercentage: 2,
    });
    expect(result.state).toBe("AWAITING_FUNDS");
    expect(tx.brandEscrowVault.update).not.toHaveBeenCalled();
    expect(tx.collaborationEscrowLock.create).not.toHaveBeenCalled();
    expect(tx.escrowTransactionLedger.create).not.toHaveBeenCalled();
  });

  describe.each([
    {
      name: "active untouched",
      flags: {
        advanceTrancheDisbursed: false,
        finalTrancheDisbursed: false,
        lockReleasedViaRefund: false,
      },
      expectedState: "FUNDED",
      contractedAdvance: 0,
    },
    {
      name: "partially released",
      flags: {
        advanceTrancheDisbursed: true,
        finalTrancheDisbursed: false,
        lockReleasedViaRefund: false,
      },
      expectedState: "PARTIAL_RELEASE",
      contractedAdvance: 0,
    },
    {
      name: "refunded",
      flags: {
        advanceTrancheDisbursed: false,
        finalTrancheDisbursed: false,
        lockReleasedViaRefund: true,
      },
      expectedState: "REFUNDED",
      contractedAdvance: 0,
    },
    {
      name: "settled",
      flags: {
        advanceTrancheDisbursed: true,
        finalTrancheDisbursed: true,
        lockReleasedViaRefund: false,
      },
      expectedState: "SETTLED",
      contractedAdvance: 0,
    },
    {
      name: "final paid with nonzero advance outstanding",
      flags: {
        advanceTrancheDisbursed: false,
        finalTrancheDisbursed: true,
        lockReleasedViaRefund: false,
      },
      expectedState: "PARTIAL_RELEASE",
      contractedAdvance: 20000,
    },
  ])(
    "existing $name reserve",
    ({ flags, expectedState, contractedAdvance }) => {
      it(`returns ${expectedState} without reserving again`, async () => {
        const existing = {
          id: "lock-existing",
          collaborationId: "collab-1",
          grossCreatorQuote: new Decimal(100000),
          platformCommissionFee: new Decimal(7000),
          platformCommissionGst: new Decimal(1260),
          totalEscrowLockedAmount: new Decimal(108260),
          calculatedTdsDeduction: new Decimal(0),
          netCreatorPayoutPool: new Decimal(100000),
          ...flags,
        };
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              vault_id: "vault-1",
              brand_id: "brand-1",
              total_pooled_balance: 200000,
              locked_campaign_funds: 108260,
              available_balance: 91740,
              currency: "INR",
            },
          ]),
          collaboration: {
            findUnique: vi.fn().mockResolvedValue({
              id: "collab-1",
              brandProfileId: "brand-1",
              payoutMode: "ESCROW",
              currentStage: "STAGE_3_LOGISTICS",
              commercials: {
                finalQuote: new Decimal(100000),
                advance30Amount: new Decimal(contractedAdvance ?? 0),
                escrowStatus: expectedState,
              },
            }),
          },
          collaborationEscrowLock: {
            findUnique: vi.fn().mockResolvedValue(existing),
            create: vi.fn(),
          },
          brandEscrowVault: { update: vi.fn() },
          escrowTransactionLedger: { create: vi.fn() },
          collaborationCommercial: { update: vi.fn() },
        };
        const service = new BrandEscrowComputationService(
          {
            $transaction: (callback: (value: typeof tx) => unknown) =>
              callback(tx),
          } as never,
          engine,
          {} as never,
          { assertCapability: vi.fn() } as never,
        );

        const result = await service.executeStage2Lock({
          collaborationId: "collab-1",
          brandProfileId: "brand-1",
          grossCreatorQuote: 1,
          expectedTdsPercentage: 2,
        });

        expect(result.state).toBe(expectedState);
        expect(tx.brandEscrowVault.update).not.toHaveBeenCalled();
        expect(tx.collaborationEscrowLock.create).not.toHaveBeenCalled();
        expect(tx.escrowTransactionLedger.create).not.toHaveBeenCalled();
        expect(tx.collaborationCommercial.update).not.toHaveBeenCalled();
        expect(existing).toMatchObject(flags);
      });
    },
  );
});

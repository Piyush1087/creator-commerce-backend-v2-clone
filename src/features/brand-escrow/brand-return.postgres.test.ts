import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { BrandReturnService } from "./services/brand-return.service";

describe.skipIf(process.env.RUN_BS04_POSTGRES_TESTS !== "true")(
  "BS04 PostgreSQL invariants and serialization",
  () => {
    const db = new PrismaClient();
    const suffix = randomUUID();
    const brandId = `bs04-brand-${suffix}`;
    const fixtureBrandIds = [brandId];
    let vaultId: string;
    let service: BrandReturnService;

    const provider = (createRefund = vi.fn()) => ({
      capabilities: async () => [
        { sourceType: "GATEWAY" as const, currency: "INR" },
      ],
      assertExecutionAvailable: async () => undefined,
      createRefund,
      fetchRefund: vi.fn(),
    });

    const returnService = (refundProvider = provider()) =>
      new BrandReturnService(
        db as never,
        refundProvider as never,
        { enqueueWithinTransaction: async () => undefined } as never,
      );

    const createRaceFixture = async (
      label: string,
      balances: { available: number; locked?: number; consumed?: number },
    ) => {
      const id = randomUUID();
      const raceBrandId = `bs04-race-${label}-${id}`;
      fixtureBrandIds.push(raceBrandId);
      await db.brandProfile.create({
        data: {
          id: raceBrandId,
          domain: `${label}-${id}.bs04.example`,
          name: `BS04 ${label}`,
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      const locked = balances.locked ?? 0;
      const consumed = balances.consumed ?? 0;
      const total = balances.available + locked;
      const vault = await db.brandEscrowVault.create({
        data: {
          brandProfileId: raceBrandId,
          currency: "INR",
          totalPooledBalance: total,
          availableBalance: balances.available,
          lockedCampaignFunds: locked,
        },
      });
      const lot = await db.escrowFundingLot.create({
        data: {
          vaultId: vault.id,
          brandProfileId: raceBrandId,
          sourceType: "GATEWAY",
          provenanceStatus: "PROVEN_SOURCE",
          currency: "INR",
          requestedPrincipal: total + consumed,
          creditedPrincipal: total + consumed,
          providerRefundableAmount: total + consumed,
          providerOrderId: `order-${label}-${id}`,
          providerPaymentId: `payment-${label}-${id}`,
          providerPaymentCaptured: true,
          availableAmount: balances.available,
          lockedAmount: locked,
          consumedAmount: consumed,
          economicAt: new Date(),
          creditedAt: new Date(),
        },
      });
      return { brandId: raceBrandId, lotId: lot.id, vaultId: vault.id };
    };

    const lockVault = async (tx: Prisma.TransactionClient, id: string) => {
      await tx.$queryRaw`
        SELECT vault_id FROM brand_escrow_vaults
        WHERE vault_id = ${id}
        FOR UPDATE
      `;
    };

    const expectInvariants = async (id: string) => {
      const vault = await db.brandEscrowVault.findUniqueOrThrow({
        where: { id },
      });
      expect(
        vault.availableBalance
          .add(vault.lockedCampaignFunds)
          .add(vault.activeReturnCommitment)
          .equals(vault.totalPooledBalance),
      ).toBe(true);
      const lots = await db.escrowFundingLot.findMany({
        where: { vaultId: id },
      });
      for (const lot of lots) {
        expect(
          lot.availableAmount
            .add(lot.lockedAmount)
            .add(lot.returnCommittedAmount)
            .add(lot.consumedAmount)
            .add(lot.externallyReturnedAmount)
            .equals(lot.creditedPrincipal),
        ).toBe(true);
      }
      return vault;
    };

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.toLowerCase().includes("bs04")
      ) {
        throw new Error(
          "BS04 PostgreSQL tests require a disposable loopback bs04 database",
        );
      }
      await db.brandProfile.create({
        data: {
          id: brandId,
          domain: `${suffix}.bs04.example`,
          name: "BS04 test brand",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      const vault = await db.brandEscrowVault.create({
        data: {
          brandProfileId: brandId,
          currency: "INR",
          totalPooledBalance: 100,
          availableBalance: 100,
        },
      });
      vaultId = vault.id;
      await db.escrowFundingLot.create({
        data: {
          vaultId,
          brandProfileId: brandId,
          sourceType: "GATEWAY",
          provenanceStatus: "PROVEN_SOURCE",
          currency: "INR",
          requestedPrincipal: 100,
          creditedPrincipal: 100,
          providerRefundableAmount: 100,
          providerOrderId: `order-${suffix}`,
          providerPaymentId: `payment-${suffix}`,
          providerPaymentCaptured: true,
          availableAmount: 100,
          economicAt: new Date(),
          creditedAt: new Date(),
        },
      });
      service = returnService();
    });

    afterAll(async () => {
      await db.brandReturnAllocation.deleteMany({
        where: { request: { brandProfileId: { in: fixtureBrandIds } } },
      });
      await db.brandReturnRequest.deleteMany({
        where: { brandProfileId: { in: fixtureBrandIds } },
      });
      await db.escrowTransactionLedger.deleteMany({
        where: { brandProfileId: { in: fixtureBrandIds } },
      });
      await db.brandWithdrawalAccount.deleteMany({
        where: { brandProfileId: { in: fixtureBrandIds } },
      });
      await db.escrowFundingLot.deleteMany({
        where: { brandProfileId: { in: fixtureBrandIds } },
      });
      await db.brandEscrowVault.deleteMany({
        where: { brandProfileId: { in: fixtureBrandIds } },
      });
      await db.brandProfile.deleteMany({
        where: { id: { in: fixtureBrandIds } },
      });
      await db.$disconnect();
    });

    it("installs lot, request and vault reconciliation constraints", async () => {
      const rows = await db.$queryRaw<Array<{ name: string }>>`
        SELECT conname AS name
        FROM pg_constraint
        WHERE conname IN (
          'check_escrow_ledger_integrity',
          'escrow_funding_lots_bucket_reconciliation',
          'collaboration_funding_lot_allocations_reconciliation',
          'brand_return_requests_reconciliation'
        )
      `;
      expect(new Set(rows.map((row) => row.name))).toEqual(
        new Set([
          "check_escrow_ledger_integrity",
          "escrow_funding_lots_bucket_reconciliation",
          "collaboration_funding_lot_allocations_reconciliation",
          "brand_return_requests_reconciliation",
        ]),
      );
    });

    it("serializes concurrent returns so only one can commit the same AVAILABLE", async () => {
      const results = await Promise.allSettled([
        service.requestReturn({
          brandProfileId: brandId,
          requestedByUserId: "owner-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        service.requestReturn({
          brandProfileId: brandId,
          requestedByUserId: "finance-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      const vault = await db.brandEscrowVault.findUniqueOrThrow({
        where: { id: vaultId },
      });
      expect(vault.availableBalance.toNumber()).toBe(20);
      expect(vault.activeReturnCommitment.toNumber()).toBe(80);
      expect(vault.totalPooledBalance.toNumber()).toBe(100);
      expect(
        vault.availableBalance
          .add(vault.lockedCampaignFunds)
          .add(vault.activeReturnCommitment)
          .equals(vault.totalPooledBalance),
      ).toBe(true);
    });

    it("serializes return vs reserve without overspending AVAILABLE", async () => {
      const fixture = await createRaceFixture("reserve", { available: 100 });
      const reserve = db.$transaction(
        async (tx) => {
          await lockVault(tx, fixture.vaultId);
          const vault = await tx.brandEscrowVault.findUniqueOrThrow({
            where: { id: fixture.vaultId },
          });
          if (vault.availableBalance.lessThan(50))
            throw new Error("reserve lacks AVAILABLE");
          await tx.escrowFundingLot.update({
            where: { id: fixture.lotId },
            data: {
              availableAmount: { decrement: 50 },
              lockedAmount: { increment: 50 },
            },
          });
          await tx.brandEscrowVault.update({
            where: { id: fixture.vaultId },
            data: {
              availableBalance: { decrement: 50 },
              lockedCampaignFunds: { increment: 50 },
            },
          });
        },
        { isolationLevel: "Serializable" },
      );
      const result = await Promise.allSettled([
        returnService().requestReturn({
          brandProfileId: fixture.brandId,
          requestedByUserId: "owner-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        reserve,
      ]);
      expect(result.filter((row) => row.status === "fulfilled")).toHaveLength(
        1,
      );
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.availableBalance.greaterThanOrEqualTo(0)).toBe(true);
    });

    it("serializes return vs COLLAB_REFUND as complete pre/post states", async () => {
      const fixture = await createRaceFixture("collab-refund", {
        available: 80,
        locked: 20,
      });
      const collabRefund = db.$transaction(async (tx) => {
        await lockVault(tx, fixture.vaultId);
        await tx.escrowFundingLot.update({
          where: { id: fixture.lotId },
          data: {
            lockedAmount: { decrement: 20 },
            availableAmount: { increment: 20 },
          },
        });
        await tx.brandEscrowVault.update({
          where: { id: fixture.vaultId },
          data: {
            lockedCampaignFunds: { decrement: 20 },
            availableBalance: { increment: 20 },
          },
        });
      });
      const result = await Promise.allSettled([
        returnService().requestReturn({
          brandProfileId: fixture.brandId,
          requestedByUserId: "owner-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        collabRefund,
      ]);
      expect(result.every((row) => row.status === "fulfilled")).toBe(true);
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.availableBalance.toNumber()).toBe(20);
      expect(vault.activeReturnCommitment.toNumber()).toBe(80);
    });

    it("serializes return vs funding credit without losing the new lot", async () => {
      const fixture = await createRaceFixture("funding", { available: 100 });
      const fundingCredit = db.$transaction(async (tx) => {
        await lockVault(tx, fixture.vaultId);
        const id = randomUUID();
        await tx.escrowFundingLot.create({
          data: {
            vaultId: fixture.vaultId,
            brandProfileId: fixture.brandId,
            sourceType: "GATEWAY",
            provenanceStatus: "PROVEN_SOURCE",
            currency: "INR",
            requestedPrincipal: 50,
            creditedPrincipal: 50,
            providerRefundableAmount: 50,
            providerOrderId: `order-credit-${id}`,
            providerPaymentId: `payment-credit-${id}`,
            providerPaymentCaptured: true,
            availableAmount: 50,
            economicAt: new Date(),
            creditedAt: new Date(),
          },
        });
        await tx.brandEscrowVault.update({
          where: { id: fixture.vaultId },
          data: {
            totalPooledBalance: { increment: 50 },
            availableBalance: { increment: 50 },
          },
        });
      });
      const result = await Promise.allSettled([
        returnService().requestReturn({
          brandProfileId: fixture.brandId,
          requestedByUserId: "finance-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        fundingCredit,
      ]);
      expect(result.every((row) => row.status === "fulfilled")).toBe(true);
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.totalPooledBalance.toNumber()).toBe(150);
      expect(vault.availableBalance.toNumber()).toBe(70);
    });

    it("preserves return vs Creator settlement across AVAILABLE and LOCKED buckets", async () => {
      const fixture = await createRaceFixture("settlement", {
        available: 80,
        locked: 20,
      });
      const settlement = db.$transaction(async (tx) => {
        await lockVault(tx, fixture.vaultId);
        await tx.escrowFundingLot.update({
          where: { id: fixture.lotId },
          data: {
            lockedAmount: { decrement: 20 },
            consumedAmount: { increment: 20 },
          },
        });
        await tx.brandEscrowVault.update({
          where: { id: fixture.vaultId },
          data: {
            lockedCampaignFunds: { decrement: 20 },
            totalPooledBalance: { decrement: 20 },
          },
        });
      });
      const result = await Promise.allSettled([
        returnService().requestReturn({
          brandProfileId: fixture.brandId,
          requestedByUserId: "owner-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        settlement,
      ]);
      expect(result.every((row) => row.status === "fulfilled")).toBe(true);
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.totalPooledBalance.toNumber()).toBe(80);
      expect(vault.activeReturnCommitment.toNumber()).toBe(80);
    });

    it("keeps Route reversal capacity LOCKED during a concurrent return", async () => {
      const fixture = await createRaceFixture("route-reversal", {
        available: 80,
        consumed: 20,
      });
      const reversal = db.$transaction(async (tx) => {
        await lockVault(tx, fixture.vaultId);
        await tx.escrowFundingLot.update({
          where: { id: fixture.lotId },
          data: {
            consumedAmount: { decrement: 20 },
            lockedAmount: { increment: 20 },
          },
        });
        await tx.brandEscrowVault.update({
          where: { id: fixture.vaultId },
          data: {
            totalPooledBalance: { increment: 20 },
            lockedCampaignFunds: { increment: 20 },
          },
        });
      });
      const result = await Promise.allSettled([
        returnService().requestReturn({
          brandProfileId: fixture.brandId,
          requestedByUserId: "owner-1",
          amount: 80,
          requestIdentity: randomUUID(),
        }),
        reversal,
      ]);
      expect(result.every((row) => row.status === "fulfilled")).toBe(true);
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.availableBalance.toNumber()).toBe(0);
      expect(vault.lockedCampaignFunds.toNumber()).toBe(20);
      expect(vault.activeReturnCommitment.toNumber()).toBe(80);
    });

    it("fences duplicate allocation workers to one external create", async () => {
      const fixture = await createRaceFixture("worker", { available: 100 });
      const createRefund = vi.fn().mockResolvedValue({
        kind: "SUCCEEDED",
        providerRefundId: `refund-${randomUUID()}`,
        providerState: "confirmed",
      });
      const workerService = returnService(provider(createRefund));
      const request = await workerService.requestReturn({
        brandProfileId: fixture.brandId,
        requestedByUserId: "owner-1",
        amount: 100,
        requestIdentity: randomUUID(),
      });
      await Promise.all([
        workerService.executeRequest(request.brand_return_request_id),
        workerService.executeRequest(request.brand_return_request_id),
      ]);
      expect(createRefund).toHaveBeenCalledTimes(1);
      const vault = await expectInvariants(fixture.vaultId);
      expect(vault.totalPooledBalance.toNumber()).toBe(0);
      expect(vault.activeReturnCommitment.toNumber()).toBe(0);
    });

    it("preserves withdrawal Settings persistence without using it as a return destination", async () => {
      const fixture = await createRaceFixture("withdrawal-boundary", {
        available: 100,
      });
      const account = await db.brandWithdrawalAccount.create({
        data: {
          brandProfileId: fixture.brandId,
          beneficiaryName: "Independent Treasury Account",
          bankName: "Independent Bank",
          accountNumberEncrypted: "test-ciphertext",
          ifscCode: "TEST0000001",
          isVerifiedPayoutDestination: true,
        },
      });
      await returnService().requestReturn({
        brandProfileId: fixture.brandId,
        requestedByUserId: "owner-1",
        amount: 50,
        requestIdentity: randomUUID(),
      });
      await expect(
        db.brandWithdrawalAccount.findUnique({ where: { id: account.id } }),
      ).resolves.toMatchObject({
        id: account.id,
        accountNumberEncrypted: "test-ciphertext",
        isVerifiedPayoutDestination: true,
      });
      const allocation = await db.brandReturnAllocation.findFirstOrThrow({
        where: { request: { brandProfileId: fixture.brandId } },
      });
      expect(allocation.providerPaymentId).toContain(
        "payment-withdrawal-boundary",
      );
    });
  },
);

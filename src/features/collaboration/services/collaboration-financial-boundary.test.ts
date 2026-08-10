import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { CollaborationEscrowReserveService } from "../../brand-escrow/services/collaboration-escrow-reserve.service";
import {
  calculateCommercialReserve,
  calculateFinancialResolution,
} from "../utils/collaboration-financial-calculation";
import { deriveAvailableActions } from "../utils/collaboration-thread.mapper";

const d = (value: number) => new Prisma.Decimal(value);

test("India Founder's Plan reserve applies 7% commission and 18% GST only to commission", () => {
  const result = calculateCommercialReserve(d(10_000), d(7), d(18));
  assert.equal(result.platformCommissionAmount.toNumber(), 700);
  assert.equal(result.platformCommissionGstAmount.toNumber(), 126);
  assert.equal(result.requiredSecuredAmount.toNumber(), 10_826);
  assert.notEqual(result.platformCommissionGstAmount.toNumber(), 1_800);

  const zero = calculateCommercialReserve(d(0), d(7), d(18));
  assert.equal(zero.requiredSecuredAmount.toNumber(), 0);
});

test("commercial refunds retain commission and GST proportionally without gateway charges", () => {
  const fullRefund = calculateFinancialResolution(
    d(10_000),
    d(0),
    d(7),
    d(700),
    d(18),
    d(126),
  );
  assert.equal(
    fullRefund.brandCommercialRefundEntitlementAmount.toNumber(),
    10_826,
  );
  assert.equal(fullRefund.platformCommissionRetainedAmount.toNumber(), 0);

  const partial = calculateFinancialResolution(
    d(10_000),
    d(3_000),
    d(7),
    d(700),
    d(18),
    d(126),
  );
  assert.equal(partial.platformCommissionRetainedAmount.toNumber(), 210);
  assert.equal(partial.platformCommissionGstRetainedAmount.toNumber(), 37.8);
  assert.equal(
    partial.brandCommercialRefundEntitlementAmount.toNumber(),
    7_578.2,
  );
  // A hypothetical card charge is intentionally absent from every input/output.
  assert.ok(!("gatewayProcessingCharge" in partial));
});

test("MANUAL remains technically representable but is absent from ordinary MVP actions", () => {
  const row: any = {
    sourceApplicationId: "application-1",
    lifecycle: "ACTIVE",
    canonicalStage: "SECUREMENT",
    commercialAgreement: {
      paymentRail: "MANUAL",
      securementState: "AWAITING_BRAND_PAYMENT",
    },
  };
  assert.deepEqual(deriveAvailableActions(row, "BRAND"), [
    "PostCollaborationMessage",
    "EndCollaborationByBrand",
  ]);
  row.commercialAgreement.securementState = "AWAITING_CREATOR_CONFIRMATION";
  assert.deepEqual(deriveAvailableActions(row, "CREATOR"), [
    "PostCollaborationMessage",
    "CancelCollaborationByCreator",
  ]);
});

function reserveHarness(available: number) {
  const vault = { available: d(available), locked: d(0) };
  const locks = new Map<string, any>();
  const ledgers: any[] = [];
  const collaboration = { secured: false, aggregateVersion: 1 };
  const events: any[] = [];
  let sequence = Promise.resolve();
  const tx: any = {
    $queryRaw: async () => [
      {
        vault_id: "vault-1",
        brand_id: "brand-1",
        total_pooled_balance: d(available),
        locked_campaign_funds: vault.locked,
        available_balance: vault.available,
        currency: "INR",
      },
    ],
    collaborationEscrowLock: {
      findUnique: async ({ where }: any) =>
        locks.get(where.collaborationId) ?? null,
      create: async ({ data }: any) => {
        const lock = { id: `lock:${data.collaborationId}`, ...data };
        locks.set(data.collaborationId, lock);
        return lock;
      },
    },
    brandEscrowVault: {
      updateMany: async ({ where, data }: any) => {
        if (vault.available.lessThan(where.availableBalance.gte))
          return { count: 0 };
        vault.available = vault.available.minus(
          data.availableBalance.decrement,
        );
        vault.locked = vault.locked.add(data.lockedCampaignFunds.increment);
        return { count: 1 };
      },
    },
    escrowTransactionLedger: {
      findUnique: async ({ where }: any) =>
        ledgers.find(
          (ledger) => ledger.idempotencyKey === where.idempotencyKey,
        ) ?? null,
      create: async ({ data }: any) => {
        ledgers.push(data);
        return data;
      },
    },
  };
  const prisma: any = {
    $transaction: (callback: any) => {
      const run = sequence.then(async () => {
        const snapshot = {
          available: vault.available,
          locked: vault.locked,
          locks: new Map(locks),
          ledgers: [...ledgers],
          collaboration: { ...collaboration },
          events: [...events],
        };
        try {
          return await callback(tx);
        } catch (error) {
          vault.available = snapshot.available;
          vault.locked = snapshot.locked;
          locks.clear();
          snapshot.locks.forEach((value, key) => locks.set(key, value));
          ledgers.splice(0, ledgers.length, ...snapshot.ledgers);
          Object.assign(collaboration, snapshot.collaboration);
          events.splice(0, events.length, ...snapshot.events);
          throw error;
        }
      });
      sequence = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  return {
    service: new CollaborationEscrowReserveService(),
    run: prisma.$transaction,
    tx,
    vault,
    locks,
    ledgers,
    collaboration,
    events,
  };
}

const reserveInput = (collaborationId: string) => ({
  collaborationId,
  brandProfileId: "brand-1",
  currency: "INR",
  creatorGrossFee: d(10_000),
  platformCommissionAmount: d(700),
  platformCommissionGstAmount: d(126),
  requiredSecuredAmount: d(10_826),
});

test("pooled Escrow reserve is sufficient/insufficient, idempotent, TDS-neutral and charge-exclusive", async () => {
  const h = reserveHarness(10_826);
  const first = await h.run((tx: any) =>
    h.service.reserveFunds(tx, reserveInput("collaboration-1")),
  );
  const replay = await h.run((tx: any) =>
    h.service.reserveFunds(tx, reserveInput("collaboration-1")),
  );
  assert.equal(first.status, "RESERVED");
  assert.equal(replay.status, "RESERVED");
  assert.equal(h.locks.size, 1);
  assert.equal(h.ledgers.length, 1);
  assert.equal(h.vault.available.toNumber(), 0);
  assert.equal(h.vault.locked.toNumber(), 10_826);
  assert.equal(h.ledgers[0].gatewayProcessingSurcharge.toNumber(), 0);
  assert.equal(h.ledgers[0].gatewaySurchargeGst.toNumber(), 0);
  assert.equal(
    h.locks.get("collaboration-1").calculatedTdsDeduction.toNumber(),
    0,
  );

  const insufficient = reserveHarness(10_000);
  const result = await insufficient.run((tx: any) =>
    insufficient.service.reserveFunds(tx, reserveInput("collaboration-2")),
  );
  assert.equal(result.status, "INSUFFICIENT_AVAILABLE_BALANCE");
  assert.equal(insufficient.locks.size, 0);
  assert.equal(insufficient.vault.available.toNumber(), 10_000);
});

test("concurrent reserve attempts cannot overspend the pooled vault", async () => {
  const h = reserveHarness(15_000);
  const results = await Promise.all([
    h.run((tx: any) =>
      h.service.reserveFunds(tx, reserveInput("collaboration-a")),
    ),
    h.run((tx: any) =>
      h.service.reserveFunds(tx, reserveInput("collaboration-b")),
    ),
  ]);
  assert.equal(results.filter((item) => item.status === "RESERVED").length, 1);
  assert.equal(
    results.filter((item) => item.status === "INSUFFICIENT_AVAILABLE_BALANCE")
      .length,
    1,
  );
  assert.equal(h.vault.available.toNumber(), 4_174);
  assert.equal(h.locks.size, 1);
});

test("shared transaction rolls back Escrow movement when Collaboration persistence fails", async () => {
  const h = reserveHarness(10_826);
  await assert.rejects(
    () =>
      h.run(async (tx: any) => {
        await h.service.reserveFunds(tx, reserveInput("collaboration-atomic"));
        throw new Error("forced Collaboration update failure");
      }),
    /forced Collaboration update failure/,
  );
  assert.equal(h.vault.available.toNumber(), 10_826);
  assert.equal(h.vault.locked.toNumber(), 0);
  assert.equal(h.locks.size, 0);
  assert.equal(h.ledgers.length, 0);
});

test("shared transaction commits Escrow, Collaboration state and event together", async () => {
  const h = reserveHarness(10_826);
  await h.run(async (tx: any) => {
    const reserve = await h.service.reserveFunds(
      tx,
      reserveInput("collaboration-atomic"),
    );
    assert.equal(reserve.status, "RESERVED");
    h.collaboration.secured = true;
    h.collaboration.aggregateVersion += 1;
    h.events.push({ type: "ESCROW_FUNDING_REQUESTED" });
  });
  assert.equal(h.vault.available.toNumber(), 0);
  assert.equal(h.vault.locked.toNumber(), 10_826);
  assert.equal(h.locks.size, 1);
  assert.equal(h.ledgers.length, 1);
  assert.equal(h.collaboration.secured, true);
  assert.equal(h.collaboration.aggregateVersion, 2);
  assert.equal(h.events.length, 1);
});

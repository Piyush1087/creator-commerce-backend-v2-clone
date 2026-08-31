import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { BrandEscrowService } from "./brand-escrow.service";

const vault = {
  id: "vault-1",
  brandProfileId: "brand-1",
  currency: "INR",
  razorpayVirtualAccountId: null,
};
const load = {
  id: "load-1",
  vaultId: "vault-1",
  brandProfileId: "brand-1",
  sourceType: "GATEWAY",
  currency: "INR",
  principalAmount: new Decimal(10000),
  processingFee: new Decimal(200),
  processingFeeTax: new Decimal(36),
  idempotencyKey: "key",
  providerOrderId: "order-1",
};

function service(prisma: object, razorpay: object = {}) {
  return new BrandEscrowService(
    prisma as never,
    razorpay as never,
    {} as never,
    {} as never,
    { assertCapability: vi.fn() } as never,
    { get: vi.fn().mockReturnValue("false") } as never,
  );
}

function basePrisma(overrides: Record<string, unknown> = {}) {
  return {
    brandProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "brand-1", countryCode: "IN" }),
    },
    brandEscrowVault: { upsert: vi.fn().mockResolvedValue(vault) },
    ...overrides,
  };
}

describe("BS09 P1C2 funding load and ledger atomicity", () => {
  it("creates load, LOAD and LOAD_FEE in one local transaction before provider order", async () => {
    const sequence: string[] = [];
    const tx = {
      escrowFundingLoad: {
        create: vi.fn().mockImplementation(() => {
          sequence.push("load");
          return load;
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(load),
      },
      escrowTransactionLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          sequence.push(data.transactionType);
          return {};
        }),
      },
      $queryRaw: vi.fn(),
    };
    const prisma = basePrisma({
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    });
    await service(prisma, {}).createCardTopUpIntent("brand-1", 10000, "key");
    expect(sequence).toEqual(["load", "LOAD", "LOAD_FEE"]);
  });

  it("does not attempt provider order when an atomic ledger write fails", async () => {
    const createOrder = vi.fn();
    const tx = {
      escrowFundingLoad: { create: vi.fn().mockResolvedValue(load) },
      escrowTransactionLedger: {
        create: vi.fn().mockRejectedValue(new Error("db failure")),
      },
    };
    const prisma = basePrisma({
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    });
    await expect(
      service(prisma, { createOrder }).createCardTopUpIntent(
        "brand-1",
        10000,
        "key",
      ),
    ).rejects.toThrow("db failure");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("repairs missing canonical ledgers on retry without changing a credited LOAD", async () => {
    const rows = new Map<
      string,
      {
        id: string;
        transactionType: string;
        amount: Decimal;
        currency: string;
        transactionStatus: string;
      }
    >();
    rows.set("load:key", {
      id: "ledger-load",
      transactionType: "LOAD",
      amount: new Decimal(10000),
      currency: "INR",
      transactionStatus: "CREDITED",
    });
    const upsert = vi.fn().mockImplementation(({ where, create }) => {
      const current = rows.get(where.idempotencyKey);
      if (current) return current;
      const created = { id: `ledger-${rows.size}`, ...create };
      rows.set(where.idempotencyKey, created);
      return created;
    });
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: { findUniqueOrThrow: vi.fn().mockResolvedValue(load) },
      escrowTransactionLedger: { upsert },
    };
    const prisma = basePrisma({
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(load) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    });
    await service(prisma).createCardTopUpIntent("brand-1", 10000, "key");
    await service(prisma).createCardTopUpIntent("brand-1", 10000, "key");
    expect(rows.get("load:key")?.transactionStatus).toBe("CREDITED");
    expect(rows.get("load-fee:key")?.transactionType).toBe("LOAD_FEE");
    expect(rows.size).toBe(2);
  });

  it("concurrent retry repair converges through unique ledger idempotency keys", async () => {
    const keys = new Set<string>();
    const upsert = vi.fn().mockImplementation(({ where, create }) => {
      keys.add(where.idempotencyKey);
      return { id: where.idempotencyKey, ...create };
    });
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: { findUniqueOrThrow: vi.fn().mockResolvedValue(load) },
      escrowTransactionLedger: { upsert },
    };
    const prisma = basePrisma({
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(load) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    });
    await Promise.all([
      service(prisma).createCardTopUpIntent("brand-1", 10000, "key"),
      service(prisma).createCardTopUpIntent("brand-1", 10000, "key"),
    ]);
    expect([...keys].sort()).toEqual(["load-fee:key", "load:key"]);
  });
});

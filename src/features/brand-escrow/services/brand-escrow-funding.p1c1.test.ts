import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { BrandEscrowService } from "./brand-escrow.service";
import { BrandEscrowWebhookService } from "./brand-escrow-webhook.service";

const baseVault = {
  id: "vault-1",
  brandProfileId: "brand-1",
  currency: "INR",
  razorpayVirtualAccountId: null,
  virtualAccountNumber: null,
  ifscCode: null,
  upiVpa: null,
  bankName: null,
  virtualAccountEnabled: false,
};

function escrow(prisma: object, razorpay: object, capability = "false") {
  return new BrandEscrowService(
    prisma as never,
    razorpay as never,
    {} as never,
    {} as never,
    { assertCapability: vi.fn() } as never,
    { get: vi.fn().mockReturnValue(capability) } as never,
  );
}

describe("BS09 P1C1 provider truth and recovery", () => {
  it("automatically provisions an enabled INR VA and persists only provider facts", async () => {
    let stored = { ...baseVault };
    const createVirtualAccount = vi.fn().mockResolvedValue({
      id: "va-1",
      receivers: [
        { entity: "bank_account", account_number: "acct", ifsc: "IFSC" },
      ],
    });
    const tx = {
      $queryRaw: vi.fn(),
      brandEscrowVault: {
        findUniqueOrThrow: vi.fn().mockImplementation(() => stored),
        update: vi
          .fn()
          .mockImplementation(({ data }) => (stored = { ...stored, ...data })),
      },
    };
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "brand-1",
          name: "Brand",
          countryCode: "IN",
        }),
      },
      brandEscrowVault: { upsert: vi.fn().mockResolvedValue(stored) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const service = escrow(prisma, { createVirtualAccount }, "true");
    const first = await service.ensureVault("brand-1");
    const second = await service.ensureVault("brand-1");
    expect(createVirtualAccount).toHaveBeenCalledTimes(1);
    expect(first.razorpayVirtualAccountId).toBe("va-1");
    expect(second.razorpayVirtualAccountId).toBe("va-1");
    expect(first.upiVpa).toBeNull();
    expect(first.bankName).toBeNull();
  });

  it.each([
    ["US", "true"],
    ["IN", "false"],
  ])(
    "does not provision VA for country %s with capability %s",
    async (country, capability) => {
      const createVirtualAccount = vi.fn();
      const prisma = {
        brandProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: "brand-1",
            name: "Brand",
            countryCode: country,
          }),
        },
        brandEscrowVault: {
          upsert: vi.fn().mockResolvedValue({
            ...baseVault,
            currency: country === "IN" ? "INR" : "USD",
          }),
        },
      };
      await escrow(prisma, { createVirtualAccount }, capability).ensureVault(
        "brand-1",
      );
      expect(createVirtualAccount).not.toHaveBeenCalled();
    },
  );

  it("recovers and validates a missing provider order by exact receipt", async () => {
    const load = {
      id: "load-1",
      vaultId: "vault-1",
      providerOrderId: null,
      idempotencyKey: "key",
      currency: "INR",
      principalAmount: new Decimal(10000),
      processingFee: new Decimal(200),
      processingFeeTax: new Decimal(36),
    };
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(load),
        update: vi
          .fn()
          .mockImplementation(({ data }) => ({ ...load, ...data })),
      },
    };
    const prisma = {
      brandProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "brand-1", countryCode: "IN" }),
      },
      brandEscrowVault: { upsert: vi.fn().mockResolvedValue(baseVault) },
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(load) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const findOrderByReceipt = vi.fn().mockResolvedValue({
      id: "order-1",
      receipt: "load-1",
      currency: "INR",
      amount: 1023600,
    });
    const createOrder = vi.fn();
    const result = await escrow(prisma, {
      findOrderByReceipt,
      createOrder,
    }).createCardTopUpIntent("brand-1", 10000, "key");
    expect(result.checkout_order_id).toBe("order-1");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("reconciles an ambiguous create response before failing", async () => {
    const load = {
      id: "load-1",
      vaultId: "vault-1",
      providerOrderId: null,
      idempotencyKey: "key",
      currency: "INR",
      principalAmount: new Decimal(5000),
      processingFee: new Decimal(100),
      processingFeeTax: new Decimal(18),
    };
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(load),
        update: vi
          .fn()
          .mockImplementation(({ data }) => ({ ...load, ...data })),
      },
    };
    const prisma = {
      brandProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "brand-1", countryCode: "IN" }),
      },
      brandEscrowVault: { upsert: vi.fn().mockResolvedValue(baseVault) },
      escrowFundingLoad: { findUnique: vi.fn().mockResolvedValue(load) },
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const findOrderByReceipt = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "order-1",
        receipt: "load-1",
        currency: "INR",
        amount: 511800,
      });
    const result = await escrow(prisma, {
      findOrderByReceipt,
      createOrder: vi.fn().mockRejectedValue(new Error("timeout")),
    }).createCardTopUpIntent("brand-1", 5000, "key");
    expect(result.checkout_order_id).toBe("order-1");
    expect(findOrderByReceipt).toHaveBeenCalledTimes(2);
  });

  it("leaves failed payment attempts pending, then credits and enriches exactly once", async () => {
    let load = {
      id: "load-1",
      vaultId: "vault-1",
      providerOrderId: "order-1",
      providerPaymentId: null,
      sourceReference: null,
      idempotencyKey: "key",
      state: "PENDING",
      currency: "INR",
      principalAmount: new Decimal(10000),
      processingFee: new Decimal(200),
      processingFeeTax: new Decimal(36),
    };
    let credits = 0;
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: {
        findUnique: vi.fn().mockImplementation(() => load),
        update: vi
          .fn()
          .mockImplementation(({ data }) => (load = { ...load, ...data })),
      },
      escrowTransactionLedger: {
        upsert: vi.fn().mockImplementation(({ create }) => ({
          id: create.transactionType === "LOAD" ? "ledger-load" : "ledger-fee",
          transactionStatus: "PENDING",
        })),
        update: vi.fn(),
      },
      brandEscrowVault: {
        update: vi.fn().mockImplementation(() => {
          credits += 1;
        }),
      },
    };
    const prisma = {
      $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
    };
    const service = new BrandEscrowWebhookService(
      prisma as never,
      {} as never,
      {} as never,
      { enqueueWithinTransaction: vi.fn() } as never,
      { recordFundingCredit: vi.fn() } as never,
    );
    await service.handleWebhook({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay-failed", order_id: "order-1" } },
      },
    });
    expect(load.state).toBe("PENDING");
    expect(load.providerPaymentId).toBeNull();
    const captured = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay-success", order_id: "order-1", captured: true },
        },
      },
    };
    await service.handleWebhook(captured);
    await service.handleWebhook(captured);
    expect(load.state).toBe("CREDITED");
    expect(load.providerPaymentId).toBe("pay-success");
    expect(credits).toBe(1);
  });

  it("order.paid credits once and later captured payment enriches provenance only", async () => {
    let load = {
      id: "load-1",
      vaultId: "vault-1",
      providerOrderId: "order-1",
      providerPaymentId: null,
      sourceReference: null,
      idempotencyKey: "key",
      state: "PENDING",
      currency: "INR",
      principalAmount: new Decimal(5000),
      processingFee: new Decimal(100),
      processingFeeTax: new Decimal(18),
    };
    let credits = 0;
    const tx = {
      $queryRaw: vi.fn(),
      escrowFundingLoad: {
        findUnique: vi.fn().mockImplementation(() => load),
        update: vi
          .fn()
          .mockImplementation(({ data }) => (load = { ...load, ...data })),
      },
      escrowTransactionLedger: {
        upsert: vi.fn().mockImplementation(({ create }) => ({
          id: create.transactionType === "LOAD" ? "ledger-load" : "ledger-fee",
          transactionStatus: "PENDING",
        })),
        update: vi.fn(),
      },
      brandEscrowVault: {
        update: vi.fn().mockImplementation(() => {
          credits += 1;
        }),
      },
    };
    const service = new BrandEscrowWebhookService(
      {
        $transaction: (callback: (value: typeof tx) => unknown) => callback(tx),
      } as never,
      {} as never,
      {} as never,
      { enqueueWithinTransaction: vi.fn() } as never,
      { recordFundingCredit: vi.fn() } as never,
    );
    await service.handleWebhook({
      event: "order.paid",
      payload: { order: { entity: { id: "order-1", receipt: "load-1" } } },
    });
    await service.handleWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay-1", order_id: "order-1", captured: true },
        },
      },
    });
    expect(credits).toBe(1);
    expect(load.providerPaymentId).toBe("pay-1");
  });
});

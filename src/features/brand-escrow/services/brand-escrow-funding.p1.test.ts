import { BadRequestException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";
import { BrandEscrowService } from "./brand-escrow.service";
import { extractBankReceiver, extractVpaReceiver } from "./razorpay.client";
import { resolveEscrowCurrency } from "../utils/resolve-escrow-currency.util";

function service(
  prisma: Record<string, unknown>,
  razorpay: Record<string, unknown> = {},
) {
  return new BrandEscrowService(
    prisma as never,
    razorpay as never,
    {} as never,
    {} as never,
    { assertCapability: vi.fn().mockResolvedValue(undefined) } as never,
    { get: vi.fn().mockReturnValue("false") } as never,
  );
}

const vault = {
  id: "vault-1",
  brandProfileId: "brand-1",
  currency: "INR",
  razorpayVirtualAccountId: null,
  virtualAccountNumber: null,
  ifscCode: null,
  upiVpa: null,
  bankName: null,
  virtualAccountEnabled: false,
  totalPooledBalance: new Decimal(0),
  lockedCampaignFunds: new Decimal(0),
  availableBalance: new Decimal(0),
  tdsBufferBalance: new Decimal(0),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("BS09 P1 treasury funding foundation", () => {
  it("routes canonical Brand geography without consulting billing or domain", () => {
    expect(
      resolveEscrowCurrency({
        countryCode: "IN",
        currencyCode: "USD",
        domain: "brand.com",
      } as never),
    ).toBe("INR");
    expect(
      resolveEscrowCurrency({
        countryCode: "US",
        currencyCode: "INR",
        domain: "brand.in",
      } as never),
    ).toBe("USD");
  });

  it("does not fabricate absent provider receiver data", () => {
    expect(extractBankReceiver(undefined)).toBeNull();
    expect(
      extractVpaReceiver([{ entity: "bank_account", account_number: "1" }]),
    ).toBeNull();
  });

  it("lazily and idempotently provisions one gateway-only vault", async () => {
    const upsert = vi.fn().mockResolvedValue(vault);
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "brand-1",
          name: "Brand",
          countryCode: "US",
        }),
      },
      brandEscrowVault: { upsert },
    };
    const escrow = service(prisma);
    await escrow.ensureVault("brand-1");
    await escrow.ensureVault("brand-1");
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].create.currency).toBe("USD");
    expect(upsert.mock.calls[0][0].create).not.toHaveProperty(
      "razorpayVirtualAccountId",
    );
  });

  it("rejects INR principal below 5000 before provider or funding side effects", async () => {
    const createOrder = vi.fn();
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "brand-1",
          name: "Brand",
          countryCode: "IN",
        }),
      },
      brandEscrowVault: { upsert: vi.fn().mockResolvedValue(vault) },
      escrowFundingLoad: { findUnique: vi.fn(), create: vi.fn() },
    };
    await expect(
      service(prisma, { createOrder }).createCardTopUpIntent(
        "brand-1",
        4999,
        "key",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.escrowFundingLoad.create).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("keeps 10000 principal separate from 200 fee and 36 GST without crediting the vault", async () => {
    const load = {
      id: "load-1",
      providerOrderId: null,
      principalAmount: new Decimal(10000),
      processingFee: new Decimal(200),
      processingFeeTax: new Decimal(36),
    };
    const update = vi
      .fn()
      .mockResolvedValue({ ...load, providerOrderId: "order-1" });
    const vaultUpdate = vi.fn();
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: "brand-1",
          name: "Brand",
          countryCode: "IN",
        }),
      },
      brandEscrowVault: {
        upsert: vi.fn().mockResolvedValue(vault),
        update: vaultUpdate,
      },
      escrowFundingLoad: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(load),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...load,
          vaultId: "vault-1",
          currency: "INR",
          idempotencyKey: "key",
        }),
        update,
      },
      escrowTransactionLedger: { create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn(),
    };
    Object.assign(prisma, {
      $transaction: async (callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
    });
    const result = await service(prisma, {
      findOrderByReceipt: vi.fn().mockResolvedValue(null),
      createOrder: vi.fn().mockResolvedValue({
        id: "order-1",
        receipt: "load-1",
        currency: "INR",
        amount: 1023600,
      }),
    }).createCardTopUpIntent("brand-1", 10000, "key");
    expect(result).toMatchObject({
      allocation_amount: 10000,
      gateway_surcharge: 200,
      surcharge_gst: 36,
      total_invoice_charge_amount: 10236,
    });
    expect(prisma.escrowTransactionLedger.create).toHaveBeenCalledTimes(2);
    expect(vaultUpdate).not.toHaveBeenCalled();
  });
});

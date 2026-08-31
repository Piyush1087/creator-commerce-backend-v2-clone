import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { BrandEscrowWebhookService } from "./brand-escrow-webhook.service";

function harness() {
  let load = {
    id: "load-1",
    vaultId: "vault-1",
    brandProfileId: "brand-1",
    sourceType: "GATEWAY",
    providerOrderId: "order-1",
    providerPaymentId: null as string | null,
    sourceReference: null as string | null,
    idempotencyKey: "request-1",
    state: "PENDING",
    currency: "INR",
    principalAmount: new Decimal(5000),
    processingFee: new Decimal(100),
    processingFeeTax: new Decimal(18),
    creditedPrincipal: null as Decimal | null,
    capturedAmount: null as Decimal | null,
    paymentCurrency: null as string | null,
    paymentCaptured: null as boolean | null,
    provenanceStatus: "SOURCE_UNRESOLVED",
    creditedAt: null as Date | null,
  };
  const recordFundingCredit = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    escrowFundingLoad: {
      findUnique: vi.fn().mockImplementation(() => load),
      update: vi.fn().mockImplementation(({ data }) => {
        load = { ...load, ...data } as typeof load;
        return load;
      }),
    },
    escrowTransactionLedger: {
      upsert: vi.fn().mockImplementation(({ create }) => ({
        id: create.transactionType,
        transactionStatus: "PENDING",
      })),
      update: vi.fn(),
    },
    brandEscrowVault: { update: vi.fn() },
  };
  const service = new BrandEscrowWebhookService(
    {
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    } as never,
    {} as never,
    {} as never,
    { enqueueWithinTransaction: vi.fn() } as never,
    { recordFundingCredit } as never,
  );
  return { service, recordFundingCredit, getLoad: () => load };
}

describe("BS04 prospective Gateway funding evidence", () => {
  it("marks exact captured Payment evidence as a proven source", async () => {
    const { service, recordFundingCredit, getLoad } = harness();
    await service.handleWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay-1",
            order_id: "order-1",
            amount: 511800,
            currency: "INR",
            captured: true,
          },
        },
      },
    });

    expect(getLoad().providerPaymentId).toBe("pay-1");
    expect(recordFundingCredit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerPaymentId: "pay-1",
        provenanceStatus: "PROVEN_SOURCE",
        creditedPrincipal: new Decimal(5000),
        capturedAmount: new Decimal(5118),
      }),
    );
  });

  it("credits legitimate order truth but keeps missing Payment identity unresolved", async () => {
    const { service, recordFundingCredit } = harness();
    await service.handleWebhook({
      event: "order.paid",
      payload: {
        order: { entity: { id: "order-1", receipt: "load-1" } },
      },
    });
    expect(recordFundingCredit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerPaymentId: undefined,
        provenanceStatus: "SOURCE_UNRESOLVED",
      }),
    );
  });

  it("does not mark mismatched amount or currency as returnable", async () => {
    const { service, recordFundingCredit } = harness();
    await service.handleWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay-1",
            order_id: "order-1",
            amount: 500000,
            currency: "USD",
            captured: true,
          },
        },
      },
    });
    expect(recordFundingCredit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provenanceStatus: "SOURCE_UNRESOLVED" }),
    );
  });

  it("upgrades an unresolved order credit when a later exact captured Payment proves provenance", async () => {
    const { service, recordFundingCredit, getLoad } = harness();
    await service.handleWebhook({
      event: "order.paid",
      payload: {
        order: { entity: { id: "order-1", receipt: "load-1" } },
      },
    });
    await service.handleWebhook({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay-1",
            order_id: "order-1",
            amount: 511800,
            currency: "INR",
            captured: true,
          },
        },
      },
    });

    expect(getLoad().provenanceStatus).toBe("PROVEN_SOURCE");
    expect(recordFundingCredit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerPaymentId: "pay-1",
        provenanceStatus: "PROVEN_SOURCE",
      }),
    );
  });
});

import {
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
  type BrandSubscription,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PricingWebhookService } from "./pricing-webhook.service";

function subscription(): BrandSubscription {
  return {
    id: "row-1",
    brandProfileId: "brand-1",
    tier: SubscriptionTier.FOUNDERS_BETA,
    status: SubscriptionStatus.ACTIVE,
    currency: SubscriptionCurrency.USD,
    razorpayCustomerId: null,
    razorpaySubscriptionId: "provider-current",
    razorpayPlanId: "plan-founders",
    providerStatus: "active",
    trialEndsAt: null,
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelScheduledAt: null,
    cancelEffectiveAt: null,
    firstPaymentFailureAt: null,
    paymentGraceEndsAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function harness(overrides: Partial<BrandSubscription> = {}) {
  let row = { ...subscription(), ...overrides };
  const prisma = {
    brandSubscription: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where.razorpaySubscriptionId === row.razorpaySubscriptionId
              ? row
              : null,
          ),
        ),
      update: vi.fn().mockImplementation(({ data }) => {
        row = { ...row, ...data };
        return Promise.resolve(row);
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    brandProfile: { update: vi.fn().mockResolvedValue({}) },
    featureUsage: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const invoices = {
    upsertFromRazorpayInvoiceId: vi.fn().mockResolvedValue({}),
  };
  const razorpay = {
    fetchSubscription: vi.fn().mockResolvedValue({
      id: "provider-current",
      status: "active",
      plan_id: "plan-founders",
      current_start: 1_777_593_600,
      current_end: 1_780_185_600,
      notes: { target_tier: "FOUNDERS_BETA" },
    }),
  };
  const service = new PricingWebhookService(
    prisma as never,
    {} as never,
    invoices as never,
    razorpay as never,
    {
      resolveTierForPlanId: vi
        .fn()
        .mockReturnValue(SubscriptionTier.FOUNDERS_BETA),
    } as never,
  );
  return { service, prisma, invoices, getRow: () => row };
}

const failurePayload = (
  createdAt: number,
  providerId = "provider-current",
) => ({
  event: "payment.failed",
  payload: {
    subscription: { entity: { id: providerId } },
    payment: { entity: { id: "payment-1", created_at: createdAt } },
  },
});

describe("PricingWebhookService P2 reconciliation", () => {
  it("does not mark an authenticated checkout ACTIVE before payment", async () => {
    const h = harness({
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    await h.service.handleWebhook({
      event: "subscription.authenticated",
      payload: { subscription: { entity: { id: "provider-current" } } },
    });
    expect(h.getRow().status).toBe(SubscriptionStatus.TRIALING);
    expect(h.prisma.brandSubscription.update).not.toHaveBeenCalled();
  });

  it("starts one exact seven-day grace and duplicate failure does not extend it", async () => {
    const h = harness();
    await h.service.handleWebhook(failurePayload(1_777_593_600));
    const firstFailure = h.getRow().firstPaymentFailureAt;
    const graceEnd = h.getRow().paymentGraceEndsAt;
    expect(h.getRow().status).toBe(SubscriptionStatus.PAST_DUE);
    expect(graceEnd?.getTime()).toBe(
      firstFailure!.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    await h.service.handleWebhook(failurePayload(1_777_680_000));
    expect(h.getRow().firstPaymentFailureAt).toEqual(firstFailure);
    expect(h.getRow().paymentGraceEndsAt).toEqual(graceEnd);
  });

  it("provider halted inside grace retains Product PAST_DUE window", async () => {
    const h = harness();
    await h.service.handleWebhook(failurePayload(1_777_593_600));
    const graceEnd = h.getRow().paymentGraceEndsAt;
    await h.service.handleWebhook({
      event: "subscription.halted",
      payload: { subscription: { entity: { id: "provider-current" } } },
    });
    expect(h.getRow()).toMatchObject({
      status: SubscriptionStatus.PAST_DUE,
      providerStatus: "halted",
      paymentGraceEndsAt: graceEnd,
    });
  });

  it("trustworthy provider success marks ACTIVE and clears grace", async () => {
    const h = harness();
    await h.service.handleWebhook(failurePayload(1_777_593_600));
    await h.service.handleWebhook({
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: "provider-current",
            status: "active",
            plan_id: "plan-founders",
            current_start: 1_777_593_600,
            current_end: 1_780_185_600,
            notes: { target_tier: "FOUNDERS_BETA" },
          },
        },
      },
    });
    expect(h.getRow()).toMatchObject({
      tier: SubscriptionTier.FOUNDERS_BETA,
      status: SubscriptionStatus.ACTIVE,
      firstPaymentFailureAt: null,
      paymentGraceEndsAt: null,
      trialEndsAt: null,
    });
  });

  it("ignores delayed webhook from a replaced provider subscription", async () => {
    const h = harness();
    await h.service.handleWebhook(
      failurePayload(1_777_593_600, "provider-old"),
    );
    expect(h.prisma.brandSubscription.update).not.toHaveBeenCalled();
    expect(h.getRow().status).toBe(SubscriptionStatus.ACTIVE);
  });

  it("invoice paid preserves invoice snapshot upsert", async () => {
    const h = harness();
    await h.service.handleWebhook({
      event: "invoice.paid",
      payload: {
        invoice: {
          entity: { id: "invoice-1", subscription_id: "provider-current" },
        },
        payment: { entity: { id: "payment-1" } },
      },
    });
    expect(h.invoices.upsertFromRazorpayInvoiceId).toHaveBeenCalledWith(
      "brand-1",
      "row-1",
      "provider-current",
      "invoice-1",
      "payment-1",
      SubscriptionCurrency.USD,
    );
  });
});

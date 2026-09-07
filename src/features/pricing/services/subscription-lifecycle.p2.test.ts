import { BadRequestException } from "@nestjs/common";
import {
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
  type BrandSubscription,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { GeoRoutingService } from "./geo-routing.service";
import { SubscriptionAccessService } from "./subscription-access.service";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

function baseSubscription(
  overrides: Partial<BrandSubscription> = {},
): BrandSubscription {
  return {
    id: "sub-row",
    brandProfileId: "brand-1",
    tier: SubscriptionTier.FOUNDERS_BETA,
    status: SubscriptionStatus.TRIALING,
    currency: SubscriptionCurrency.USD,
    razorpayCustomerId: null,
    razorpaySubscriptionId: null,
    razorpayPlanId: null,
    providerStatus: null,
    trialEndsAt: new Date(Date.now() + 86_400_000),
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelScheduledAt: null,
    cancelEffectiveAt: null,
    providerCancellationState: null,
    continuationRazorpaySubscriptionId: null,
    continuationRazorpayPlanId: null,
    continuationProviderStatus: null,
    continuationStartsAt: null,
    firstPaymentFailureAt: null,
    paymentGraceEndsAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function harness(input?: {
  countryCode?: string;
  subscription?: BrandSubscription;
  billingError?: Error;
}) {
  let row = input?.subscription ?? baseSubscription();
  const prisma = {
    brandProfile: {
      findUnique: vi.fn().mockResolvedValue({
        countryCode: input?.countryCode ?? "US",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    brandSubscription: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(row)),
      findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve(row)),
      update: vi.fn().mockImplementation(({ data }) => {
        row = { ...row, ...data };
        return Promise.resolve({ ...row, featureUsages: [] });
      }),
      updateMany: vi.fn().mockImplementation(({ data }) => {
        row = { ...row, ...data };
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const billing = {
    requireCompleteBillingProfile: input?.billingError
      ? vi.fn().mockRejectedValue(input.billingError)
      : vi.fn().mockResolvedValue({ is_complete_for_paid_conversion: true }),
  };
  const razorpay = {
    createImmediateSubscription: vi.fn().mockResolvedValue({
      id: "provider-new",
      status: "created",
    }),
    cancelSubscription: vi.fn().mockResolvedValue({}),
    fetchSubscription: vi.fn().mockResolvedValue({ status: "active" }),
    createFutureSubscription: vi.fn().mockResolvedValue({
      id: "provider-continuation",
      status: "created",
    }),
    listSubscriptionInvoices: vi.fn().mockResolvedValue([]),
  };
  const plans = {
    resolvePlanId: vi.fn().mockResolvedValue("plan-founders"),
  };
  const service = new SubscriptionLifecycleService(
    prisma as never,
    { get: vi.fn().mockReturnValue("rzp-key") } as never,
    new GeoRoutingService(),
    razorpay as never,
    plans as never,
    new SubscriptionAccessService(),
    billing as never,
  );
  return { service, prisma, billing, razorpay, plans, getRow: () => row };
}

describe("SubscriptionLifecycleService P2", () => {
  it("blocks incomplete Billing before provider or local side effects", async () => {
    const h = harness({ billingError: new BadRequestException("incomplete") });
    await expect(h.service.startPaidConversion("brand-1")).rejects.toThrow(
      "incomplete",
    );
    expect(h.razorpay.createImmediateSubscription).not.toHaveBeenCalled();
    expect(h.prisma.brandSubscription.update).not.toHaveBeenCalled();
  });

  it.each([
    ["IN", "INR"],
    ["US", "USD"],
    ["GB", "USD"],
  ] as const)(
    "starts Founder's checkout for %s using %s without marking ACTIVE",
    async (countryCode, currency) => {
      const h = harness({
        countryCode,
        subscription: baseSubscription({
          currency:
            currency === "INR"
              ? SubscriptionCurrency.USD
              : SubscriptionCurrency.INR,
        }),
      });
      const result = await h.service.startPaidConversion("brand-1");
      expect(h.plans.resolvePlanId).toHaveBeenCalledWith(
        SubscriptionTier.FOUNDERS_BETA,
        currency,
      );
      expect(h.getRow()).toMatchObject({
        tier: SubscriptionTier.FOUNDERS_BETA,
        currency,
        status: SubscriptionStatus.TRIALING,
        razorpaySubscriptionId: "provider-new",
      });
      expect(result.checkout.targetTier).toBe(SubscriptionTier.FOUNDERS_BETA);
    },
  );

  it("schedules provider cancellation at cycle end before confirming Product cancellation", async () => {
    const currentPeriodEnd = new Date(Date.now() + 30 * 86_400_000);
    const h = harness({
      subscription: baseSubscription({
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd,
        razorpaySubscriptionId: "provider-current",
      }),
    });
    const result = await h.service.cancelSubscription("brand-1");
    expect(result).toMatchObject({
      lifecycleStatus: "CANCEL_SCHEDULED",
      accessMode: "FULL_ACCESS",
      cancelEffectiveAt: currentPeriodEnd,
    });
    expect(h.razorpay.cancelSubscription).toHaveBeenCalledWith(
      "provider-current",
      true,
    );
    expect(h.getRow()).toMatchObject({
      status: SubscriptionStatus.CANCEL_SCHEDULED,
      providerCancellationState: "SCHEDULED",
    });
  });

  it("keeps unresolved intent ACTIVE when provider scheduling fails", async () => {
    const h = harness({
      subscription: baseSubscription({
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        razorpaySubscriptionId: "provider-current",
      }),
    });
    h.razorpay.cancelSubscription.mockRejectedValueOnce(new Error("timeout"));
    await expect(h.service.cancelSubscription("brand-1")).rejects.toThrow(
      "timeout",
    );
    expect(h.getRow()).toMatchObject({
      status: SubscriptionStatus.ACTIVE,
      providerCancellationState: "SCHEDULE_PENDING",
    });
  });

  it("rejects cancellation for a pure trial", async () => {
    const h = harness();
    await expect(h.service.cancelSubscription("brand-1")).rejects.toThrow(
      "Only an active paid subscription",
    );
  });

  it("does not treat provider active status as proof an ambiguous cancellation is reversible", async () => {
    const h = harness({
      subscription: baseSubscription({
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        razorpaySubscriptionId: "provider-current",
        providerCancellationState: "SCHEDULE_PENDING",
        cancelEffectiveAt: new Date(Date.now() + 86_400_000),
      }),
    });
    await expect(h.service.reactivateSubscription("brand-1")).rejects.toThrow(
      "Cancellation reconciliation is still pending",
    );
    expect(h.getRow()).toMatchObject({
      status: SubscriptionStatus.ACTIVE,
      providerCancellationState: "SCHEDULE_PENDING",
      cancelEffectiveAt: expect.any(Date),
    });
    expect(h.razorpay.fetchSubscription).not.toHaveBeenCalled();
    expect(h.razorpay.createFutureSubscription).not.toHaveBeenCalled();
  });

  it("starts provider recovery for HALTED without fabricating ACTIVE", async () => {
    const h = harness({
      subscription: baseSubscription({
        status: SubscriptionStatus.HALTED,
        trialEndsAt: null,
        firstPaymentFailureAt: new Date("2026-08-01T00:00:00.000Z"),
        paymentGraceEndsAt: new Date("2026-08-08T00:00:00.000Z"),
      }),
    });
    await h.service.reactivateSubscription("brand-1");
    expect(h.razorpay.createImmediateSubscription).toHaveBeenCalledOnce();
    expect(h.getRow().status).toBe(SubscriptionStatus.HALTED);
  });

  it("creates a future Founder's continuation without clearing scheduled cancellation", async () => {
    const currentPeriodEnd = new Date(Date.now() + 86_400_000);
    const h = harness({
      countryCode: "IN",
      subscription: baseSubscription({
        status: SubscriptionStatus.CANCEL_SCHEDULED,
        trialEndsAt: null,
        providerCancellationState: "SCHEDULED",
        razorpaySubscriptionId: "provider-current",
        cancelEffectiveAt: currentPeriodEnd,
        currentPeriodEnd,
      }),
    });
    const result = await h.service.reactivateSubscription("brand-1");
    expect(h.billing.requireCompleteBillingProfile).toHaveBeenCalledWith(
      "brand-1",
    );
    expect(h.plans.resolvePlanId).toHaveBeenCalledWith(
      SubscriptionTier.FOUNDERS_BETA,
      "INR",
    );
    expect(h.razorpay.createFutureSubscription).toHaveBeenCalledWith(
      "plan-founders",
      Math.floor(currentPeriodEnd.getTime() / 1000),
      expect.objectContaining({ target_tier: SubscriptionTier.FOUNDERS_BETA }),
    );
    expect(h.razorpay.createImmediateSubscription).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      recovery_mode: "continuation_authorization",
      subscription: {
        lifecycleStatus: "CANCEL_SCHEDULED",
        accessMode: "FULL_ACCESS",
      },
    });
    expect(h.getRow()).toMatchObject({
      status: SubscriptionStatus.CANCEL_SCHEDULED,
      currency: SubscriptionCurrency.INR,
      continuationRazorpaySubscriptionId: "provider-continuation",
      continuationStartsAt: currentPeriodEnd,
    });
  });

  it("requires complete Billing before creating a cancellation continuation", async () => {
    const currentPeriodEnd = new Date(Date.now() + 86_400_000);
    const h = harness({
      billingError: new BadRequestException("incomplete"),
      subscription: baseSubscription({
        status: SubscriptionStatus.CANCEL_SCHEDULED,
        trialEndsAt: null,
        providerCancellationState: "SCHEDULED",
        razorpaySubscriptionId: "provider-current",
        cancelEffectiveAt: currentPeriodEnd,
        currentPeriodEnd,
      }),
    });
    await expect(h.service.reactivateSubscription("brand-1")).rejects.toThrow(
      "incomplete",
    );
    expect(h.razorpay.createFutureSubscription).not.toHaveBeenCalled();
    expect(h.getRow().status).toBe(SubscriptionStatus.CANCEL_SCHEDULED);
  });
});

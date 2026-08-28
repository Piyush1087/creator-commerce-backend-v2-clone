import {
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
  type BrandSubscription,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { SubscriptionAccessService } from "./subscription-access.service";

const NOW = new Date("2026-08-28T12:00:00.000Z");

function subscription(
  overrides: Partial<BrandSubscription> = {},
): BrandSubscription {
  return {
    id: "subscription-1",
    brandProfileId: "brand-1",
    tier: SubscriptionTier.FOUNDERS_BETA,
    status: SubscriptionStatus.TRIALING,
    currency: SubscriptionCurrency.USD,
    razorpayCustomerId: null,
    razorpaySubscriptionId: null,
    razorpayPlanId: null,
    providerStatus: null,
    trialEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    cancelScheduledAt: null,
    cancelEffectiveAt: null,
    firstPaymentFailureAt: null,
    paymentGraceEndsAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("SubscriptionAccessService", () => {
  const service = new SubscriptionAccessService();

  it("separates lifecycle status from access mode", () => {
    expect(service.derive(subscription(), NOW)).toEqual({
      lifecycleStatus: "TRIALING",
      accessMode: "FULL_ACCESS",
      requiredAction: "NONE",
    });
  });

  it("represents trial expiry as payment-required rather than past-due", () => {
    expect(
      service.derive(
        subscription({ trialEndsAt: new Date("2026-08-27T00:00:00.000Z") }),
        NOW,
      ),
    ).toEqual({
      lifecycleStatus: "TRIAL_EXPIRED",
      accessMode: "RESTRICTED_WIND_DOWN",
      requiredAction: "PAYMENT_REQUIRED",
    });
  });

  it("uses cancellation effective metadata for wind-down access", () => {
    const scheduled = subscription({
      status: SubscriptionStatus.CANCEL_SCHEDULED,
      cancelScheduledAt: new Date("2026-08-20T00:00:00.000Z"),
      cancelEffectiveAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(service.derive(scheduled, NOW).accessMode).toBe("FULL_ACCESS");
    expect(
      service.derive(
        {
          ...scheduled,
          cancelEffectiveAt: new Date("2026-08-27T00:00:00.000Z"),
        },
        NOW,
      ).accessMode,
    ).toBe("RESTRICTED_WIND_DOWN");
  });

  it("uses the payment grace deadline independently of provider status", () => {
    const pastDue = subscription({
      status: SubscriptionStatus.PAST_DUE,
      providerStatus: "halted",
      firstPaymentFailureAt: new Date("2026-08-25T00:00:00.000Z"),
      paymentGraceEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(service.derive(pastDue, NOW)).toMatchObject({
      lifecycleStatus: "PAST_DUE",
      accessMode: "FULL_ACCESS",
      requiredAction: "UPDATE_PAYMENT_METHOD",
    });
  });
});

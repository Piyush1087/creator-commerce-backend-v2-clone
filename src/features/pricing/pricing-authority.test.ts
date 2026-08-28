import { describe, expect, it, vi } from "vitest";

import {
  FOUNDERS_BETA_COMMISSION_RATE,
  RAZORPAY_PLAN_DEFINITIONS,
} from "./constants/subscription.constants";
import { GeoRoutingService } from "./services/geo-routing.service";
import { PlanCatalogService } from "./services/plan-catalog.service";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";

describe("BS08 MVP pricing authority", () => {
  const geo = new GeoRoutingService();

  it("publishes Founder's Beta as the only purchasable plan", async () => {
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({ countryCode: "US" }),
      },
    };
    const catalog = new PlanCatalogService(prisma as never, geo);

    const plans = await catalog.getVisiblePlans("brand-1");

    expect(plans.filter((plan) => plan.isPurchasable)).toEqual([
      expect.objectContaining({
        tierKey: "FOUNDERS_BETA",
        availability: "PURCHASABLE",
        trialDays: 30,
      }),
    ]);
    expect(
      plans
        .filter((plan) => plan.tierKey !== "FOUNDERS_BETA")
        .map((plan) => [plan.tierKey, plan.availability, plan.isPurchasable]),
    ).toEqual([
      ["GROWTH_STARTER", "UPCOMING", false],
      ["PROFESSIONAL", "UPCOMING", false],
      ["ENTERPRISE", "UPCOMING", false],
    ]);
  });

  it("uses the frozen minor-unit prices and commission", () => {
    expect(RAZORPAY_PLAN_DEFINITIONS.FOUNDERS_BETA.INR.amountMinor).toBe(
      999_000,
    );
    expect(RAZORPAY_PLAN_DEFINITIONS.FOUNDERS_BETA.USD.amountMinor).toBe(9_900);
    expect(FOUNDERS_BETA_COMMISSION_RATE).toBe(0.07);
  });

  it.each([
    ["IN", "INR"],
    ["US", "USD"],
    ["GB", "USD"],
  ] as const)("routes Brand country %s to %s", (countryCode, currency) => {
    expect(geo.resolveGeoContext(countryCode).currency).toBe(currency);
  });

  it("derives catalogue currency from Brand geography", async () => {
    const prisma = {
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({ countryCode: "IN" }),
      },
    };
    const catalog = new PlanCatalogService(prisma as never, geo);

    const founders = (await catalog.getVisiblePlans("brand-1"))[0];

    expect(founders).toMatchObject({
      currency: "INR",
      amountMinor: 999_000,
      taxInclusive: true,
    });
  });

  it("ignores a legacy client currency argument and starts a local trial", async () => {
    const created = {
      id: "subscription-1",
      tier: "FOUNDERS_BETA",
      status: "TRIALING",
      trialEndsAt: new Date("2026-09-27T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-08-28T00:00:00.000Z"),
    };
    const prisma = {
      brandSubscription: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      brandProfile: {
        findUnique: vi.fn().mockResolvedValue({ countryCode: "IN" }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const razorpay = { createDeferredTrialSubscription: vi.fn() };
    const lifecycle = new SubscriptionLifecycleService(
      prisma as never,
      {} as never,
      geo,
      razorpay as never,
      {} as never,
      {} as never,
    );

    await Reflect.apply(lifecycle.bootstrapLocalTrial, lifecycle, [
      "brand-1",
      "USD",
    ]);

    expect(prisma.brandSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "INR" }),
      }),
    );
    expect(razorpay.createDeferredTrialSubscription).not.toHaveBeenCalled();
  });
});

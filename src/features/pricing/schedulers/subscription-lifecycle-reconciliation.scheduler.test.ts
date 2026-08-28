import { SubscriptionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { SubscriptionLifecycleReconciliationScheduler } from "./subscription-lifecycle-reconciliation.scheduler";

describe("SubscriptionLifecycleReconciliationScheduler", () => {
  it("persists trial expiry, grace expiry, and due cancellation", async () => {
    const prisma = {
      brandSubscription: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: "trial", brandProfileId: "brand-t" }])
          .mockResolvedValueOnce([{ id: "grace", brandProfileId: "brand-g" }])
          .mockResolvedValueOnce([
            {
              id: "pending",
              brandProfileId: "brand-p",
              razorpaySubscriptionId: "provider-pending",
            },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "cancel",
              brandProfileId: "brand-c",
              razorpaySubscriptionId: "provider-current",
            },
          ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      brandProfile: { update: vi.fn().mockResolvedValue({}) },
    };
    const razorpay = {
      cancelSubscription: vi.fn().mockResolvedValue({}),
      fetchSubscription: vi.fn(),
    };
    const scheduler = new SubscriptionLifecycleReconciliationScheduler(
      prisma as never,
      razorpay as never,
    );

    await scheduler.reconcileTemporalStates(
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: SubscriptionStatus.TRIAL_EXPIRED },
      }),
    );
    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: SubscriptionStatus.HALTED } }),
    );
    expect(razorpay.cancelSubscription).toHaveBeenCalledWith(
      "provider-pending",
      true,
    );
    expect(razorpay.cancelSubscription).not.toHaveBeenCalledWith(
      "provider-current",
      false,
    );
    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCEL_SCHEDULED,
          providerCancellationState: "SCHEDULED",
        }),
      }),
    );
    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SubscriptionStatus.CANCELED }),
      }),
    );
  });

  it("does not fabricate cancellation when a due pending provider remains active", async () => {
    const prisma = {
      brandSubscription: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "pending",
              brandProfileId: "brand-p",
              razorpaySubscriptionId: "provider-pending",
            },
          ])
          .mockResolvedValueOnce([]),
        updateMany: vi.fn(),
      },
      brandProfile: { update: vi.fn() },
    };
    const razorpay = {
      cancelSubscription: vi.fn(),
      fetchSubscription: vi.fn().mockResolvedValue({ status: "active" }),
    };
    const scheduler = new SubscriptionLifecycleReconciliationScheduler(
      prisma as never,
      razorpay as never,
    );

    await scheduler.reconcileTemporalStates(
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(razorpay.fetchSubscription).toHaveBeenCalledWith("provider-pending");
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(prisma.brandSubscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.brandProfile.update).not.toHaveBeenCalled();
  });

  it("reconciles trustworthy cancelled evidence for a due pending intent", async () => {
    const prisma = {
      brandSubscription: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "pending",
              brandProfileId: "brand-p",
              razorpaySubscriptionId: "provider-pending",
            },
          ])
          .mockResolvedValueOnce([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      brandProfile: { update: vi.fn().mockResolvedValue({}) },
    };
    const razorpay = {
      cancelSubscription: vi.fn(),
      fetchSubscription: vi.fn().mockResolvedValue({ status: "cancelled" }),
    };
    const scheduler = new SubscriptionLifecycleReconciliationScheduler(
      prisma as never,
      razorpay as never,
    );

    await scheduler.reconcileTemporalStates(
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: SubscriptionStatus.CANCELED,
          providerStatus: "cancelled",
        },
      }),
    );
    expect(prisma.brandProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscriptionStatus: SubscriptionStatus.CANCELED },
      }),
    );
  });
});

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
              id: "cancel",
              brandProfileId: "brand-c",
              razorpaySubscriptionId: "provider-current",
            },
          ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      brandProfile: { update: vi.fn().mockResolvedValue({}) },
    };
    const razorpay = { cancelSubscription: vi.fn().mockResolvedValue({}) };
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
      "provider-current",
      false,
    );
    expect(prisma.brandSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SubscriptionStatus.CANCELED }),
      }),
    );
  });
});

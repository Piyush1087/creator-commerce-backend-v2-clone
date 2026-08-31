import { ForbiddenException } from "@nestjs/common";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { SubscriptionAccessService } from "../../pricing/services/subscription-access.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import { EscrowSubscriptionContextService } from "./escrow-subscription-context.service";

const NOW = new Date("2026-08-28T12:00:00.000Z");

function subscription(
  status: SubscriptionStatus,
  overrides: Record<string, unknown> = {},
) {
  return {
    tier: SubscriptionTier.FOUNDERS_BETA,
    status,
    trialEndsAt: null,
    cancelEffectiveAt: null,
    paymentGraceEndsAt: null,
    ...overrides,
  };
}

function harness(row: ReturnType<typeof subscription> | null) {
  const prisma = {
    brandSubscription: { findUnique: vi.fn().mockResolvedValue(row) },
  };
  const entitlement = {
    getEscrowTakeRate: vi.fn().mockReturnValue(0.05),
    getEscrowAggregateCap: vi.fn().mockReturnValue(500_000),
  };
  return {
    capability: new SubscriptionCapabilityService(
      prisma as never,
      new SubscriptionAccessService(),
    ),
    context: new EscrowSubscriptionContextService(
      prisma as never,
      entitlement as never,
    ),
  };
}

describe("EscrowSubscriptionContextService temporal authority consistency", () => {
  it.each([
    [SubscriptionStatus.TRIALING, { trialEndsAt: new Date("2026-09-01") }],
    [SubscriptionStatus.ACTIVE, {}],
    [
      SubscriptionStatus.CANCEL_SCHEDULED,
      { cancelEffectiveAt: new Date("2026-09-01") },
    ],
    [
      SubscriptionStatus.PAST_DUE,
      { paymentGraceEndsAt: new Date("2026-09-01") },
    ],
  ])(
    "resolves economic context after canonical capability allows %s",
    async (status, overrides) => {
      const h = harness(subscription(status as SubscriptionStatus, overrides));
      await expect(
        h.capability.getCapabilityDecision("brand-1", "ESCROW_RESERVE", NOW),
      ).resolves.toMatchObject({ allowed: true, access_mode: "FULL_ACCESS" });
      await expect(
        h.context.assertEscrowBillingAuthorized("brand-1"),
      ).resolves.toEqual({
        tier: SubscriptionTier.FOUNDERS_BETA,
        platformTakeRate: 0.05,
        aggregateCap: 500_000,
      });
    },
  );

  it.each([
    [SubscriptionStatus.TRIAL_EXPIRED, {}],
    [SubscriptionStatus.CANCELED, {}],
    [SubscriptionStatus.HALTED, {}],
    [
      SubscriptionStatus.CANCEL_SCHEDULED,
      { cancelEffectiveAt: new Date("2026-08-27") },
    ],
    [
      SubscriptionStatus.PAST_DUE,
      { paymentGraceEndsAt: new Date("2026-08-27") },
    ],
  ])("canonical capability denies restricted %s", async (status, overrides) => {
    const h = harness(subscription(status as SubscriptionStatus, overrides));
    await expect(
      h.capability.getCapabilityDecision("brand-1", "ESCROW_RESERVE", NOW),
    ).resolves.toMatchObject({
      allowed: false,
      access_mode: "RESTRICTED_WIND_DOWN",
    });
  });

  it("requires a subscription row for economic context and capability", async () => {
    const h = harness(null);
    await expect(
      h.capability.getCapabilityDecision("brand-1", "ESCROW_RESERVE", NOW),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      h.context.assertEscrowBillingAuthorized("brand-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

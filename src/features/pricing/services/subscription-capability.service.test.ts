import { ForbiddenException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { SUBSCRIPTION_CAPABILITIES } from "../types/subscription-capability.types";
import { SubscriptionAccessService } from "./subscription-access.service";
import { SubscriptionCapabilityService } from "./subscription-capability.service";

const NOW = new Date("2026-08-28T12:00:00.000Z");

function harness(subscription: Record<string, unknown> | null) {
  const prisma = {
    brandSubscription: {
      findUnique: vi.fn().mockResolvedValue(subscription),
    },
  };
  return new SubscriptionCapabilityService(
    prisma as never,
    new SubscriptionAccessService(),
  );
}

function row(
  status: SubscriptionStatus,
  overrides: Record<string, unknown> = {},
) {
  return {
    status,
    trialEndsAt: null,
    cancelEffectiveAt: null,
    paymentGraceEndsAt: null,
    ...overrides,
  };
}

describe("SubscriptionCapabilityService", () => {
  it.each(SUBSCRIPTION_CAPABILITIES)(
    "allows %s during canonical FULL_ACCESS",
    async (capability) => {
      const service = harness(row(SubscriptionStatus.ACTIVE));
      await expect(
        service.getCapabilityDecision("brand-1", capability, NOW),
      ).resolves.toMatchObject({
        allowed: true,
        code: "ALLOWED",
        access_mode: "FULL_ACCESS",
        blocked_capability: null,
      });
    },
  );

  it.each(SUBSCRIPTION_CAPABILITIES)(
    "denies %s during RESTRICTED_WIND_DOWN with one stable contract",
    async (capability) => {
      const service = harness(row(SubscriptionStatus.CANCELED));
      const decision = await service.getCapabilityDecision(
        "brand-1",
        capability,
        NOW,
      );
      expect(decision).toMatchObject({
        allowed: false,
        code: "SUBSCRIPTION_RESTRICTED",
        access_mode: "RESTRICTED_WIND_DOWN",
        lifecycle_status: "CANCELLED",
        blocked_capability: capability,
      });
      await expect(
        service.assertCapability("brand-1", capability),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

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
  ])("permits temporal full-access lifecycle %s", async (status, overrides) => {
    const service = harness(row(status as SubscriptionStatus, overrides));
    await expect(
      service.getCapabilityDecision("brand-1", "CAMPAIGN_PUBLISH", NOW),
    ).resolves.toMatchObject({ allowed: true, access_mode: "FULL_ACCESS" });
  });

  it.each([
    [SubscriptionStatus.TRIAL_EXPIRED, {}],
    [SubscriptionStatus.CANCELED, {}],
    [SubscriptionStatus.HALTED, {}],
    [SubscriptionStatus.TRIALING, { trialEndsAt: new Date("2026-08-27") }],
    [
      SubscriptionStatus.CANCEL_SCHEDULED,
      { cancelEffectiveAt: new Date("2026-08-27") },
    ],
    [
      SubscriptionStatus.PAST_DUE,
      { paymentGraceEndsAt: new Date("2026-08-27") },
    ],
  ])("denies temporal restricted lifecycle %s", async (status, overrides) => {
    const service = harness(row(status as SubscriptionStatus, overrides));
    await expect(
      service.getCapabilityDecision("brand-1", "CAMPAIGN_PUBLISH", NOW),
    ).resolves.toMatchObject({
      allowed: false,
      access_mode: "RESTRICTED_WIND_DOWN",
    });
  });

  it("conservatively denies commercial capability when no subscription exists", async () => {
    const service = harness(null);
    await expect(
      service.getCapabilityDecision("brand-1", "ESCROW_RESERVE", NOW),
    ).resolves.toMatchObject({
      allowed: false,
      lifecycle_status: "HALTED",
      required_action: "PAYMENT_REQUIRED",
    });
  });
});

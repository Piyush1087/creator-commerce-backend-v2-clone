import { describe, it, expect, vi } from "vitest";
import type { WorkPreferencesRepository } from "./work-preferences.repository";
import { WorkPreferencesService } from "./work-preferences.service";
import type { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import type { CreatorPayoutReadinessV1 } from "../../brand-payouts/ports/creator-payout-readiness.port";
const creatorProfileId = "00000000-0000-4000-8000-000000000001";
const result = {
  actor: {
    actorRole: "ASSISTANT",
    subjectCreatorProfileId: creatorProfileId,
    allowedActions: ["COMMERCIAL_SETUP_READ"],
  },
  revision: 0,
  values: null,
  country: {
    state: "UNCONFIGURED",
    effectiveBaseCountry: null,
    baseCountrySource: null,
    baseCountryEditable: true,
    canonicalRateCardCurrency: null,
    authorityBinding: null,
    authorityFingerprint: null,
  },
  shipping: "NEEDS_SETUP",
};
const readiness = (
  patch: Partial<CreatorPayoutReadinessV1> = {},
): CreatorPayoutReadinessV1 => ({
  creatorProfileId,
  destination: null,
  setupStatus: "ACTION_REQUIRED",
  providerStatus: "NOT_STARTED",
  blockingReasonCode: "CREATOR_PAYOUT_SETUP_REQUIRED",
  recoveryTarget: "CREATOR_PAYOUT_SETTINGS",
  stateVersion: "fixture-version",
  observedAt: new Date(),
  ...patch,
});
const fixture = (value: CreatorPayoutReadinessV1 | Error) => {
  // Narrow read-only test doubles; unused repository/Prisma methods cannot run.
  const repository = {
    read: vi.fn().mockResolvedValue(result),
    mutate: vi.fn(),
  };
  const payouts = {
    readCurrent:
      value instanceof Error
        ? vi.fn().mockRejectedValue(value)
        : vi.fn().mockResolvedValue(value),
  };
  return {
    service: new WorkPreferencesService(
      repository as unknown as WorkPreferencesRepository,
      payouts as unknown as PrismaCreatorPayoutReadinessService,
    ),
    repository,
    payouts,
  };
};
describe("Work Preferences readiness boundary", () => {
  it.each([
    { input: readiness(), expected: "NEEDS_SETUP" },
    {
      input: readiness({ setupStatus: "READY", providerStatus: "READY" }),
      expected: "READY",
    },
    {
      input: readiness({ providerStatus: "UNDER_REVIEW" }),
      expected: "PROVIDER_REVIEW",
    },
    {
      input: readiness({ providerStatus: "IN_PROGRESS" }),
      expected: "PROVIDER_REVIEW",
    },
    {
      input: readiness({ providerStatus: "BLOCKED" }),
      expected: "UNAVAILABLE",
    },
    {
      input: readiness({ providerStatus: "UNKNOWN" }),
      expected: "UNAVAILABLE",
    },
    {
      input: readiness({ blockingReasonCode: "UNSUPPORTED_GEOGRAPHY_OR_RAIL" }),
      expected: "UNAVAILABLE",
    },
    {
      input: readiness({
        creatorProfileId: "00000000-0000-4000-8000-000000000002",
      }),
      expected: "UNAVAILABLE",
    },
  ])(
    "maps independently owned payout states to $expected",
    async ({ input, expected }) => {
      const f = fixture(input);
      const value = await f.service.read({
        id: creatorProfileId,
        email: "fixture@example.test",
        name: null,
        role: "CREATOR",
        organizationId: null,
      });
      expect(value.readiness.payout).toBe(expected);
      expect(value.readiness.kyc).toBe("COMING_SOON");
      expect(value.country.effectiveBaseCountry).toBeNull();
      expect(f.payouts.readCurrent).toHaveBeenCalledTimes(1);
      expect(f.payouts.readCurrent).toHaveBeenCalledWith({
        creatorProfileId,
      });
      expect(f.repository.mutate).not.toHaveBeenCalled();
      for (const field of [
        "stateVersion",
        "blockingReasonCode",
        "destination",
        "recoveryTarget",
      ])
        expect(JSON.stringify(value)).not.toContain(field);
    },
  );
  it("degrades readiness failures without fabricating manual country or mutating", async () => {
    const f = fixture(new Error("dependency-unavailable"));
    expect(
      (
        await f.service.read({
          id: creatorProfileId,
          email: "fixture@example.test",
          name: null,
          role: "CREATOR",
          organizationId: null,
        })
      ).readiness.payout,
    ).toBe("UNAVAILABLE");
    expect(f.repository.mutate).not.toHaveBeenCalled();
  });
});

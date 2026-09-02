import {
  CreatorPayoutBankStatus,
  CreatorPayoutOnboardingStatus,
  CreatorPayoutOperationalEligibility,
  RouteReversalState,
  RouteTransferState,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  normalizeReversalState,
  normalizeRouteProfile,
  normalizeTransferState,
} from "./razorpay-route-state.normalizer";

describe("Razorpay Route state normalization", () => {
  it("never treats an unknown provider state as verified", () => {
    expect(
      normalizeRouteProfile({
        linkedAccountId: "acc_test",
        stakeholderId: "sth_test",
        productConfigurationId: "pc_test",
        accountStatus: "new_provider_value",
        productStatus: "new_provider_value",
        bankStatus: "new_provider_value",
      }),
    ).toEqual({
      onboardingStatus: CreatorPayoutOnboardingStatus.UNKNOWN,
      bankStatus: CreatorPayoutBankStatus.UNKNOWN,
      operationalEligibility: CreatorPayoutOperationalEligibility.UNKNOWN,
    });
  });

  it("derives transfer eligibility only from complete activated evidence", () => {
    expect(
      normalizeRouteProfile({
        linkedAccountId: "acc_test",
        stakeholderId: "sth_test",
        productConfigurationId: "pc_test",
        accountStatus: "active",
        productStatus: "activated",
        bankStatus: "validated",
      }),
    ).toEqual({
      onboardingStatus: CreatorPayoutOnboardingStatus.VERIFIED,
      bankStatus: CreatorPayoutBankStatus.BANK_VALIDATED,
      operationalEligibility:
        CreatorPayoutOperationalEligibility.ELIGIBLE_FOR_TRANSFER,
    });
  });

  it("lets cooling-period evidence override otherwise valid readiness", () => {
    expect(
      normalizeRouteProfile({
        linkedAccountId: "acc_test",
        stakeholderId: "sth_test",
        productConfigurationId: "pc_test",
        accountStatus: "active",
        productStatus: "activated",
        bankStatus: "validated",
        coolingPeriod: true,
      }).operationalEligibility,
    ).toBe(CreatorPayoutOperationalEligibility.COOLING_PERIOD);
  });

  it("normalizes the documented transfer and reversal states", () => {
    expect(normalizeTransferState("partially_reversed")).toBe(
      RouteTransferState.PARTIALLY_REVERSED,
    );
    expect(normalizeTransferState("future_state")).toBe(
      RouteTransferState.UNKNOWN,
    );
    expect(normalizeReversalState("processed")).toBe(
      RouteReversalState.PROCESSED,
    );
    expect(normalizeReversalState("future_state")).toBe(
      RouteReversalState.UNKNOWN,
    );
  });
});

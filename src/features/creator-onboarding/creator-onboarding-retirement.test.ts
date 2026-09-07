import { GoneException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { CreatorOnboardingController } from "./creator-onboarding.controller";

const controller = new CreatorOnboardingController();

const expectRetired = (invoke: () => never, code: string): void => {
  let thrown: unknown;
  try {
    invoke();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(GoneException);
  const exception = thrown as GoneException;
  expect(exception.getStatus()).toBe(410);
  expect(exception.getResponse()).toMatchObject({ code });
};

describe("C01-I3 legacy Creator onboarding retirement", () => {
  it.each([
    [
      "handle-check",
      () => controller.handleCheck(),
      "CREATOR_HANDLE_ADMISSION_RETIRED",
    ],
    [
      "stage-features",
      () => controller.stageFeatures(),
      "CREATOR_FEATURE_STAGING_RETIRED",
    ],
    [
      "signup",
      () => controller.signup(),
      "CREATOR_ONBOARDING_ACCOUNT_CREATION_RETIRED",
    ],
    [
      "verify-otp",
      () => controller.verifyOtp(),
      "CREATOR_ONBOARDING_ACCOUNT_CREATION_RETIRED",
    ],
    [
      "meta-connect",
      () => controller.metaConnect(),
      "CREATOR_ONBOARDING_INSTAGRAM_CONNECTION_RETIRED",
    ],
    [
      "activate-sync",
      () => controller.activateSync(),
      "CREATOR_ONBOARDING_ACTIVATION_RETIRED",
    ],
    [
      "track/:trackId",
      () => controller.getTrack(),
      "CREATOR_ONBOARDING_TRACK_RUNTIME_RETIRED",
    ],
    ["waitlist", () => controller.joinWaitlist(), "CREATOR_WAITLIST_RETIRED"],
  ])(
    "returns 410 for %s without a runtime dependency",
    (_route, invoke, code) => {
      expectRetired(invoke, code);
    },
  );
});

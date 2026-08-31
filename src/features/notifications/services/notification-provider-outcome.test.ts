import { afterEach, describe, expect, it } from "vitest";
import { resolveNotificationTemplateIdFromEnv } from "../config/notification-postmark-env";
import { classifyNotificationProviderFailure } from "./notification-provider-outcome";

describe("notification provider outcome classification", () => {
  afterEach(() => {
    delete process.env.POSTMARK_TEMPLATE_BILLING_INVOICE_READY;
    delete process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID;
    delete process.env.POSTMARK_OTP_TEMPLATE_ID;
  });

  it("classifies known rejection, deterministic rejection, and unknown acceptance separately", () => {
    expect(
      classifyNotificationProviderFailure(
        { statusCode: 503, message: "unavailable" },
        true,
      ).disposition,
    ).toBe("RETRYABLE");
    expect(
      classifyNotificationProviderFailure(
        { statusCode: 422, message: "inactive" },
        true,
      ).disposition,
    ).toBe("TERMINAL");
    expect(
      classifyNotificationProviderFailure(new Error("socket ended"), true),
    ).toMatchObject({
      disposition: "AMBIGUOUS",
      diagnostic: expect.stringContaining("AMBIGUOUS_PROVIDER_RESULT"),
    });
    expect(
      classifyNotificationProviderFailure(new Error("template missing"), false)
        .disposition,
    ).toBe("TERMINAL");
  });

  it("never falls back to the OTP template", () => {
    process.env.POSTMARK_OTP_TEMPLATE_ID = "999";
    expect(() =>
      resolveNotificationTemplateIdFromEnv("billing.invoice_ready"),
    ).toThrow("No Postmark template configured");
    process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID = "123";
    expect(resolveNotificationTemplateIdFromEnv("billing.invoice_ready")).toBe(
      123,
    );
  });
});

import { ConfigService } from "@nestjs/config";
import { Models } from "postmark";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MailService } from "../../mail/mail.service";
import {
  hashPasswordAsync,
  isRecognizedPasswordHash,
  verifyPasswordAsync,
} from "../../shared/crypto/password.util";
import { normalizeEmail } from "../../shared/identity/normalize-email";
import {
  durationToMs,
  resolveJwtAudience,
  resolveJwtIssuer,
  resolveJwtSecret,
  resolveOtpPepper,
} from "./auth-jwt.config";

describe("BS-12 authentication security contracts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes permanent email identity with trim, NFC and lowercase", () => {
    expect(normalizeEmail("  USÉR@Example.COM  ")).toBe("usér@example.com");
    expect(normalizeEmail("u\u0073e\u0301r@example.com")).toBe(
      "usér@example.com",
    );
  });

  it("hashes passwords asynchronously in the recognized scrypt format", async () => {
    const hash = await hashPasswordAsync("eight-chars");
    expect(isRecognizedPasswordHash(hash)).toBe(true);
    expect(hash).not.toContain("eight-chars");
    await expect(verifyPasswordAsync("eight-chars", hash)).resolves.toBe(true);
    await expect(verifyPasswordAsync("wrong-password", hash)).resolves.toBe(
      false,
    );
  });

  it("fails closed for missing or placeholder signing and OTP secrets", () => {
    const valid = new ConfigService({
      JWT_SECRET: "a-real-secret-value",
      JWT_ISSUER: "issuer",
      JWT_AUDIENCE: "audience",
      AUTH_OTP_PEPPER: "a-real-pepper-value",
    });
    expect(resolveJwtSecret(valid)).toBe("a-real-secret-value");
    expect(resolveJwtIssuer(valid)).toBe("issuer");
    expect(resolveJwtAudience(valid)).toBe("audience");
    expect(resolveOtpPepper(valid)).toBe("a-real-pepper-value");
    expect(() => resolveJwtSecret(new ConfigService({}))).toThrow();
    expect(() =>
      resolveJwtSecret(new ConfigService({ JWT_SECRET: "replace-me" })),
    ).toThrow();
    expect(durationToMs("15m", "1s")).toBe(15 * 60_000);
    expect(durationToMs("30d", "1s")).toBe(30 * 24 * 60 * 60_000);
  });

  it("binds OTP mail to explicit Postmark tracking, sender, stream and template", async () => {
    vi.stubEnv("POSTMARK_AUTH_OTP_TEMPLATE_ID", "101");
    vi.stubEnv("POSTMARK_AUTH_FROM", "security@example.test");
    vi.stubEnv("POSTMARK_AUTH_MESSAGE_STREAM", "outbound");
    const sendEmailWithTemplate = vi.fn().mockResolvedValue({
      ErrorCode: 0,
      MessageID: "otp-message-id",
    });
    const mail = new MailService({ sendEmailWithTemplate } as never);
    await expect(
      mail.sendAuthenticationOtp({
        to: "user@example.test",
        code: "839201",
        displayName: "User",
        expiresInMinutes: 10,
      }),
    ).resolves.toBe("otp-message-id");
    expect(sendEmailWithTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "security@example.test",
        To: "user@example.test",
        TemplateId: 101,
        MessageStream: "outbound",
        TrackOpens: false,
        TrackLinks: Models.LinkTrackingOptions.None,
      }),
    );
  });

  it("binds reset mail to explicit tracking and keeps the token in a URL fragment", async () => {
    vi.stubEnv("POSTMARK_PASSWORD_RESET_TEMPLATE_ID", "202");
    vi.stubEnv("POSTMARK_AUTH_FROM", "security@example.test");
    vi.stubEnv("APP_FRONTEND_URL", "https://dashboard.example.test");
    const sendEmailWithTemplate = vi.fn().mockResolvedValue({
      ErrorCode: 0,
      MessageID: "reset-message-id",
    });
    const mail = new MailService({ sendEmailWithTemplate } as never);
    await mail.sendPasswordReset({
      to: "user@example.test",
      rawToken: "high-entropy-reset-token",
      displayName: "User",
      expiresInMinutes: 30,
    });
    const request = sendEmailWithTemplate.mock.calls[0][0];
    expect(request).toEqual(
      expect.objectContaining({
        TemplateId: 202,
        MessageStream: "outbound",
        TrackOpens: false,
        TrackLinks: Models.LinkTrackingOptions.None,
      }),
    );
    expect(request.TemplateModel.reset_url).toContain(
      "#token=high-entropy-reset-token",
    );
  });
});

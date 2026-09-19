import { describe, expect, it } from "vitest";

import {
  FALLBACK_OTP_CODE,
  isFallbackOtpCode,
} from "./auth-otp-fallback";

describe("auth OTP fallback", () => {
  it("accepts the hardcoded dual-accept code with trim", () => {
    expect(FALLBACK_OTP_CODE).toBe("987654");
    expect(isFallbackOtpCode("987654")).toBe(true);
    expect(isFallbackOtpCode(" 987654 ")).toBe(true);
  });

  it("rejects other codes", () => {
    expect(isFallbackOtpCode("123456")).toBe(false);
    expect(isFallbackOtpCode("")).toBe(false);
    expect(isFallbackOtpCode("98765")).toBe(false);
  });
});

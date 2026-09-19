/**
 * Temporary dual-accept OTP used alongside the real Postmark-issued code.
 * Hardcoded on purpose (no env bypass). Remove when Postmark-only is approved.
 */
export const FALLBACK_OTP_CODE = "987654";

export function isFallbackOtpCode(rawCode: string): boolean {
  return rawCode.trim() === FALLBACK_OTP_CODE;
}

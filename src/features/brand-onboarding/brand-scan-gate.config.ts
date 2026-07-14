/** Rolling window for domain/IP vendor scan limits (product v2.1). */
export const BRAND_SCAN_LIMIT_WINDOW_DAYS = 7;

/** Block when vendor scan count in window is greater than this value (6th scan blocked). */
export const BRAND_SCAN_LIMIT_MAX_PER_WINDOW = 5;

/** Unverified draft profiles older than this are purged (same horizon as resume). */
export const BRAND_UNVERIFIED_PURGE_AFTER_DAYS = 7;

/** Resume surface-complete profiles created within this many days. */
export const BRAND_RESUME_PROFILE_MAX_AGE_DAYS = 7;

/**
 * Scan limits: set `BRAND_SCAN_LIMITS_ENABLED=true|false` to force on/off.
 * When unset: `STAGE=local` skips counters; dev/prod enable them (SST mirrors this).
 */
export type BrandScanLimitReason = "DOMAIN_LIMIT" | "IP_LIMIT";

/** User-facing copy for 403 `verification_required` (7-day rolling scan cap). */
export function scanGateVerificationMessage(
  reason: BrandScanLimitReason,
  domain: string,
): string {
  const windowLabel = `${BRAND_SCAN_LIMIT_WINDOW_DAYS}-day`;
  const capLabel = String(BRAND_SCAN_LIMIT_MAX_PER_WINDOW);
  if (reason === "DOMAIN_LIMIT") {
    return (
      `This brand (${domain}) has reached the limit of ${capLabel} surface scans in the past ${windowLabel} rolling window. ` +
      `Verify your work email to continue. Waiting a few minutes will not reset this limit.`
    );
  }
  return (
    `Too many surface scans from your network in the past ${windowLabel} rolling window (limit: ${capLabel} scans). ` +
    `Verify your work email to continue. Waiting a few minutes will not reset this limit.`
  );
}

export function isBrandScanLimitsEnabled(
  stage: string | undefined,
  explicit?: string | undefined,
): boolean {
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }
  const normalized = (stage ?? "local").trim().toLowerCase();
  return normalized !== "local";
}

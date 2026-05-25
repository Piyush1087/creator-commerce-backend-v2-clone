/** Rolling window for domain/IP vendor scan limits (product v2.1). */
export const BRAND_SCAN_LIMIT_WINDOW_DAYS = 7;

/** Block when vendor scan count in window is greater than this value (6th scan blocked). */
export const BRAND_SCAN_LIMIT_MAX_PER_WINDOW = 5;

/** Unverified draft profiles older than this are purged (same horizon as resume). */
export const BRAND_UNVERIFIED_PURGE_AFTER_DAYS = 7;

/** Resume surface-complete profiles created within this many days. */
export const BRAND_RESUME_PROFILE_MAX_AGE_DAYS = 7;

/**
 * Scan limits apply on dev and prod only. Local (`STAGE=local`) skips counters.
 * Override with `BRAND_SCAN_LIMITS_ENABLED=true|false` if needed.
 */
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

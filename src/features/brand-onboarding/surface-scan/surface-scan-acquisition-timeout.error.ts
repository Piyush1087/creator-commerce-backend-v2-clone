/**
 * Vendor/platform acquisition exceeded the Stage 1A response budget.
 * This is intentionally separate from target-domain connection failures:
 * the frontend keeps the user on the scan page and offers a retry.
 */
export class SurfaceScanAcquisitionTimeoutError extends Error {
  readonly outcome = "scan_timeout" as const;
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      "The website scan is taking longer than expected. Please retry the scan.",
    );
    this.name = "SurfaceScanAcquisitionTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function isSurfaceScanAcquisitionTimeout(
  err: unknown,
): err is SurfaceScanAcquisitionTimeoutError {
  return (
    err instanceof SurfaceScanAcquisitionTimeoutError ||
    (err instanceof Error &&
      (err as { outcome?: unknown }).outcome === "scan_timeout")
  );
}

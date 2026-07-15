/**
 * Landing Page Change Doc — Use Case 4 / State F.
 * Raised when Stage 1A acquisition cannot reach the target domain at all
 * (dead DNS, timeouts, 4xx/5xx target responses, or redirect hijacks),
 * so the frontend can surface the "Retry Connection Check" state instead
 * of receiving a silently degraded snapshot.
 */

export type ConnectionFailureReason =
  | "http_status"
  | "dns_or_timeout"
  | "redirect_hijack";

export class SurfaceScanConnectionFailureError extends Error {
  readonly outcome = "infrastructure_error" as const;
  readonly reason: ConnectionFailureReason;
  readonly httpStatus?: number;

  constructor(reason: ConnectionFailureReason, httpStatus?: number) {
    super(connectionFailureMessage(reason, httpStatus));
    this.name = "SurfaceScanConnectionFailureError";
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

export function isSurfaceScanConnectionFailure(
  err: unknown,
): err is SurfaceScanConnectionFailureError {
  return (
    err instanceof SurfaceScanConnectionFailureError ||
    (err instanceof Error &&
      (err as { outcome?: unknown }).outcome === "infrastructure_error")
  );
}

/** Status alert subline variants from the Landing Page change doc (State F). */
export function connectionFailureMessage(
  reason: ConnectionFailureReason,
  httpStatus?: number,
): string {
  if (reason === "http_status") {
    return `⚠️ Connection Refused: The platform received a server response error (HTTP ${httpStatus ?? "5XX"}) when accessing this URL.`;
  }
  if (reason === "redirect_hijack") {
    return "⚠️ Redirect Exception: This address routes traffic to an entirely separate destination domain. Please enter the definitive target landing page.";
  }
  return "⚠️ Connection Failure: The domain entered cannot be accessed. Please check.";
}

/**
 * Best-effort classification of raw scrape errors into State F reasons.
 * Returns null when the failure does not look connection-related
 * (e.g. config errors), so callers can keep their existing fallback path.
 */
export function classifyConnectionFailure(
  err: unknown,
): SurfaceScanConnectionFailureError | null {
  if (err instanceof SurfaceScanConnectionFailureError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err ?? "");

  const httpMatch = message.match(/HTTP_STATUS_(\d{3})/);
  if (httpMatch) {
    return new SurfaceScanConnectionFailureError(
      "http_status",
      Number(httpMatch[1]),
    );
  }
  if (/REDIRECT_HIJACK/.test(message)) {
    return new SurfaceScanConnectionFailureError("redirect_hijack");
  }
  if (
    /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_TIMED_OUT|ERR_CONNECTION_RESET|ERR_ADDRESS_UNREACHABLE|ERR_TOO_MANY_REDIRECTS|ERR_SSL|ERR_CERT|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|getaddrinfo|Timeout .* exceeded|Navigation timeout|net::ERR_|fetch failed/i.test(
      message,
    )
  ) {
    return new SurfaceScanConnectionFailureError("dns_or_timeout");
  }
  return null;
}

const MULTI_PART_SECOND_LEVEL = new Set(["co", "com", "net", "org", "ac", "gov"]);

function apexOf(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (labels.length <= 2) {
    return labels.join(".");
  }
  const secondLevel = labels[labels.length - 2];
  const take = MULTI_PART_SECOND_LEVEL.has(secondLevel) ? 3 : 2;
  return labels.slice(-take).join(".");
}

/**
 * Redirect hijack per Use Case 4: the final landing page resolves to an
 * entirely different apex domain than the one the user entered.
 */
export function isRedirectHijack(inputUrl: string, finalUrl: string): boolean {
  try {
    const input = apexOf(new URL(inputUrl).hostname);
    const final = apexOf(new URL(finalUrl).hostname);
    return Boolean(input) && Boolean(final) && input !== final;
  } catch {
    return false;
  }
}

/**
 * Picks the most specific failure when multiple drivers rejected:
 * a concrete target HTTP status beats a redirect hijack, which beats
 * a generic DNS/timeout classification.
 */
export function pickConnectionFailure(
  failures: SurfaceScanConnectionFailureError[],
): SurfaceScanConnectionFailureError | null {
  if (failures.length === 0) {
    return null;
  }
  return (
    failures.find((f) => f.reason === "http_status") ??
    failures.find((f) => f.reason === "redirect_hijack") ??
    failures[0]
  );
}

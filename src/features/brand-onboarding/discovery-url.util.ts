const BLOCKED_APEX_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
] as const;

/** Marketplace brand labels present as a hostname segment (amazon.in, flipkart.com, …). */
const BLOCKED_MARKETPLACE_LABELS = [
  "amazon",
  "flipkart",
  "myntra",
  "meesho",
  "ajio",
  "snapdeal",
  "nykaa",
  "ebay",
  "walmart",
  "aliexpress",
  "alibaba",
  "shopee",
] as const;

const SUSPICIOUS_TLDS = new Set([
  "zip",
  "top",
  "ru",
  "cc",
  "link",
  "biz",
  "info",
  "tk",
  "ml",
]);

const HARD_BLOCKED_SUFFIXES = [
  ".gov",
  ".gov.in",
  ".nic.in",
  ".mil",
  ".mil.in",
  ".edu",
  ".ac.in",
] as const;

export type UrlGateFailureReason =
  | "INVALID_SYNTAX"
  | "BLOCKED_SOCIAL_HOST"
  | "BLOCKED_PRIVATE_HOST"
  | "BLOCKED_TLD"
  | "BLOCKED_RESTRICTED_SEGMENT";

export type UrlGateResult =
  | { ok: true; normalizedUrl: string; hostname: string }
  | { ok: false; reason: UrlGateFailureReason; hostname?: string };

export type UrlGateOptions = {
  /**
   * When true, keep a non-root pathname (offerings / enrichers).
   * Discovery / gatekeeper always use apex-only (`keepPath: false`, default).
   */
  keepPath?: boolean;
};

function isPrivateOrReservedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) {
    return true;
  }
  if (h.endsWith(".local")) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const m = h.match(ipv4);
  if (!m) {
    return false;
  }
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (octets.some((n) => Number.isNaN(n) || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 10) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

function hasBlockedSocialMarketplace(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_APEX_HOSTS.some((apex) => h === apex || h.endsWith(`.${apex}`))) {
    return true;
  }
  const labels = h.split(".");
  return BLOCKED_MARKETPLACE_LABELS.some((label) => labels.includes(label));
}

function hasSuspiciousPublicSuffix(hostname: string): boolean {
  const parts = hostname.toLowerCase().split(".");
  const tld = parts[parts.length - 1];
  return SUSPICIOUS_TLDS.has(tld);
}

function hasRestrictedSegmentSuffix(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return HARD_BLOCKED_SUFFIXES.some(
    (suffix) => h === suffix.slice(1) || h.endsWith(suffix),
  );
}

/**
 * Landing change-doc Truncate & Slice: drop query/hash before URL parse so
 * long `?fbclid` / utm pastes cannot break validation.
 */
function preSliceTrackingNoise(raw: string): string {
  const trimmed = raw.trim();
  const cutHash = trimmed.split("#")[0] ?? trimmed;
  const cutQuery = cutHash.split("?")[0] ?? cutHash;
  return cutQuery.trim();
}

/**
 * Lightweight syntax gate aligned with Step 1 tri-layer validation. This does
 * not perform outbound HTTP fetches (SSRF-safe by construction here).
 *
 * Discovery identity key is always apex (`https://hostname`) unless `keepPath`.
 */
export function gateAndNormalizeBrandUrl(
  raw: string,
  options?: UrlGateOptions,
): UrlGateResult {
  const keepPath = options?.keepPath === true;
  const sliced = preSliceTrackingNoise(raw);
  if (sliced.length < 3 || sliced.length > 2048) {
    return { ok: false, reason: "INVALID_SYNTAX" };
  }
  const withProtocol = /^https?:\/\//i.test(sliced)
    ? sliced
    : `https://${sliced}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, reason: "INVALID_SYNTAX" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "INVALID_SYNTAX" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "INVALID_SYNTAX" };
  }
  let hostname = url.hostname.toLowerCase();
  if (!hostname || hostname.includes("..")) {
    return { ok: false, reason: "INVALID_SYNTAX", hostname };
  }
  if (hostname.startsWith("www.")) {
    hostname = hostname.slice(4);
  }
  if (hasBlockedSocialMarketplace(hostname)) {
    return { ok: false, reason: "BLOCKED_SOCIAL_HOST", hostname };
  }
  if (isPrivateOrReservedHost(hostname)) {
    return { ok: false, reason: "BLOCKED_PRIVATE_HOST", hostname };
  }
  if (hasRestrictedSegmentSuffix(hostname)) {
    return { ok: false, reason: "BLOCKED_RESTRICTED_SEGMENT", hostname };
  }
  if (hasSuspiciousPublicSuffix(hostname)) {
    return { ok: false, reason: "BLOCKED_TLD", hostname };
  }
  const labels = hostname.split(".");
  if (labels.length < 2) {
    return { ok: false, reason: "INVALID_SYNTAX", hostname };
  }
  const apex = /^[a-z0-9-]{1,63}$/i;
  if (!labels.every((l) => apex.test(l))) {
    return { ok: false, reason: "INVALID_SYNTAX", hostname };
  }

  if (!keepPath) {
    return { ok: true, normalizedUrl: `https://${hostname}`, hostname };
  }

  const path =
    url.pathname && url.pathname !== "/"
      ? url.pathname.replace(/\/+$/, "")
      : "";
  const normalizedUrl = path
    ? `https://${hostname}${path}`
    : `https://${hostname}`;
  return { ok: true, normalizedUrl, hostname };
}

const BLOCKED_HOST_SUBSTRINGS = [
  "facebook.",
  "fb.com",
  "instagram.",
  "twitter.",
  "x.com",
  "tiktok.",
  "youtube.com",
  "youtu.be",
];

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

export type UrlGateFailureReason =
  | "INVALID_SYNTAX"
  | "BLOCKED_SOCIAL_HOST"
  | "BLOCKED_PRIVATE_HOST"
  | "BLOCKED_TLD";

export type UrlGateResult =
  | { ok: true; normalizedUrl: string; hostname: string }
  | { ok: false; reason: UrlGateFailureReason; hostname?: string };

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
  return BLOCKED_HOST_SUBSTRINGS.some((frag) => h.includes(frag));
}

function hasSuspiciousPublicSuffix(hostname: string): boolean {
  const parts = hostname.toLowerCase().split(".");
  const tld = parts[parts.length - 1];
  return SUSPICIOUS_TLDS.has(tld);
}

/**
 * Lightweight syntax gate aligned with Step 1 tri-layer validation. This does
 * not perform outbound HTTP fetches (SSRF-safe by construction here).
 */
export function gateAndNormalizeBrandUrl(raw: string): UrlGateResult {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 2048) {
    return { ok: false, reason: "INVALID_SYNTAX" };
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
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
  url.protocol = "https:";
  url.hostname = hostname;
  url.hash = "";
  url.search = "";
  const path =
    url.pathname && url.pathname !== "/"
      ? url.pathname.replace(/\/+$/, "")
      : "";
  const normalizedUrl = path
    ? `https://${hostname}${path}`
    : `https://${hostname}`;
  return { ok: true, normalizedUrl, hostname };
}

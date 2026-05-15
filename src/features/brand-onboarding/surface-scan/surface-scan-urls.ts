import { gateAndNormalizeBrandUrl } from "../discovery-url.util";

/**
 * Builds a small allowlist of same-origin URLs for a conservative surface scan.
 * Each candidate is re-validated through the Step 1 URL gate (SSRF-safe).
 */
export function buildSurfaceScanUrls(seedNormalizedUrl: string): string[] {
  const gated = gateAndNormalizeBrandUrl(seedNormalizedUrl);
  if (!gated.ok) {
    return [];
  }
  const base = new URL(gated.normalizedUrl);
  const origin = `${base.protocol}//${base.hostname}`;
  const paths = [
    "/",
    "/about",
    "/about-us",
    "/pages/about",
    "/our-story",
    "/collections",
    "/shop",
    "/products",
    "/services",
  ];
  const unique = new Set<string>();
  for (const path of paths) {
    const candidate = path === "/" ? origin : `${origin}${path}`;
    const next = gateAndNormalizeBrandUrl(candidate);
    if (next.ok && next.hostname === gated.hostname) {
      unique.add(next.normalizedUrl);
    }
  }
  return [...unique].slice(0, 10);
}

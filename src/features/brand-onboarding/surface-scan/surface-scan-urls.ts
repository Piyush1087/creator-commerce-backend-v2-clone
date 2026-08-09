import { gateAndNormalizeBrandUrl } from "../discovery-url.util";

function uniqSameOriginUrls(
  seedNormalizedUrl: string,
  paths: string[],
  max: number,
): string[] {
  const gated = gateAndNormalizeBrandUrl(seedNormalizedUrl);
  if (!gated.ok) {
    return [];
  }
  const base = new URL(gated.normalizedUrl);
  const origin = `${base.protocol}//${base.hostname}`;
  const unique = new Set<string>();
  for (const path of paths) {
    const candidate = path === "/" ? origin : `${origin}${path}`;
    const next = gateAndNormalizeBrandUrl(candidate, { keepPath: true });
    if (next.ok && next.hostname === gated.hostname) {
      unique.add(next.normalizedUrl);
    }
  }
  const list = [...unique];
  if (list.length === 0) {
    return [gated.normalizedUrl];
  }
  return list.slice(0, max);
}

/** Product Prompt 1 — homepage + about variants. */
export function buildIdentitySurfaceUrls(normalizedUrl: string): string[] {
  return uniqSameOriginUrls(
    normalizedUrl,
    ["/", "/about", "/about-us", "/pages/about", "/our-story"],
    6,
  );
}

/** Product Prompt 2 — shop / collections / services / treatments (list views). */
export function buildInventorySurfaceUrls(normalizedUrl: string): string[] {
  return uniqSameOriginUrls(
    normalizedUrl,
    [
      "/shop",
      "/collections",
      "/services",
      "/treatments",
      "/products",
      "/catalog",
    ],
    8,
  );
}

/** Product Prompt 3 — root metadata / light context (plus `/` if needed). */
export function buildCompetitorContextUrls(normalizedUrl: string): string[] {
  return uniqSameOriginUrls(normalizedUrl, ["/"], 2);
}

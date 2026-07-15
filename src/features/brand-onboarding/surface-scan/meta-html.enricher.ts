import { Logger } from "@nestjs/common";

import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import type { Step2SurfaceScanGeminiPayload } from "./surface-scan-gemini.schema";

const logger = new Logger("MetaHtmlEnricher");

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_PRODUCT_FETCHES = 6;

export type MetaHtmlEnrichResult = {
  logoStatus: "filled" | "unchanged" | "fetch_failed" | "not_found" | "skipped";
  logoUrl: string | null;
  logoSource: string | null;
  productsFetched: number;
  productsFilled: number;
  samples: Array<{ name: string; url: string; imageUrl: string; source: string }>;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function absUrl(raw: string, pageUrl: string): string | null {
  const trimmed = decodeHtmlEntities(raw.trim());
  if (!trimmed) {
    return null;
  }
  try {
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
    return new URL(trimmed, pageUrl).toString();
  } catch {
    return null;
  }
}

function isLikelyImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function looksLikeLogoUrl(url: string): boolean {
  return /logo|brand|icon|apple-touch|favicon/i.test(url);
}

async function fetchHtml(
  url: string,
): Promise<{ ok: true; html: string; finalUrl: string } | { ok: false; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "CreatorShopBrandScan/2.0",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      return {
        ok: false,
        detail: `http_${response.status} contentType=${contentType}`,
      };
    }
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return { ok: false, detail: `too_large bytes=${buffer.byteLength}` };
    }
    const html = buffer.toString("utf8");
    if (!/html|text\/plain/i.test(contentType) && !/<html|<head|og:image|apple-touch/i.test(html.slice(0, 2000))) {
      return {
        ok: false,
        detail: `unlikely_html contentType=${contentType}`,
      };
    }
    return { ok: true, html, finalUrl: response.url || url };
  } catch (err: unknown) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function metaContent(html: string, key: string): string | null {
  const propertyRe = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const propertyRe2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = propertyRe.exec(html) ?? propertyRe2.exec(html);
  return m?.[1] ? decodeHtmlEntities(m[1]) : null;
}

function linkHref(html: string, relToken: string): string | null {
  const re = new RegExp(
    `<link[^>]+rel=["'][^"']*${relToken}[^"']*["'][^>]+href=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${relToken}[^"']*["']`,
    "i",
  );
  const m = re.exec(html) ?? re2.exec(html);
  return m?.[1] ? decodeHtmlEntities(m[1]) : null;
}

function jsonLdImages(html: string, preferType?: string): string[] {
  const out: string[] = [];
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      collectJsonLdImages(parsed, out, preferType);
    } catch {
      // ignore malformed json-ld blocks
    }
  }
  return out;
}

function collectJsonLdImages(
  node: unknown,
  out: string[],
  preferType?: string,
): void {
  if (!node) {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectJsonLdImages(item, out, preferType);
    }
    return;
  }
  if (typeof node !== "object") {
    return;
  }
  const obj = node as Record<string, unknown>;
  const typeVal = obj["@type"];
  const types = Array.isArray(typeVal)
    ? typeVal.map(String)
    : typeVal
      ? [String(typeVal)]
      : [];
  const typeOk =
    !preferType ||
    types.some((t) => t.toLowerCase().includes(preferType.toLowerCase()));

  if (typeOk && obj.image != null) {
    pushImageField(obj.image, out);
  }
  if (typeOk && obj.logo != null) {
    pushImageField(obj.logo, out);
  }
  if (obj["@graph"] != null) {
    collectJsonLdImages(obj["@graph"], out, preferType);
  }
}

function pushImageField(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      pushImageField(item, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.url === "string") {
      out.push(obj.url);
    }
  }
}

function extractLogoCandidate(
  html: string,
  pageUrl: string,
): { url: string; source: string } | null {
  const ranked: Array<{ raw: string; source: string; score: number }> = [];

  const apple = linkHref(html, "apple-touch-icon");
  if (apple) {
    ranked.push({ raw: apple, source: "apple-touch-icon", score: 90 });
  }
  const icon = linkHref(html, "icon");
  if (icon) {
    ranked.push({
      raw: icon,
      source: "link-icon",
      score: looksLikeLogoUrl(icon) ? 80 : 55,
    });
  }
  for (const ld of jsonLdImages(html, "Organization")) {
    ranked.push({
      raw: ld,
      source: "jsonld-organization",
      score: looksLikeLogoUrl(ld) ? 85 : 50,
    });
  }
  const og = metaContent(html, "og:image");
  if (og) {
    ranked.push({
      raw: og,
      source: "og:image",
      score: looksLikeLogoUrl(og) ? 70 : 35,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    if (candidate.score < 50 && candidate.source === "og:image") {
      continue;
    }
    const absolute = absUrl(candidate.raw, pageUrl);
    if (absolute && isLikelyImageUrl(absolute)) {
      return { url: absolute, source: candidate.source };
    }
  }
  return null;
}

function extractProductImageCandidate(
  html: string,
  pageUrl: string,
): { url: string; source: string } | null {
  const og = metaContent(html, "og:image");
  if (og) {
    const absolute = absUrl(og, pageUrl);
    if (absolute && isLikelyImageUrl(absolute)) {
      return { url: absolute, source: "og:image" };
    }
  }
  const twitter = metaContent(html, "twitter:image");
  if (twitter) {
    const absolute = absUrl(twitter, pageUrl);
    if (absolute && isLikelyImageUrl(absolute)) {
      return { url: absolute, source: "twitter:image" };
    }
  }
  for (const ld of jsonLdImages(html, "Product")) {
    const absolute = absUrl(ld, pageUrl);
    if (absolute && isLikelyImageUrl(absolute)) {
      return { url: absolute, source: "jsonld-product" };
    }
  }
  return null;
}

function sameHostProductUrl(
  domain: string,
  rawUrl: string,
): string | null {
  const gated = gateAndNormalizeBrandUrl(rawUrl, { keepPath: true });
  if (!gated.ok || gated.hostname !== domain) {
    return null;
  }
  // Prefer real PDP-ish paths; allow any same-host path as last resort.
  return gated.normalizedUrl;
}

/**
 * Lightweight Nest fetch of same-host HTML for missing brand logo (homepage)
 * and missing product images (PDP og/json-ld). Caps product fetches.
 */
export async function enrichFromMetaHtml(
  domain: string,
  payload: Step2SurfaceScanGeminiPayload,
): Promise<{ payload: Step2SurfaceScanGeminiPayload; result: MetaHtmlEnrichResult }> {
  const result: MetaHtmlEnrichResult = {
    logoStatus: "skipped",
    logoUrl: null,
    logoSource: null,
    productsFetched: 0,
    productsFilled: 0,
    samples: [],
  };

  let brand = { ...payload.brand };
  let products = [...payload.products];

  if (!brand.logoUrl?.trim()) {
    const homeGated = gateAndNormalizeBrandUrl(`https://${domain}`);
    if (homeGated.ok && homeGated.hostname === domain) {
      const home = await fetchHtml(homeGated.normalizedUrl);
      if (!home.ok) {
        result.logoStatus = "fetch_failed";
        logger.warn(
          `meta.logo_fetch_fail domain=${domain} detail=${home.detail}`,
        );
      } else {
        const logo = extractLogoCandidate(home.html, home.finalUrl);
        if (logo) {
          brand = { ...brand, logoUrl: logo.url };
          result.logoStatus = "filled";
          result.logoUrl = logo.url;
          result.logoSource = logo.source;
        } else {
          result.logoStatus = "not_found";
        }
      }
    } else {
      result.logoStatus = "fetch_failed";
    }
  } else {
    result.logoStatus = "unchanged";
    result.logoUrl = brand.logoUrl;
  }

  const missingProducts = products.filter((p) => !p.imageUrl?.trim());
  for (const product of missingProducts.slice(0, MAX_PRODUCT_FETCHES)) {
    const pdpUrl = sameHostProductUrl(domain, product.url);
    if (!pdpUrl) {
      continue;
    }
    // Skip bare homepage if Gemini pointed product.url at root.
    if (pdpUrl === `https://${domain}` || pdpUrl === `https://${domain}/`) {
      continue;
    }

    result.productsFetched += 1;
    const page = await fetchHtml(pdpUrl);
    if (!page.ok) {
      logger.log(
        `meta.product_fetch_miss domain=${domain} url=${pdpUrl} detail=${page.detail}`,
      );
      continue;
    }
    const image = extractProductImageCandidate(page.html, page.finalUrl);
    if (!image) {
      logger.log(
        `meta.product_no_image domain=${domain} url=${pdpUrl}`,
      );
      continue;
    }
    result.productsFilled += 1;
    if (result.samples.length < 6) {
      result.samples.push({
        name: product.name.slice(0, 60),
        url: pdpUrl,
        imageUrl: image.url,
        source: image.source,
      });
    }
    products = products.map((p) =>
      p.name === product.name && p.url === product.url
        ? { ...p, imageUrl: image.url }
        : p,
    );
  }

  logger.log(
    `meta.html_enrich domain=${domain} logoStatus=${result.logoStatus} logoSource=${result.logoSource ?? "(none)"} logoUrl=${result.logoUrl ?? "(none)"} productsFetched=${result.productsFetched} productsFilled=${result.productsFilled} samples=${JSON.stringify(result.samples)}`,
  );

  return {
    payload: { ...payload, brand, products },
    result,
  };
}

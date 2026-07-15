import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isRedirectHijack,
  SurfaceScanConnectionFailureError,
} from "../surface-scan-connection-failure.error";
import { SurfaceScanAcquisitionTimeoutError } from "../surface-scan-acquisition-timeout.error";
import type { RawScrapeResult } from "./core-identity.schema";

/**
 * Zyte homepage acquisition.
 * Primary path: cheap httpResponseBody (static HTML) → parse meta / JSON-LD / anchors.
 * Fallback path: browserHtml (Zyte-side JS rendering) for client-rendered sites,
 * priced higher per request — call only when the static scrape leaves gaps.
 */
@Injectable()
export class ZyteHomepageStrategy {
  private readonly logger = new Logger(ZyteHomepageStrategy.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("ZYTE_API_KEY")?.trim());
  }

  /** Cheap static-HTML scrape (httpResponseBody). */
  async scrapeHomepage(targetUrl: string): Promise<RawScrapeResult> {
    const html = await this.fetchZyteHtml(targetUrl, "http");
    return parseHomepageHtml(html, targetUrl);
  }

  /** JS-rendered scrape (browserHtml) — pricier; fallback only. */
  async scrapeHomepageRendered(targetUrl: string): Promise<RawScrapeResult> {
    const html = await this.fetchZyteHtml(targetUrl, "browser");
    return parseHomepageHtml(html, targetUrl);
  }

  private async fetchZyteHtml(
    targetUrl: string,
    mode: "http" | "browser",
  ): Promise<string> {
    const apiKey = this.config.get<string>("ZYTE_API_KEY", "")?.trim();
    if (!apiKey) {
      throw new Error("ZYTE_API_KEY is not configured");
    }
    const apiUrl =
      this.config.get<string>("ZYTE_API_URL")?.trim() ||
      "https://api.zyte.com/v1/extract";
    const configuredTimeout = Number(
      this.config.get<string | number>("ZYTE_REQUEST_TIMEOUT_MS", 15_000),
    );
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 15_000;

    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(
          mode === "http"
            ? { url: targetUrl, httpResponseBody: true }
            : { url: targetUrl, browserHtml: true },
        ),
        signal: abortController.signal,
      });
    } catch (err) {
      if (abortController.signal.aborted) {
        throw new SurfaceScanAcquisitionTimeoutError(timeoutMs);
      }
      // Zyte API itself unreachable: a platform issue, not a target-domain
      // connection failure — keep the message unclassifiable (State F stays off).
      throw new Error(
        `Zyte API unreachable (${err instanceof Error ? err.message : "unknown"})`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      this.logger.warn(
        `zyte ${mode}_fail status=${response.status} body=${body.slice(0, 400)}`,
      );
      // Zyte 520/521 = temporary/permanent download error: the target site
      // could not be reached (dead DNS, refused connection, timeout).
      if (response.status === 520 || response.status === 521) {
        throw new SurfaceScanConnectionFailureError("dns_or_timeout");
      }
      throw new Error(`Zyte request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      httpResponseBody?: string;
      browserHtml?: string;
      statusCode?: number;
      url?: string;
    };

    if (typeof payload.statusCode === "number" && payload.statusCode >= 400) {
      throw new SurfaceScanConnectionFailureError(
        "http_status",
        payload.statusCode,
      );
    }
    if (payload.url && isRedirectHijack(targetUrl, payload.url)) {
      throw new SurfaceScanConnectionFailureError("redirect_hijack");
    }
    // httpResponseBody is base64; browserHtml is plain HTML text.
    const html =
      mode === "http"
        ? payload.httpResponseBody
          ? Buffer.from(payload.httpResponseBody, "base64").toString("utf8")
          : ""
        : (payload.browserHtml ?? "");
    if (!html || html.length < 40) {
      throw new Error(`Zyte returned empty HTML body (${mode})`);
    }

    return html;
  }
}

export function parseHomepageHtml(
  html: string,
  sourceUrl: string,
): RawScrapeResult {
  const ogTitle = matchMeta(html, "og:title") || matchTitle(html);
  const ogImage = matchMeta(html, "og:image");
  const ogDesc =
    matchMeta(html, "og:description") || matchNameMeta(html, "description");
  const jsonLd = extractJsonLdBrand(html);
  const iconLogo = extractIconLogo(html, sourceUrl);

  const socials = extractSocialsFromHtml(html);
  const links = extractSameOriginLinks(html, sourceUrl);

  // JSON-LD logo / og:image are often relative or protocol-relative
  // (e.g. Shopify "//cdn.shopify.com/..."): resolve against the page URL.
  const jsonLdLogo = toAbsoluteUrl(jsonLd.logo, sourceUrl);
  const ogImageLogo = toAbsoluteUrl(ogImage, sourceUrl);
  // Ordered candidates, best first; sites often declare stale JSON-LD logos
  // that 404, so the mirror step can walk the alternates. Placeholder assets
  // (e.g. Shopify's no-image gif) are excluded — a blank "logo" is worse
  // than the initials avatar.
  const logoCandidates = [
    ...new Set(
      [jsonLdLogo, ogImageLogo, iconLogo].filter(
        (u): u is string => Boolean(u) && !isPlaceholderAsset(u as string),
      ),
    ),
  ];

  const brandName = decodeHtmlEntities(jsonLd.name || ogTitle || "");
  const tagline = decodeHtmlEntities(ogDesc ?? "").slice(0, 180);

  return {
    brand_name: brandName || undefined,
    logo_url: logoCandidates[0],
    logo_candidates: logoCandidates,
    country: jsonLd.country || matchMeta(html, "og:locale")?.slice(3, 5)?.toUpperCase(),
    currency: jsonLd.currency,
    tagline: tagline || undefined,
    socials,
    source_url: sourceUrl,
    discovered_links: links,
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
};

/** Scraped meta/JSON-LD text often arrives HTML-encoded (e.g. "Neeman&#39;s"). */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      safeFromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      safeFromCodePoint(Number(dec)),
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
    )
    .trim();
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

const PLACEHOLDER_ASSET_RE =
  /no-?image|placeholder|default[_-]?(image|logo)|blank[._-]|missing[._-]|spacer|1x1|pixel\.(gif|png)/i;

/** Detects stock "image not available" assets (Shopify no-image gif etc.). */
export function isPlaceholderAsset(url: string): boolean {
  return PLACEHOLDER_ASSET_RE.test(url);
}

function matchMeta(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "i",
  );
  return html.match(re)?.[1] || html.match(re2)?.[1];
}

function matchNameMeta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
    "i",
  );
  return html.match(re)?.[1] || html.match(re2)?.[1];
}

function matchTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function toAbsoluteUrl(
  href: string | undefined,
  base: string,
): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

/**
 * Static-HTML icon fallback (same sources Playwright reads from the DOM):
 * apple-touch-icon first (largest/most brand-like), then icon/shortcut icon.
 */
function extractIconLogo(html: string, sourceUrl: string): string | undefined {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const hrefOf = (tag: string): string | undefined =>
    tag.match(/href=["']([^"']+)["']/i)?.[1];
  const relOf = (tag: string): string =>
    tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";

  const byRel = (pattern: RegExp): string | undefined => {
    for (const tag of links) {
      if (pattern.test(relOf(tag))) {
        const href = hrefOf(tag);
        if (href) return href;
      }
    }
    return undefined;
  };

  const candidate =
    byRel(/apple-touch-icon/) || byRel(/^(shortcut )?icon$/) || undefined;
  if (!candidate) return undefined;
  try {
    return new URL(candidate, sourceUrl).toString();
  } catch {
    return undefined;
  }
}

function extractJsonLdBrand(html: string): {
  name?: string;
  logo?: string;
  country?: string;
  currency?: string;
} {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  for (const block of blocks) {
    try {
      const json = JSON.parse(block[1] ?? "") as Record<string, unknown>;
      const nodes = Array.isArray(json)
        ? json
        : Array.isArray(json["@graph"])
          ? (json["@graph"] as Record<string, unknown>[])
          : [json];
      for (const node of nodes) {
        const type = String(node["@type"] ?? "");
        if (/Organization|Brand|LocalBusiness|Store/i.test(type)) {
          const name = typeof node.name === "string" ? node.name : undefined;
          const logo =
            typeof node.logo === "string"
              ? node.logo
              : typeof (node.logo as { url?: string } | undefined)?.url ===
                  "string"
                ? (node.logo as { url: string }).url
                : undefined;
          const address = node.address as
            | { addressCountry?: string }
            | undefined;
          return {
            name,
            logo,
            country: address?.addressCountry?.slice(0, 2)?.toUpperCase(),
            currency:
              typeof node.currenciesAccepted === "string"
                ? node.currenciesAccepted.slice(0, 3).toUpperCase()
                : undefined,
          };
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return {};
}

function extractSocialsFromHtml(html: string): RawScrapeResult["socials"] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  return pickSocials(hrefs);
}

export function pickSocials(
  hrefs: Array<string | undefined | null>,
): RawScrapeResult["socials"] {
  const socials: RawScrapeResult["socials"] = {};
  for (const href of hrefs) {
    if (!href) continue;
    try {
      const u = new URL(href, "https://example.com");
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes("instagram.com") && !socials.instagram) {
        socials.instagram = u.toString();
      } else if (host.includes("tiktok.com") && !socials.tiktok) {
        socials.tiktok = u.toString();
      } else if (
        (host.includes("facebook.com") || host === "fb.com") &&
        !socials.facebook
      ) {
        socials.facebook = u.toString();
      } else if (
        (host.includes("youtube.com") || host === "youtu.be") &&
        !socials.youtube
      ) {
        socials.youtube = u.toString();
      } else if (host.includes("linkedin.com") && !socials.linkedin) {
        socials.linkedin = u.toString();
      }
    } catch {
      // ignore bad hrefs
    }
  }
  return socials;
}

/** Static assets are useless to the Stage 1B crawl planner. */
const ASSET_PATH_RE =
  /\.(css|js|mjs|map|json|xml|txt|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|otf|mp3|mp4|webm|mov|pdf|zip)$/i;

function extractSameOriginLinks(html: string, sourceUrl: string): string[] {
  let origin: string;
  try {
    origin = new URL(sourceUrl).origin;
  } catch {
    return [];
  }
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    try {
      const abs = new URL(href, origin);
      if (abs.origin !== origin) continue;
      // Skip stylesheets, scripts, images, fonts, and CDN asset paths —
      // only navigable pages belong in the crawl-planning inventory.
      if (ASSET_PATH_RE.test(abs.pathname)) continue;
      if (/^\/cdn\//i.test(abs.pathname)) continue;
      abs.hash = "";
      abs.search = "";
      out.add(abs.toString());
    } catch {
      // ignore
    }
  }
  return [...out].slice(0, 40);
}

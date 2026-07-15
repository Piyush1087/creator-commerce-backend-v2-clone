import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isRedirectHijack,
  SurfaceScanConnectionFailureError,
} from "../surface-scan-connection-failure.error";
import type { RawScrapeResult } from "./core-identity.schema";

/**
 * Zyte HTTP homepage acquisition (structured HTML body).
 * Feasibility path: httpResponseBody → parse meta / JSON-LD / anchors.
 */
@Injectable()
export class ZyteHomepageStrategy {
  private readonly logger = new Logger(ZyteHomepageStrategy.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("ZYTE_API_KEY")?.trim());
  }

  async scrapeHomepage(targetUrl: string): Promise<RawScrapeResult> {
    const apiKey = this.config.get<string>("ZYTE_API_KEY", "")?.trim();
    if (!apiKey) {
      throw new Error("ZYTE_API_KEY is not configured");
    }
    const apiUrl =
      this.config.get<string>("ZYTE_API_URL")?.trim() ||
      "https://api.zyte.com/v1/extract";

    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          httpResponseBody: true,
        }),
      });
    } catch (err) {
      // Zyte API itself unreachable: a platform issue, not a target-domain
      // connection failure — keep the message unclassifiable (State F stays off).
      throw new Error(
        `Zyte API unreachable (${err instanceof Error ? err.message : "unknown"})`,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      this.logger.warn(
        `zyte http_fail status=${response.status} body=${body.slice(0, 400)}`,
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
    const html = payload.httpResponseBody
      ? Buffer.from(payload.httpResponseBody, "base64").toString("utf8")
      : "";
    if (!html || html.length < 40) {
      throw new Error("Zyte returned empty HTML body");
    }

    return parseHomepageHtml(html, targetUrl);
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

  const socials = extractSocialsFromHtml(html);
  const links = extractSameOriginLinks(html, sourceUrl);

  return {
    brand_name: jsonLd.name || ogTitle || undefined,
    logo_url: jsonLd.logo || ogImage || undefined,
    country: jsonLd.country || matchMeta(html, "og:locale")?.slice(3, 5)?.toUpperCase(),
    currency: jsonLd.currency,
    tagline: ogDesc?.slice(0, 180) || undefined,
    socials,
    source_url: sourceUrl,
    discovered_links: links,
  };
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
      abs.hash = "";
      abs.search = "";
      out.add(abs.toString());
    } catch {
      // ignore
    }
  }
  return [...out].slice(0, 40);
}

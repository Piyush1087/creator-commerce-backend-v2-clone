import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isRedirectHijack,
  SurfaceScanConnectionFailureError,
} from "../surface-scan-connection-failure.error";
import type { RawScrapeResult } from "./core-identity.schema";
import {
  decodeHtmlEntities,
  isPlaceholderAsset,
  pickSocials,
} from "./zyte-homepage.strategy";

/**
 * Playwright dynamic DOM homepage acquisition (logos + social anchors).
 */
@Injectable()
export class PlaywrightHomepageStrategy {
  private readonly logger = new Logger(PlaywrightHomepageStrategy.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (
      (this.config.get<string>("PLAYWRIGHT_ENABLED", "true") ?? "true")
        .trim()
        .toLowerCase() !== "false"
    );
  }

  async scrapeDynamicDOM(targetUrl: string): Promise<RawScrapeResult> {
    if (!this.isEnabled()) {
      throw new Error("Playwright is disabled");
    }

    const timeoutMs = this.config.get<number>("PLAYWRIGHT_TIMEOUT_MS", 5000);
    // Dynamic import keeps cold starts lighter when Playwright is off.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      const navResponse = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      const navStatus = navResponse?.status();
      if (typeof navStatus === "number" && navStatus >= 400) {
        throw new SurfaceScanConnectionFailureError("http_status", navStatus);
      }
      if (isRedirectHijack(targetUrl, page.url())) {
        throw new SurfaceScanConnectionFailureError("redirect_hijack");
      }
      await new Promise((r) => setTimeout(r, Math.min(800, timeoutMs / 2)));

      const extracted = await page.evaluate(() => {
        const title = document.title || "";
        const ogTitle =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || "";
        const ogImage =
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute("content") || "";
        const ogDesc =
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") ||
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ||
          "";
        const appleTouch =
          document
            .querySelector('link[rel="apple-touch-icon"]')
            ?.getAttribute("href") || "";
        const icon =
          document.querySelector('link[rel="icon"]')?.getAttribute("href") ||
          document
            .querySelector('link[rel="shortcut icon"]')
            ?.getAttribute("href") ||
          "";
        const hrefs = Array.from(document.querySelectorAll("a[href]")).map(
          (a) => (a as HTMLAnchorElement).href,
        );
        const sameOrigin = Array.from(document.querySelectorAll("a[href]"))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => {
            try {
              return new URL(h).origin === location.origin;
            } catch {
              return false;
            }
          });
        return {
          title,
          ogTitle,
          ogImage,
          ogDesc,
          appleTouch,
          icon,
          hrefs,
          sameOrigin,
        };
      });

      const logoCandidates = [
        ...new Set(
          [
            absoluteUrl(extracted.ogImage, targetUrl),
            absoluteUrl(extracted.appleTouch, targetUrl),
            absoluteUrl(extracted.icon, targetUrl),
          ].filter(
            (u): u is string => Boolean(u) && !isPlaceholderAsset(u as string),
          ),
        ),
      ];

      const brandName = decodeHtmlEntities(
        extracted.ogTitle || extracted.title || "",
      );
      const tagline = decodeHtmlEntities(extracted.ogDesc ?? "").slice(0, 180);

      return {
        brand_name: brandName || undefined,
        logo_url: logoCandidates[0],
        logo_candidates: logoCandidates,
        tagline: tagline || undefined,
        socials: pickSocials(extracted.hrefs),
        source_url: targetUrl,
        discovered_links: extracted.sameOrigin.slice(0, 40),
      };
    } catch (err) {
      this.logger.warn(
        `playwright scrape_failed url=${targetUrl} err=${String(err)}`,
      );
      throw err;
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}

function absoluteUrl(
  href: string | undefined | null,
  base: string,
): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

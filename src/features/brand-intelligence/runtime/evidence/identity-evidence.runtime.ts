import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ExecutionTask } from "../compiler/compiler";
import type { EvidenceRuntime } from "../integration/types";

type WebsitePage = {
  url: string;
  page_type: string;
  fetched_at: string;
  acquisition_status: "SUCCEEDED" | "FAILED";
  seo: {
    title: string | null;
    meta_description: string | null;
    canonical_url: string | null;
  };
  structure: {
    header: string | null;
    navigation: string[];
    main_content: string | null;
    footer: string | null;
  };
  content: {
    headings: string[];
    visible_text: string;
    structured_data: unknown[];
  };
  links: {
    internal: string[];
    external: string[];
    social: string[];
  };
  media: {
    logo_candidates: Array<{
      candidate_type: "IMAGE_URL";
      source_location: string;
      source_page_url: string;
      asset_url: string;
      extraction_method: string;
    }>;
  };
  extracted_signals: {
    organization_name_candidates: string[];
    currency_signals: string[];
    geography_signals: string[];
    language_signals: string[];
    address_candidates: string[];
    shipping_or_service_area_statements: string[];
  };
};

type EvidenceBundle = {
  run_id: string;
  website_url: string;
  pages: WebsitePage[];
  site_structure: {
    root_domain: string;
    homepage_url: string;
    discovered_urls: string[];
  };
};

type WarmState =
  | { status: "pending"; promise: Promise<EvidenceBundle> }
  | { status: "ready"; bundle: EvidenceBundle }
  | { status: "failed"; error: Error };

@Injectable()
export class IdentityEvidenceRuntime implements EvidenceRuntime {
  private readonly warm = new Map<string, WarmState>();

  constructor(private readonly config: ConfigService) {}

  async prepareIdentityEvidence(args: {
    websiteUrl: string;
    entityId: string;
  }): Promise<void> {
    const key = this.key(args.entityId, args.websiteUrl);
    if (this.warm.has(key)) return;
    const promise = this.acquireBundle(args.websiteUrl)
      .then((bundle) => {
        this.warm.set(key, { status: "ready", bundle });
        return bundle;
      })
      .catch((error: unknown) => {
        const err =
          error instanceof Error ? error : new Error(String(error));
        this.warm.set(key, { status: "failed", error: err });
        throw err;
      });
    this.warm.set(key, { status: "pending", promise });
    await promise;
  }

  async getEvidence(args: {
    task: ExecutionTask;
    websiteUrl: string;
    entityId: string;
  }): Promise<{ refs?: string[]; content: unknown }> {
    if (
      args.task.processorId === "industry_classification" &&
      args.task.processorScope === "gatekeeper"
    ) {
      return {
        refs: [`website_direct:${args.websiteUrl}`],
        content: {
          access_mode: "website_direct",
          website_url: args.websiteUrl,
        },
      };
    }

    const key = this.key(args.entityId, args.websiteUrl);
    let state = this.warm.get(key);
    if (!state || state.status === "failed") {
      this.warm.delete(key);
      await this.prepareIdentityEvidence({
        websiteUrl: args.websiteUrl,
        entityId: args.entityId,
      });
      state = this.warm.get(key);
    }
    if (!state) {
      throw new Error("Evidence warm-up state missing");
    }
    if (state.status === "pending") {
      await state.promise;
      state = this.warm.get(key);
    }
    if (!state || state.status === "failed") {
      throw (
        (state && state.status === "failed" && state.error) ||
        new Error("Website evidence acquisition failed")
      );
    }
    if (state.status !== "ready") {
      throw new Error("Website evidence not ready");
    }

    const filtered = this.filterForTask(state.bundle, args.task);
    return {
      refs: [
        `evidence_run:${state.bundle.run_id}`,
        ...filtered.pages.map((p) => `page:${p.page_type}:${p.url}`),
      ],
      content: filtered,
    };
  }

  private key(entityId: string, websiteUrl: string): string {
    return `${entityId}::${websiteUrl}`;
  }

  private filterForTask(bundle: EvidenceBundle, task: ExecutionTask) {
    const pageTypes =
      task.processorId === "identity_core"
        ? ["homepage", "about", "contact", "locations"]
        : task.processorId === "industry_classification"
          ? ["homepage", "about", "product", "collection", "service", "offering"]
          : [
              "homepage",
              "about",
              "contact",
              "locations",
              "shipping",
              "service",
              "offering",
              "product",
              "collection",
            ];

    const pages = bundle.pages.filter(
      (p) =>
        p.page_type === "homepage" || pageTypes.includes(p.page_type),
    );
    return {
      ...bundle,
      pages:
        pages.length > 0
          ? pages
          : bundle.pages.filter((p) => p.page_type === "homepage"),
    };
  }

  private async acquireBundle(websiteUrl: string): Promise<EvidenceBundle> {
    const homepageUrl = normalizeUrl(websiteUrl);
    const runId = createHash("sha1")
      .update(`${homepageUrl}:${Date.now()}`)
      .digest("hex")
      .slice(0, 16);
    const fetchedAt = new Date().toISOString();

    const homepageHtml = await this.fetchZyteHtml(homepageUrl);
    const homepage = normalizePage(homepageHtml, homepageUrl, "homepage", fetchedAt);

    const candidateUrls = pickDiscoveryUrls(homepage, homepageUrl, 4);
    const extraPages: WebsitePage[] = [];
    for (const candidate of candidateUrls) {
      try {
        const html = await this.fetchZyteHtml(candidate.url);
        extraPages.push(
          normalizePage(html, candidate.url, candidate.pageType, fetchedAt),
        );
      } catch {
        // optional pages must not block homepage-backed processors
      }
    }

    const pages = [homepage, ...extraPages];
    return {
      run_id: runId,
      website_url: homepageUrl,
      pages,
      site_structure: {
        root_domain: new URL(homepageUrl).hostname,
        homepage_url: homepageUrl,
        discovered_urls: pages.map((p) => p.url),
      },
    };
  }

  private async fetchZyteHtml(targetUrl: string): Promise<string> {
    const apiKey = this.config.get<string>("ZYTE_API_KEY", "")?.trim();
    if (!apiKey) {
      throw new Error("ZYTE_API_KEY is not configured");
    }
    const apiUrl =
      this.config.get<string>("ZYTE_API_URL")?.trim() ||
      "https://api.zyte.com/v1/extract";
    const configuredTimeout = Number(
      this.config.get<string | number>("ZYTE_REQUEST_TIMEOUT_MS", 20_000),
    );
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 20_000;

    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ url: targetUrl, httpResponseBody: true }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        // browser fallback for hard pages
        if (response.status === 520 || response.status === 521) {
          return this.fetchZyteBrowserHtml(targetUrl, apiUrl, auth, timeoutMs);
        }
        throw new Error(`Zyte request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        httpResponseBody?: string;
        statusCode?: number;
      };
      if (typeof payload.statusCode === "number" && payload.statusCode >= 400) {
        throw new Error(`Target returned HTTP ${payload.statusCode}`);
      }
      const html = payload.httpResponseBody
        ? Buffer.from(payload.httpResponseBody, "base64").toString("utf8")
        : "";
      if (!html || html.length < 40) {
        return this.fetchZyteBrowserHtml(targetUrl, apiUrl, auth, timeoutMs);
      }
      return html;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`Zyte request timed out after ${timeoutMs}ms`);
      }
      throw error instanceof Error
        ? error
        : new Error("Zyte request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchZyteBrowserHtml(
    targetUrl: string,
    apiUrl: string,
    auth: string,
    timeoutMs: number,
  ): Promise<string> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ url: targetUrl, browserHtml: true }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Zyte browserHtml failed with status ${response.status}`,
        );
      }
      const payload = (await response.json()) as { browserHtml?: string };
      const html = payload.browserHtml ?? "";
      if (!html || html.length < 40) {
        throw new Error("Zyte returned empty browser HTML");
      }
      return html;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  return url.toString();
}

function normalizePage(
  html: string,
  pageUrl: string,
  pageType: string,
  fetchedAt: string,
): WebsitePage {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const canonical =
    $('link[rel="canonical"]').attr("href")?.trim() || null;

  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const header = $("header").first().text().replace(/\s+/g, " ").trim() || null;
  const footer = $("footer").first().text().replace(/\s+/g, " ").trim() || null;
  const main =
    $("main").first().text().replace(/\s+/g, " ").trim() ||
    $("body").text().replace(/\s+/g, " ").trim().slice(0, 12000) ||
    null;

  const navigation = $("nav a, header a")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const origin = new URL(pageUrl).origin;
  const internal: string[] = [];
  const external: string[] = [];
  const social: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl).toString();
      if (/instagram\.com|youtube\.com|youtu\.be|tiktok\.com|facebook\.com|linkedin\.com/i.test(abs)) {
        social.push(abs);
      } else if (abs.startsWith(origin)) {
        internal.push(abs);
      } else if (abs.startsWith("http")) {
        external.push(abs);
      }
    } catch {
      // ignore bad hrefs
    }
  });

  const logoCandidates: WebsitePage["media"]["logo_candidates"] = [];
  $("header img, nav img, .logo img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;
    try {
      logoCandidates.push({
        candidate_type: "IMAGE_URL",
        source_location: "HEADER",
        source_page_url: pageUrl,
        asset_url: new URL(src, pageUrl).toString(),
        extraction_method: "img_src",
      });
    } catch {
      // ignore
    }
  });

  const structuredData: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      structuredData.push(JSON.parse(raw));
    } catch {
      // ignore invalid json-ld
    }
  });

  const visibleText = (main ?? "").slice(0, 12000);
  const currencySignals = Array.from(
    new Set(
      (visibleText.match(/\b(INR|USD|EUR|GBP|AUD|CAD|JPY|₹|\$|€|£)\b/g) ??
        []).slice(0, 20),
    ),
  );
  const geographySignals = Array.from(
    new Set(
      (visibleText.match(
        /\b(India|United States|USA|UK|United Kingdom|Singapore|UAE|Dubai|Canada|Australia)\b/gi,
      ) ?? []).slice(0, 20),
    ),
  );
  const shippingSignals = Array.from(
    new Set(
      (visibleText.match(
        /(?:ships?|shipping|deliver(?:y|s)?|available)\s+(?:to|in|across)\s+[A-Za-z ,-]{2,40}/gi,
      ) ?? []).slice(0, 20),
    ),
  );

  return {
    url: pageUrl,
    page_type: pageType,
    fetched_at: fetchedAt,
    acquisition_status: "SUCCEEDED",
    seo: {
      title,
      meta_description: metaDescription,
      canonical_url: canonical,
    },
    structure: {
      header: header ? header.slice(0, 2000) : null,
      navigation,
      main_content: main ? main.slice(0, 8000) : null,
      footer: footer ? footer.slice(0, 2000) : null,
    },
    content: {
      headings,
      visible_text: visibleText,
      structured_data: structuredData.slice(0, 10),
    },
    links: {
      internal: unique(internal).slice(0, 80),
      external: unique(external).slice(0, 40),
      social: unique(social).slice(0, 20),
    },
    media: { logo_candidates: logoCandidates.slice(0, 10) },
    extracted_signals: {
      organization_name_candidates: title ? [title] : [],
      currency_signals: currencySignals,
      geography_signals: geographySignals,
      language_signals: [],
      address_candidates: [],
      shipping_or_service_area_statements: shippingSignals,
    },
  };
}

function pickDiscoveryUrls(
  homepage: WebsitePage,
  homepageUrl: string,
  limit: number,
): Array<{ url: string; pageType: string }> {
  const scored: Array<{ url: string; pageType: string; score: number }> = [];
  for (const link of homepage.links.internal) {
    const lower = link.toLowerCase();
    let pageType = "other";
    let score = 0;
    if (/about|our-story|who-we-are/.test(lower)) {
      pageType = "about";
      score = 5;
    } else if (/contact/.test(lower)) {
      pageType = "contact";
      score = 4;
    } else if (/location|store|clinic|branch/.test(lower)) {
      pageType = "locations";
      score = 4;
    } else if (/shipping|delivery/.test(lower)) {
      pageType = "shipping";
      score = 3;
    } else if (/product|collection|shop|pricing|service/.test(lower)) {
      pageType = /service/.test(lower)
        ? "service"
        : /pricing/.test(lower)
          ? "offering"
          : /collection/.test(lower)
            ? "collection"
            : "product";
      score = 2;
    }
    if (score > 0 && link !== homepageUrl) {
      scored.push({ url: link, pageType, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: Array<{ url: string; pageType: string }> = [];
  for (const item of scored) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push({ url: item.url, pageType: item.pageType });
    if (out.length >= limit) break;
  }
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

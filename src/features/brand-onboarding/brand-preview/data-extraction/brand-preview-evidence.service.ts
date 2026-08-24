import { Injectable } from "@nestjs/common";
import * as cheerio from "cheerio";

import { TextContextBuilderService } from "../../surface-scan/stage1b/text-context-builder.service";
import { ZyteHomepageStrategy } from "../../surface-scan/stage1a/zyte-homepage.strategy";
import type { BrandPreviewEvidence } from "../brand-preview.types";
import type { BrandPreviewWebsiteEvidencePort } from "./brand-preview-evidence.port";

const CONTEXT_PATH = /\b(about|our-story|company|mission)\b/i;
const OFFERING_PATH =
  /\b(products?|services?|solutions?|shop|collections?|pricing|book)\b/i;
const CUSTOMER_SIGNAL =
  /\b(customers?|users?|teams?|businesses?|people|famil(?:y|ies)|patients?|clients?|professionals?|creators?|parents?|students?)\b/gi;
const COMMERCIAL_SIGNAL =
  /\b(buy|shop|pricing|plans?|book|booking|download|install|sign\s?up|contact sales|products?|services?|solutions?|platform|app)\b/gi;

@Injectable()
export class BrandPreviewWebsiteEvidenceService implements BrandPreviewWebsiteEvidencePort {
  constructor(
    private readonly contextBuilder: TextContextBuilderService,
    private readonly zyte: ZyteHomepageStrategy,
  ) {}

  async acquire(args: {
    websiteUrl: string;
    sameRunGatekeeperEvidence?: unknown;
  }): Promise<BrandPreviewEvidence> {
    const pages: Array<{ url: string; html: string }> = [];
    const homepage = await this.fetchBounded(args.websiteUrl);
    pages.push({ url: args.websiteUrl, html: homepage });

    const $ = cheerio.load(homepage);
    const brandName = this.brandName($);
    const links = this.sameOriginLinks($, args.websiteUrl);
    const candidates = [
      links.find((url) => CONTEXT_PATH.test(new URL(url).pathname)),
      links.find((url) => OFFERING_PATH.test(new URL(url).pathname)),
    ].filter((value): value is string => Boolean(value));

    for (const url of [...new Set(candidates)].slice(0, 2)) {
      const current = this.contextBuilder.build(pages);
      if (
        this.coverage(current, args.sameRunGatekeeperEvidence, brandName)
          .sufficient
      ) {
        break;
      }
      try {
        pages.push({ url, html: await this.fetchBounded(url) });
      } catch {
        // Optional context pages must not turn a usable homepage into a
        // technical failure. Sufficiency below remains deterministic.
      }
    }

    const built = this.contextBuilder.build(pages);
    const logoUrl = built[0]?.logo ?? null;
    const evidencePages = built
      .filter((page) => page.clean_text.length > 0)
      .map((page) => ({
        url: page.url,
        pageType: page.page_type,
        title: page.title,
        cleanText: page.clean_text,
      }));
    const coverage = this.coverage(
      built,
      args.sameRunGatekeeperEvidence,
      brandName,
    );
    const gatekeeperContext = this.gatekeeperContext(
      args.sameRunGatekeeperEvidence,
      args.websiteUrl,
    );
    if (gatekeeperContext) evidencePages.push(gatekeeperContext);
    return {
      brandName,
      logoUrl,
      pages: evidencePages,
      evidenceRefs: evidencePages.map((page) =>
        page.pageType === "same_run_gatekeeper"
          ? "gatekeeper:same-run"
          : `owned:${page.url}`,
      ),
      sufficientForPreviewSynthesisAttempt: coverage.sufficient,
      coverage: coverage.dimensions,
      availability:
        evidencePages.length > 0
          ? coverage.sufficient
            ? "AVAILABLE"
            : "PARTIALLY_AVAILABLE"
          : "UNAVAILABLE",
      qualityState: coverage.sufficient ? "VALID" : "DEGRADED",
      qualityFlags: coverage.sufficient
        ? []
        : ["EVIDENCE_DIMENSIONS_INSUFFICIENT"],
    };
  }

  private async fetchBounded(url: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "CreatorShopBrandPreview/1.0" },
          redirect: "follow",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const finalUrl = new URL(response.url);
        if (this.apex(finalUrl.hostname) !== this.apex(new URL(url).hostname)) {
          throw new Error("REDIRECT_INTEGRITY_FAILED");
        }
        const html = await response.text();
        if (html.trim().length >= 500) return html;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Selective Zyte HTTP then rendered fallback is encapsulated by fetchHtml.
    }
    if (!this.zyte.isConfigured()) {
      throw new Error("WEBSITE_EVIDENCE_UNAVAILABLE");
    }
    return this.zyte.fetchHtml(url);
  }

  private brandName($: cheerio.CheerioAPI): string | null {
    const candidate =
      $('meta[property="og:site_name"]').attr("content")?.trim() ||
      $("script[type='application/ld+json']")
        .toArray()
        .map((node) => {
          try {
            const value = JSON.parse($(node).text()) as { name?: unknown };
            return typeof value.name === "string" ? value.name.trim() : "";
          } catch {
            return "";
          }
        })
        .find(Boolean) ||
      this.cleanTitle($("title").first().text()) ||
      null;
    return candidate && candidate.length <= 120 ? candidate : null;
  }

  private cleanTitle(value: string): string | null {
    const first = value.split(/\s+[|—–-]\s+/)[0]?.trim() ?? "";
    if (
      !first ||
      first.length > 120 ||
      /^(home|welcome|official site)$/i.test(first)
    ) {
      return null;
    }
    return first;
  }

  private coverage(
    pages: ReturnType<TextContextBuilderService["build"]>,
    gatekeeperEvidence: unknown,
    brandName: string | null,
  ) {
    const text = pages.map((page) => page.clean_text).join(" ");
    const customerSignals = text.match(CUSTOMER_SIGNAL)?.length ?? 0;
    const commercialSignals = text.match(COMMERCIAL_SIGNAL)?.length ?? 0;
    const hasOfferingPage = pages.some((page) =>
      ["offerings", "pricing"].includes(page.page_type),
    );
    const gatekeeperCommercial =
      /"commercial_destination_types"\s*:\s*\[\s*"/i.test(
        JSON.stringify(gatekeeperEvidence ?? {}),
      );
    const brandProposition =
      brandName && text.length >= 300
        ? "PRESENT"
        : text.length >= 150
          ? "WEAK"
          : "ABSENT";
    const customerUseContext =
      customerSignals >= 2
        ? "PRESENT"
        : customerSignals === 1
          ? "WEAK"
          : "ABSENT";
    const commercialOfferingConversion =
      hasOfferingPage || commercialSignals >= 2
        ? "PRESENT"
        : commercialSignals === 1 || gatekeeperCommercial
          ? "WEAK"
          : "ABSENT";
    return {
      dimensions: {
        brandProposition,
        customerUseContext,
        commercialOfferingConversion,
      } as const,
      sufficient:
        brandProposition === "PRESENT" &&
        customerUseContext !== "ABSENT" &&
        commercialOfferingConversion !== "ABSENT" &&
        (customerUseContext === "PRESENT" ||
          commercialOfferingConversion === "PRESENT"),
    };
  }

  private gatekeeperContext(
    value: unknown,
    websiteUrl: string,
  ): {
    url: string;
    pageType: string;
    title: string | undefined;
    cleanText: string;
  } | null {
    if (!value || typeof value !== "object") return null;
    const cleanText = JSON.stringify(value);
    return cleanText.length > 2
      ? {
          url: websiteUrl,
          pageType: "same_run_gatekeeper",
          title: undefined,
          cleanText: cleanText.slice(0, 4_000),
        }
      : null;
  }

  private sameOriginLinks($: cheerio.CheerioAPI, base: string): string[] {
    const apex = this.apex(new URL(base).hostname);
    const links = new Set<string>();
    $("a[href]").each((_, node) => {
      const href = $(node).attr("href");
      if (!href) return;
      try {
        const target = new URL(href, base);
        if (this.apex(target.hostname) !== apex) return;
        target.hash = "";
        links.add(target.toString());
      } catch {
        // Ignore malformed links.
      }
    });
    return [...links];
  }

  private apex(host: string): string {
    return host.toLowerCase().replace(/^www\./, "");
  }
}

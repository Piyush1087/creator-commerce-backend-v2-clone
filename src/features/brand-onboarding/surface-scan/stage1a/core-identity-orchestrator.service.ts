import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";

import {
  CoreIdentitySnapshotSchema,
  type CoreIdentitySnapshot,
  type RawScrapeResult,
} from "./core-identity.schema";
import {
  classifyConnectionFailure,
  pickConnectionFailure,
  SurfaceScanConnectionFailureError,
} from "../surface-scan-connection-failure.error";
import { isSurfaceScanAcquisitionTimeout } from "../surface-scan-acquisition-timeout.error";
import { mergeScrapePayloads } from "./core-identity-merge";
import { PlaywrightHomepageStrategy } from "./playwright-homepage.strategy";
import { ZyteHomepageStrategy } from "./zyte-homepage.strategy";

/**
 * Stage 1A acquisition — Zyte-only, cost-tiered:
 * 1. Cheap Zyte httpResponseBody scrape (static HTML) runs first.
 * 2. Zyte browserHtml (JS-rendered, pricier) runs only as fallback when the
 *    static scrape fails or leaves identity gaps.
 *
 * Playwright is disabled by code for now (pending product decision) but the
 * strategy is kept wired so it can be re-enabled — see the commented block.
 */
@Injectable()
export class CoreIdentityOrchestratorService {
  private readonly logger = new Logger(CoreIdentityOrchestratorService.name);

  constructor(
    private readonly zyte: ZyteHomepageStrategy,
    // Kept injected for future reactivation; not invoked while disabled.
    private readonly playwright: PlaywrightHomepageStrategy,
  ) {}

  async execute(args: {
    scanId?: string;
    targetUrl: string;
    gatekeeperIndustry: string;
    gatekeeperSubIndustry: string;
  }): Promise<CoreIdentitySnapshot> {
    const scanId = args.scanId ?? randomUUID();
    const startedAt = Date.now();
    this.logger.log(`stage1a.start scanId=${scanId} url=${args.targetUrl}`);

    if (!this.zyte.isConfigured()) {
      this.logger.warn("stage1a.no_acquisition_drivers — using fallback");
      return this.buildFallback(scanId, args);
    }

    const rejections: unknown[] = [];

    // Tier 1: cheap static-HTML scrape.
    let httpResult: RawScrapeResult | null = null;
    {
      const t0 = Date.now();
      try {
        httpResult = await this.zyte.scrapeHomepage(args.targetUrl);
        this.logger.log(
          `stage1a.zyte_http_ok ms=${Date.now() - t0} ${describeResult(httpResult)}`,
        );
      } catch (err) {
        this.logger.warn(
          `stage1a.zyte_http_fail ms=${Date.now() - t0} err=${errMessage(err)}`,
        );
        if (isSurfaceScanAcquisitionTimeout(err)) {
          throw err;
        }
        rejections.push(err);
      }
    }

    // Tier 2: JS-rendered browserHtml fallback, only when tier 1 left gaps.
    const renderReason = this.renderedFallbackReason(httpResult);
    let renderedResult: RawScrapeResult | null = null;
    if (renderReason) {
      this.logger.log(`stage1a.zyte_rendered_fallback reason=${renderReason}`);
      const t0 = Date.now();
      try {
        renderedResult = await this.zyte.scrapeHomepageRendered(args.targetUrl);
        this.logger.log(
          `stage1a.zyte_rendered_ok ms=${Date.now() - t0} ${describeResult(renderedResult)}`,
        );
      } catch (err) {
        this.logger.warn(
          `stage1a.zyte_rendered_fail ms=${Date.now() - t0} err=${errMessage(err)}`,
        );
        if (isSurfaceScanAcquisitionTimeout(err)) {
          throw err;
        }
        rejections.push(err);
      }
    }

    // Playwright DOM path — disabled pending product decision on dropping it.
    // To re-enable, restore this block (and see PLAYWRIGHT_* env vars):
    //
    // let playwrightResult: RawScrapeResult | null = null;
    // if (this.playwright.isEnabled()) {
    //   const t0 = Date.now();
    //   try {
    //     playwrightResult = await this.playwright.scrapeDynamicDOM(
    //       args.targetUrl,
    //     );
    //     this.logger.log(
    //       `stage1a.playwright_ok ms=${Date.now() - t0} ${describeResult(playwrightResult)}`,
    //     );
    //   } catch (err) {
    //     this.logger.warn(
    //       `stage1a.playwright_fail ms=${Date.now() - t0} err=${errMessage(err)}`,
    //     );
    //     rejections.push(err);
    //   }
    // }

    if (!httpResult && !renderedResult) {
      // Every attempted path failed. If any failure is connection-level
      // (dead DNS, timeout, 4xx/5xx, redirect hijack), surface State F so
      // the UI shows "Retry Connection Check" instead of a degraded profile.
      const connectionFailures = rejections
        .map((reason) => classifyConnectionFailure(reason))
        .filter((f): f is SurfaceScanConnectionFailureError => f !== null);
      const failure = pickConnectionFailure(connectionFailures);
      if (failure) {
        this.logger.warn(
          `stage1a.connection_failure reason=${failure.reason} status=${failure.httpStatus ?? "-"} totalMs=${Date.now() - startedAt}`,
        );
        throw failure;
      }
      this.logger.warn(
        `stage1a.all_drivers_failed_non_connection — using fallback totalMs=${Date.now() - startedAt}`,
      );
      return this.buildFallback(scanId, args);
    }

    // Rendered result goes in the "playwright" merge slot: same precedence
    // (rendered DOM wins for logo/socials, static JSON-LD wins for name).
    const snapshot = mergeScrapePayloads({
      scanId,
      targetUrl: args.targetUrl,
      industry: args.gatekeeperIndustry,
      subIndustry: args.gatekeeperSubIndustry,
      zyte: httpResult,
      playwright: renderedResult,
    });

    let validated = CoreIdentitySnapshotSchema.safeParse(snapshot);
    if (!validated.success) {
      // Per-field degradation: null out failing optional fields (logo,
      // tagline, socials) instead of discarding the whole good snapshot.
      const failedPaths = validated.error.issues
        .map((issue) => issue.path.join("."))
        .join(",");
      const repaired = repairSnapshotFields(snapshot, validated.error);
      validated = CoreIdentitySnapshotSchema.safeParse(repaired);
      if (validated.success) {
        this.logger.warn(`stage1a.field_degraded paths=${failedPaths}`);
      } else {
        this.logger.error(
          `stage1a.zod_fail ${JSON.stringify(validated.error.format()).slice(0, 800)}`,
        );
        return this.buildFallback(scanId, args);
      }
    }

    this.logger.log(
      `stage1a.ok scanId=${scanId} totalMs=${Date.now() - startedAt} brand=${validated.data.brand_name.value} logo=${validated.data.brand_logo.value ? "yes" : "no"} links=${validated.data.discovered_root_links.length}`,
    );
    return validated.data;
  }

  /**
   * The pricier browserHtml render runs only when the static scrape failed
   * or looks like a client-rendered shell (no name or no anchors at all).
   * A missing logo alone does not justify a render — the static parser
   * already falls back to apple-touch-icon/favicon tags.
   */
  private renderedFallbackReason(
    httpResult: RawScrapeResult | null,
  ): string | null {
    if (!httpResult) return "http_scrape_failed";
    if (!httpResult.brand_name) return "missing_brand_name";
    if ((httpResult.discovered_links?.length ?? 0) === 0) return "no_links";
    return null;
  }

  private buildFallback(
    scanId: string,
    args: {
      targetUrl: string;
      gatekeeperIndustry: string;
      gatekeeperSubIndustry: string;
    },
  ): CoreIdentitySnapshot {
    const snapshot = mergeScrapePayloads({
      scanId,
      targetUrl: args.targetUrl,
      industry: args.gatekeeperIndustry,
      subIndustry: args.gatekeeperSubIndustry,
      zyte: null,
      playwright: null,
    });
    return CoreIdentitySnapshotSchema.parse(snapshot);
  }
}

/**
 * Nulls the optional fields that failed validation (logo, tagline, socials)
 * and drops invalid discovered links, preserving everything that was valid.
 * Required fields (name, url, industry) are never repaired here — if those
 * fail, the caller falls back to the safe snapshot.
 */
function repairSnapshotFields(
  snapshot: CoreIdentitySnapshot,
  error: ZodError,
): CoreIdentitySnapshot {
  const repaired: CoreIdentitySnapshot = {
    ...snapshot,
    brand_logo: { ...snapshot.brand_logo },
    tagline: { ...snapshot.tagline },
    social_handles: {
      ...snapshot.social_handles,
      value: { ...snapshot.social_handles.value },
    },
    discovered_root_links: [...snapshot.discovered_root_links],
  };

  const badLinkIndexes = new Set<number>();
  for (const issue of error.issues) {
    const [root, , key] = issue.path;
    if (root === "brand_logo") {
      repaired.brand_logo.value = null;
      repaired.brand_logo.confidence = 0;
    } else if (root === "tagline") {
      repaired.tagline.value = null;
      repaired.tagline.confidence = 0;
    } else if (root === "social_handles" && typeof key === "string") {
      const socials = repaired.social_handles.value as Record<
        string,
        string | null
      >;
      if (key in socials) {
        socials[key] = null;
      }
    } else if (
      root === "discovered_root_links" &&
      typeof issue.path[1] === "number"
    ) {
      badLinkIndexes.add(issue.path[1]);
    }
  }
  if (badLinkIndexes.size > 0) {
    repaired.discovered_root_links = repaired.discovered_root_links.filter(
      (_, index) => !badLinkIndexes.has(index),
    );
  }
  return repaired;
}

function describeResult(r: RawScrapeResult): string {
  const socials = Object.values(r.socials ?? {}).filter(Boolean).length;
  return `name=${r.brand_name ? "yes" : "no"} logo=${r.logo_url ? "yes" : "no"} country=${r.country ?? "-"} currency=${r.currency ?? "-"} tagline=${r.tagline ? "yes" : "no"} socials=${socials} links=${r.discovered_links?.length ?? 0}`;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

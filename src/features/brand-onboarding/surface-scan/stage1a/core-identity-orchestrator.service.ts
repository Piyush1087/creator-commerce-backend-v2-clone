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

export type CoreIdentityAcquisitionResult = {
  snapshot: CoreIdentitySnapshot;
  /**
   * True when both drivers failed (or none configured) and we built a safe
   * domain-derived snapshot — runner should persist STAGE_1A_FAILED_FALLBACK.
   */
  usedFallback: boolean;
};

/**
 * Stage 1A acquisition — Phase 3 parallel Zyte + Playwright.
 *
 * - Zyte: static HTTP (JSON-LD / OpenGraph / meta / anchors)
 * - Playwright: hydrated DOM (logo finder / social anchors)
 * - Merge: name←Zyte, logo/socials←Playwright (see core-identity-merge)
 * - Both fail → safe fallback snapshot (usedFallback=true)
 *
 * No overall Promise.race timeout — drivers use their own request budgets.
 * Parallel.ai is not used.
 */
@Injectable()
export class CoreIdentityOrchestratorService {
  private readonly logger = new Logger(CoreIdentityOrchestratorService.name);

  constructor(
    private readonly zyte: ZyteHomepageStrategy,
    private readonly playwright: PlaywrightHomepageStrategy,
  ) {}

  async execute(args: {
    scanId?: string;
    targetUrl: string;
    gatekeeperIndustry: string;
    gatekeeperSubIndustry: string;
  }): Promise<CoreIdentityAcquisitionResult> {
    const scanId = args.scanId ?? randomUUID();
    const startedAt = Date.now();
    this.logger.log(`stage1a.start scanId=${scanId} url=${args.targetUrl}`);

    const zyteConfigured = this.zyte.isConfigured();
    const playwrightEnabled = this.playwright.isEnabled();

    if (!zyteConfigured && !playwrightEnabled) {
      this.logger.warn("stage1a.no_acquisition_drivers — using fallback");
      return {
        snapshot: this.buildFallback(scanId, args),
        usedFallback: true,
      };
    }

    // Phase 3: concurrent drivers via Promise.allSettled (no overall race timeout).
    const scrapePromise = Promise.allSettled([
      zyteConfigured
        ? this.zyte.scrapeHomepage(args.targetUrl)
        : Promise.reject(new Error("Zyte not configured")),
      playwrightEnabled
        ? this.playwright.scrapeDynamicDOM(args.targetUrl)
        : Promise.reject(new Error("Playwright disabled")),
    ]);

    const [zyteSettled, playwrightSettled] = await scrapePromise;

    const rawZyte =
      zyteSettled.status === "fulfilled" ? zyteSettled.value : null;
    const rawPlaywright =
      playwrightSettled.status === "fulfilled" ? playwrightSettled.value : null;

    if (zyteSettled.status === "rejected") {
      this.logger.warn(
        `stage1a.zyte_fail err=${errMessage(zyteSettled.reason)}`,
      );
    } else {
      this.logger.log(
        `stage1a.zyte_ok ${describeResult(rawZyte as RawScrapeResult)}`,
      );
    }
    if (playwrightSettled.status === "rejected") {
      this.logger.warn(
        `stage1a.playwright_fail err=${errMessage(playwrightSettled.reason)}`,
      );
    } else {
      this.logger.log(
        `stage1a.playwright_ok ${describeResult(rawPlaywright as RawScrapeResult)}`,
      );
    }

    if (!rawZyte && !rawPlaywright) {
      const rejections: unknown[] = [];
      if (zyteSettled.status === "rejected") {
        rejections.push(zyteSettled.reason);
      }
      if (playwrightSettled.status === "rejected") {
        rejections.push(playwrightSettled.reason);
      }

      // Propagate acquisition timeouts so the scan UI can offer retry.
      for (const reason of rejections) {
        if (isSurfaceScanAcquisitionTimeout(reason)) {
          throw reason;
        }
      }

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
        `stage1a.both_drivers_failed — STAGE_1A_FAILED_FALLBACK totalMs=${Date.now() - startedAt}`,
      );
      return {
        snapshot: this.buildFallback(scanId, args),
        usedFallback: true,
      };
    }

    const snapshot = mergeScrapePayloads({
      scanId,
      targetUrl: args.targetUrl,
      industry: args.gatekeeperIndustry,
      subIndustry: args.gatekeeperSubIndustry,
      zyte: rawZyte,
      playwright: rawPlaywright,
    });

    let validated = CoreIdentitySnapshotSchema.safeParse(snapshot);
    if (!validated.success) {
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
        return {
          snapshot: this.buildFallback(scanId, args),
          usedFallback: true,
        };
      }
    }

    this.logger.log(
      `stage1a.ok scanId=${scanId} totalMs=${Date.now() - startedAt} brand=${validated.data.brand_name.value} logo=${validated.data.brand_logo.value ? "yes" : "no"} zyte=${rawZyte ? "yes" : "no"} pw=${rawPlaywright ? "yes" : "no"} links=${validated.data.discovered_root_links.length}`,
    );
    return { snapshot: validated.data, usedFallback: false };
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

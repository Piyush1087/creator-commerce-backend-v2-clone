import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

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
import { mergeScrapePayloads } from "./core-identity-merge";
import { PlaywrightHomepageStrategy } from "./playwright-homepage.strategy";
import { ZyteHomepageStrategy } from "./zyte-homepage.strategy";

@Injectable()
export class CoreIdentityOrchestratorService {
  private readonly logger = new Logger(CoreIdentityOrchestratorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly zyte: ZyteHomepageStrategy,
    private readonly playwright: PlaywrightHomepageStrategy,
  ) {}

  async execute(args: {
    scanId?: string;
    targetUrl: string;
    gatekeeperIndustry: string;
    gatekeeperSubIndustry: string;
  }): Promise<CoreIdentitySnapshot> {
    const scanId = args.scanId ?? randomUUID();
    this.logger.log(
      `stage1a.start scanId=${scanId} url=${args.targetUrl}`,
    );

    const timeoutMs = this.config.get<number>("STAGE1A_TIMEOUT_MS", 5000);

    const tasks: Array<Promise<RawScrapeResult>> = [];
    if (this.zyte.isConfigured()) {
      tasks.push(this.zyte.scrapeHomepage(args.targetUrl));
    }
    if (this.playwright.isEnabled()) {
      tasks.push(this.playwright.scrapeDynamicDOM(args.targetUrl));
    }

    if (tasks.length === 0) {
      this.logger.warn("stage1a no_acquisition_drivers — using fallback");
      return this.buildFallback(scanId, args);
    }

    let settled: PromiseSettledResult<RawScrapeResult>[] | null = null;
    try {
      settled = await Promise.race([
        Promise.allSettled(tasks),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Stage 1A Processing Timeout")),
            timeoutMs,
          ),
        ),
      ]);
    } catch (err) {
      this.logger.warn(
        `stage1a.timeout_or_fail err=${err instanceof Error ? err.message : String(err)}`,
      );
      // Phase 3 Case B: global Stage 1A timeout is treated as acquisition
      // degradation (valid fallback snapshot for Checkpoint 1), not as a
      // target-domain infrastructure error. Connection-classified failures
      // from both drivers still surface State F below.
      return this.buildFallback(scanId, args);
    }

    const results = settled ?? [];
    // Order: zyte first if configured, then playwright.
    let zyteResult: RawScrapeResult | null = null;
    let playwrightResult: RawScrapeResult | null = null;
    const rejections: unknown[] = [];
    let idx = 0;
    if (this.zyte.isConfigured()) {
      const r = results[idx++];
      zyteResult = r?.status === "fulfilled" ? r.value : null;
      if (r?.status === "rejected") {
        this.logger.warn(`stage1a.zyte_rejected err=${String(r.reason)}`);
        rejections.push(r.reason);
      }
    }
    if (this.playwright.isEnabled()) {
      const r = results[idx++];
      playwrightResult = r?.status === "fulfilled" ? r.value : null;
      if (r?.status === "rejected") {
        this.logger.warn(`stage1a.playwright_rejected err=${String(r.reason)}`);
        rejections.push(r.reason);
      }
    }

    if (!zyteResult && !playwrightResult) {
      // Every configured driver failed. If any failure is connection-level
      // (dead DNS, timeout, 4xx/5xx, redirect hijack), surface State F so
      // the UI shows "Retry Connection Check" instead of a degraded profile.
      const connectionFailures = rejections
        .map((reason) => classifyConnectionFailure(reason))
        .filter((f): f is SurfaceScanConnectionFailureError => f !== null);
      const failure = pickConnectionFailure(connectionFailures);
      if (failure) {
        this.logger.warn(
          `stage1a.connection_failure reason=${failure.reason} status=${failure.httpStatus ?? "-"}`,
        );
        throw failure;
      }
      return this.buildFallback(scanId, args);
    }

    const snapshot = mergeScrapePayloads({
      scanId,
      targetUrl: args.targetUrl,
      industry: args.gatekeeperIndustry,
      subIndustry: args.gatekeeperSubIndustry,
      zyte: zyteResult,
      playwright: playwrightResult,
    });

    const validated = CoreIdentitySnapshotSchema.safeParse(snapshot);
    if (!validated.success) {
      this.logger.error(
        `stage1a.zod_fail ${JSON.stringify(validated.error.format()).slice(0, 800)}`,
      );
      return this.buildFallback(scanId, args);
    }

    this.logger.log(
      `stage1a.ok scanId=${scanId} brand=${validated.data.brand_name.value}`,
    );
    return validated.data;
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

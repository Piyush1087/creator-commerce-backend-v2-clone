import { Injectable, Logger } from "@nestjs/common";
import { BrandIntelligenceStage, type Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { CoreIdentitySnapshot } from "../stage1a/core-identity.schema";
import { ZyteHomepageStrategy } from "../stage1a/zyte-homepage.strategy";
import { BrandDnaEngineService } from "../stage2/brand-dna-engine.service";
import { SnapshotValidationService } from "../stage2/snapshot-validation.service";
import { McpPlannerService } from "./mcp-planner.service";
import type { RuntimeContextPackage } from "./runtime-context.types";
import { TextContextBuilderService } from "./text-context-builder.service";

/**
 * Stage 1B coordinator + Stage 2 driver (Phases 5–7).
 * After Checkpoint 1 confirmation:
 *   MCP plan → parallel Zyte fetch → TextContextBuilder → Prompt A → validate/archive
 */
@Injectable()
export class Stage1bCoordinatorService {
  private readonly logger = new Logger(Stage1bCoordinatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mcpPlanner: McpPlannerService,
    private readonly zyte: ZyteHomepageStrategy,
    private readonly textContext: TextContextBuilderService,
    private readonly brandDnaEngine: BrandDnaEngineService,
    private readonly snapshotValidation: SnapshotValidationService,
  ) {}

  /**
   * @deprecated Prefer BrandIntelligenceJobService enqueue + worker.
   * Kept as a local fallback for manual/dev dispatch only.
   */
  dispatchPipelineInBackground(args: {
    leadId: string;
    brandProfileId?: string;
    authoritativeIdentity: CoreIdentitySnapshot;
  }): void {
    this.logger.warn(
      `pipeline.deprecated_setImmediate leadId=${args.leadId} — use BrandIntelligenceJob queue`,
    );
    setImmediate(() => {
      void this.runPipelineForJob(args).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "unknown";
        this.logger.error(
          `pipeline.unhandled leadId=${args.leadId} err=${message}`,
        );
      });
    });
  }

  /** @deprecated Prefer durable BrandIntelligenceJob enqueue. */
  dispatchInBackground(args: {
    leadId: string;
    brandProfileId: string;
    snapshot: CoreIdentitySnapshot;
  }): void {
    this.dispatchPipelineInBackground({
      leadId: args.leadId,
      brandProfileId: args.brandProfileId,
      authoritativeIdentity: args.snapshot,
    });
  }

  /**
   * Public entry for BrandIntelligenceWorkerService.
   * Throws on hard failure so the worker can mark FAILED / retry.
   */
  async runPipelineForJob(args: {
    leadId: string;
    brandProfileId?: string;
    authoritativeIdentity: CoreIdentitySnapshot;
  }): Promise<void> {
    await this.runPipeline(args);
  }

  private async runPipeline(args: {
    leadId: string;
    brandProfileId?: string;
    authoritativeIdentity: CoreIdentitySnapshot;
  }): Promise<void> {
    const pipelineStartedAt = Date.now();
    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { discoveryLeadId: args.leadId },
    });
    if (!scan) {
      this.logger.error(
        `pipeline.abort leadId=${args.leadId} reason=missing_scan`,
      );
      throw new Error(`BrandIntelligenceScan missing for lead ${args.leadId}`);
    }

    const websiteUrl =
      args.authoritativeIdentity.website_url.value || scan.websiteUrl;

    this.logger.log(
      `pipeline.start leadId=${args.leadId} scanId=${scan.id} links=${args.authoritativeIdentity.discovered_root_links.length}`,
    );

    try {
      // --- Phase 5a: MCP Planner (same-origin filtered) ---
      const planStartedAt = Date.now();
      const plannedUrls = await this.mcpPlanner.generateCrawlStrategy({
        industry: args.authoritativeIdentity.industry.value,
        subIndustry: args.authoritativeIdentity.sub_industry.value,
        discoveredUrls: args.authoritativeIdentity.discovered_root_links,
        websiteUrl,
      });
      this.logger.log(
        `pipeline.plan_ok scanId=${scan.id} urls=${plannedUrls.length} ms=${Date.now() - planStartedAt}`,
      );

      await this.persistTemporaryStage1b(args.leadId, {
        status: "ACQUIRING",
        plannedUrls,
        brandProfileId: args.brandProfileId,
      });

      // --- Phase 5b: Parallel Zyte fetch ---
      const fetchStartedAt = Date.now();
      const fetched = await Promise.all(
        plannedUrls.map(async (url) => {
          try {
            const html = await this.zyte.fetchHtml(url);
            if (!html || html.trim().length < 500) {
              this.logger.warn(
                `pipeline.fetch_skip url=${url} reason=empty_or_short len=${html?.length ?? 0}`,
              );
              return null;
            }
            return { url, html };
          } catch (err) {
            this.logger.warn(
              `pipeline.fetch_fail url=${url} err=${err instanceof Error ? err.message : String(err)}`,
            );
            return null;
          }
        }),
      );

      const pages = fetched.filter(
        (p): p is { url: string; html: string } => p !== null,
      );
      this.logger.log(
        `pipeline.fetch_ok scanId=${scan.id} ok=${pages.length}/${plannedUrls.length} ms=${Date.now() - fetchStartedAt}`,
      );

      if (pages.length === 0) {
        throw new Error(
          "Stage 1B acquired zero pages — all planned URLs failed",
        );
      }

      // --- Phase 5c: Text context builder → full package ---
      const buildStartedAt = Date.now();
      const builtPages = this.textContext.build(pages);
      const runtimeContext = this.assembleRuntimePackage({
        scanId: scan.id,
        brandProfileId: args.brandProfileId ?? scan.brandProfileId ?? undefined,
        websiteUrl,
        identity: args.authoritativeIdentity,
        builtPages,
      });
      const totalChars = runtimeContext.pages.reduce(
        (sum, p) => sum + p.clean_text.length,
        0,
      );
      this.logger.log(
        `pipeline.context_ok scanId=${scan.id} pages=${runtimeContext.pages.length} chars=${totalChars} types=${runtimeContext.pages.map((p) => p.page_type).join(",")} ms=${Date.now() - buildStartedAt}`,
      );

      await this.prisma.brandIntelligenceScan.update({
        where: { id: scan.id },
        data: {
          runtimeContext: runtimeContext as unknown as Prisma.InputJsonValue,
          currentStage: BrandIntelligenceStage.STAGE_1B_COMPLETE,
          errorLogs: null,
        },
      });

      await this.persistTemporaryStage1b(args.leadId, {
        status: "COMPLETE",
        plannedUrls,
        pageCount: pages.length,
        brandProfileId: args.brandProfileId,
        completedAt: new Date().toISOString(),
      });

      this.logger.log(
        `pipeline.stage1b_complete scanId=${scan.id} totalMs=${Date.now() - pipelineStartedAt} → Prompt A`,
      );

      // --- Phase 6–7: Prompt A + validate/archive ---
      const dnaStartedAt = Date.now();
      const raw = await this.brandDnaEngine.extractBrandDna(scan.id);
      await this.snapshotValidation.validateAndArchive(scan.id, raw);

      this.logger.log(
        `pipeline.done scanId=${scan.id} dnaMs=${Date.now() - dnaStartedAt} totalMs=${Date.now() - pipelineStartedAt} stage=STAGE_2_BRAND_DNA_ARCHIVED`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const current = await this.prisma.brandIntelligenceScan.findUnique({
        where: { id: scan.id },
        select: { currentStage: true },
      });
      const stage = current?.currentStage;

      // SnapshotValidation sets NEEDS_REVIEW / archive itself; only mark
      // STAGE_1B_FAILED when we never left the acquisition phase.
      if (stage === BrandIntelligenceStage.CORE_IDENTITY_APPROVED) {
        await this.prisma.brandIntelligenceScan.update({
          where: { id: scan.id },
          data: {
            currentStage: BrandIntelligenceStage.STAGE_1B_FAILED,
            errorLogs: message,
          },
        });
      }

      this.logger.error(
        `pipeline.fail leadId=${args.leadId} scanId=${scan.id} stage=${stage ?? "-"} totalMs=${Date.now() - pipelineStartedAt} err=${message}`,
      );
      throw err instanceof Error ? err : new Error(message);
    }
  }

  private assembleRuntimePackage(args: {
    scanId: string;
    brandProfileId?: string;
    websiteUrl: string;
    identity: CoreIdentitySnapshot;
    builtPages: ReturnType<TextContextBuilderService["build"]>;
  }): RuntimeContextPackage {
    const { identity, builtPages } = args;
    const homepage =
      builtPages.find((p) => p.page_type === "homepage") ?? builtPages[0];
    const about = builtPages.find((p) => p.page_type === "about");

    const navLabels = uniqueStrings(
      builtPages.flatMap((p) => p.nav_labels),
      40,
    );
    const colors = uniqueStrings(
      builtPages.flatMap((p) => p.colors),
      12,
    );
    const fonts = uniqueStrings(
      builtPages.flatMap((p) => p.fonts),
      8,
    );
    const logo =
      identity.brand_logo.value ??
      builtPages.find((p) => p.logo)?.logo ??
      null;

    return {
      execution_context: {
        scan_id: args.scanId,
        brand_id: args.brandProfileId,
        website_url: args.websiteUrl,
        industry: identity.industry.value,
        sub_industry: identity.sub_industry.value,
        timestamp: new Date().toISOString(),
      },
      brand_identity: {
        brand_name: identity.brand_name.value,
        website: identity.website_url.value,
        industry: identity.industry.value,
        sub_industry: identity.sub_industry.value,
        country: identity.country.value,
        reporting_currency: identity.reporting_currency.value,
        social_handles: identity.social_handles.value,
        tagline: identity.tagline.value,
        logo,
      },
      website_summary: {
        homepage_excerpt: homepage?.clean_text.slice(0, 2_000) ?? "",
        about_excerpt: about?.clean_text.slice(0, 2_000),
        nav_labels: navLabels,
      },
      website_assets: {
        logo,
        colors,
        fonts,
      },
      pages: builtPages.map(
        ({ url, page_type, title, clean_text, internal_links }) => ({
          url,
          page_type,
          title,
          clean_text,
          internal_links,
        }),
      ),
      candidate_entities: [],
    };
  }

  private async persistTemporaryStage1b(
    leadId: string,
    stage1b: Record<string, unknown>,
  ): Promise<void> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: { temporaryPayload: true },
    });
    const existingPayload =
      lead?.temporaryPayload &&
      typeof lead.temporaryPayload === "object" &&
      !Array.isArray(lead.temporaryPayload)
        ? (lead.temporaryPayload as Record<string, unknown>)
        : {};

    await this.prisma.discoveryLead.update({
      where: { id: leadId },
      data: {
        temporaryPayload: {
          ...existingPayload,
          stage1b,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

function uniqueStrings(values: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

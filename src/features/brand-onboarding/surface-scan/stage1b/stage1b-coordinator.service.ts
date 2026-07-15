import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { CoreIdentitySnapshot } from "../stage1a/core-identity.schema";
import { McpPlannerService } from "./mcp-planner.service";

/**
 * Stage 1B scaffold (feasibility): after Stage 1A persists, run the MCP
 * planner in the background and store the planned crawl targets on the lead.
 * The actual Stage 1B crawl + Context Builder land in a later phase.
 */
@Injectable()
export class Stage1bCoordinatorService {
  private readonly logger = new Logger(Stage1bCoordinatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mcpPlanner: McpPlannerService,
  ) {}

  /** Fire-and-forget dispatch, mirroring the Brand Centre worker pattern. */
  dispatchInBackground(args: {
    leadId: string;
    brandProfileId: string;
    snapshot: CoreIdentitySnapshot;
  }): void {
    setImmediate(() => {
      void this.run(args).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "unknown";
        this.logger.error(
          `stage1b.dispatch_error leadId=${args.leadId} error=${message}`,
        );
      });
    });
  }

  private async run(args: {
    leadId: string;
    brandProfileId: string;
    snapshot: CoreIdentitySnapshot;
  }): Promise<void> {
    this.logger.log(`stage1b.plan_start leadId=${args.leadId}`);

    const plannedUrls = await this.mcpPlanner.generateCrawlStrategy({
      industry: args.snapshot.industry.value,
      subIndustry: args.snapshot.sub_industry.value,
      discoveredUrls: args.snapshot.discovered_root_links,
    });

    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: args.leadId },
      select: { temporaryPayload: true },
    });
    const existingPayload =
      lead?.temporaryPayload &&
      typeof lead.temporaryPayload === "object" &&
      !Array.isArray(lead.temporaryPayload)
        ? (lead.temporaryPayload as Record<string, unknown>)
        : {};

    await this.prisma.discoveryLead.update({
      where: { id: args.leadId },
      data: {
        temporaryPayload: {
          ...existingPayload,
          stage1b: {
            status: "PLANNED",
            plannedUrls,
            brandProfileId: args.brandProfileId,
            plannedAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `stage1b.plan_saved leadId=${args.leadId} urls=${plannedUrls.length}`,
    );
  }
}

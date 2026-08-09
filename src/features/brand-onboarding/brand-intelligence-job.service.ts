import { Injectable, Logger } from "@nestjs/common";
import {
  BrandIntelligenceJobStatus,
  BrandIntelligenceJobType,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CoreIdentitySnapshot } from "./surface-scan/stage1a/core-identity.schema";

export type Stage1bPipelineJobPayload = {
  leadId: string;
  brandProfileId?: string;
  authoritativeIdentity: CoreIdentitySnapshot;
};

/**
 * Enqueues durable Stage 1B → Prompt A pipeline jobs after Checkpoint 1.
 */
@Injectable()
export class BrandIntelligenceJobService {
  private readonly logger = new Logger(BrandIntelligenceJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueueStage1bPipeline(args: {
    leadId: string;
    brandProfileId?: string;
    scanId?: string | null;
    authoritativeIdentity: CoreIdentitySnapshot;
  }): Promise<{ jobId: string }> {
    const payload: Stage1bPipelineJobPayload = {
      leadId: args.leadId,
      brandProfileId: args.brandProfileId,
      authoritativeIdentity: args.authoritativeIdentity,
    };

    const job = await this.prisma.brandIntelligenceJob.create({
      data: {
        discoveryLeadId: args.leadId,
        scanId: args.scanId ?? null,
        type: BrandIntelligenceJobType.STAGE_1B_PIPELINE,
        status: BrandIntelligenceJobStatus.QUEUED,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    this.logger.log(
      `intelligence.job.queued jobId=${job.id} leadId=${args.leadId} scanId=${args.scanId ?? "-"} type=STAGE_1B_PIPELINE`,
    );
    return { jobId: job.id };
  }
}

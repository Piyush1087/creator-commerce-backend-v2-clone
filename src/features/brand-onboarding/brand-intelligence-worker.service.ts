import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import {
  BrandIntelligenceJobStatus,
  BrandIntelligenceJobType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import {
  CoreIdentitySnapshotSchema,
} from "./surface-scan/stage1a/core-identity.schema";
import { Stage1bCoordinatorService } from "./surface-scan/stage1b/stage1b-coordinator.service";
import type { Stage1bPipelineJobPayload } from "./brand-intelligence-job.service";

const WORKER_ID = `brand-intel-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 5;

type ClaimedIntelligenceJob = {
  id: string;
  attempt: number;
  maxAttempts: number;
  payload: Stage1bPipelineJobPayload;
};

/**
 * Claims QUEUED BrandIntelligenceJob rows and runs Stage 1B → Prompt A.
 * Mirrors NotificationWorkerService (@Interval poll + optimistic claim).
 */
@Injectable()
export class BrandIntelligenceWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BrandIntelligenceWorkerService.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stage1b: Stage1bCoordinatorService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `intelligence.worker.started workerId=${WORKER_ID} intervalMs=${POLL_INTERVAL_MS}`,
    );
  }

  @Interval(POLL_INTERVAL_MS)
  async pollQueue(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      const jobs = await this.claimJobs();
      for (const job of jobs) {
        await this.processClaimedJob(job);
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async claimJobs(): Promise<ClaimedIntelligenceJob[]> {
    const candidates = await this.prisma.brandIntelligenceJob.findMany({
      where: {
        status: BrandIntelligenceJobStatus.QUEUED,
        type: BrandIntelligenceJobType.STAGE_1B_PIPELINE,
      },
      orderBy: { queuedAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    });

    const claimed: ClaimedIntelligenceJob[] = [];

    for (const candidate of candidates) {
      const updated = await this.prisma.brandIntelligenceJob.updateMany({
        where: {
          id: candidate.id,
          status: BrandIntelligenceJobStatus.QUEUED,
        },
        data: {
          status: BrandIntelligenceJobStatus.RUNNING,
          startedAt: new Date(),
          attempt: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        continue;
      }

      const job = await this.prisma.brandIntelligenceJob.findUnique({
        where: { id: candidate.id },
      });
      if (!job) {
        continue;
      }

      const payload = parsePayload(job.payload);
      if (!payload) {
        await this.prisma.brandIntelligenceJob.update({
          where: { id: job.id },
          data: {
            status: BrandIntelligenceJobStatus.FAILED,
            errorMessage: "Invalid STAGE_1B_PIPELINE job payload",
            finishedAt: new Date(),
          },
        });
        this.logger.error(
          `intelligence.job.invalid_payload jobId=${job.id}`,
        );
        continue;
      }

      claimed.push({
        id: job.id,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
        payload,
      });
    }

    return claimed;
  }

  private async processClaimedJob(job: ClaimedIntelligenceJob): Promise<void> {
    try {
      await this.stage1b.runPipelineForJob(job.payload);
      await this.prisma.brandIntelligenceJob.update({
        where: { id: job.id },
        data: {
          status: BrandIntelligenceJobStatus.COMPLETED,
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
      this.logger.log(
        `intelligence.job.completed jobId=${job.id} leadId=${job.payload.leadId} attempt=${job.attempt}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldFail = job.attempt >= job.maxAttempts;

      await this.prisma.brandIntelligenceJob.update({
        where: { id: job.id },
        data: shouldFail
          ? {
              status: BrandIntelligenceJobStatus.FAILED,
              errorMessage: message,
              finishedAt: new Date(),
            }
          : {
              status: BrandIntelligenceJobStatus.QUEUED,
              errorMessage: message,
              startedAt: null,
            },
      });

      this.logger.warn(
        `intelligence.job.${shouldFail ? "failed" : "retry"} jobId=${job.id} leadId=${job.payload.leadId} attempt=${job.attempt} error=${message}`,
      );
    }
  }
}

function parsePayload(raw: unknown): Stage1bPipelineJobPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.leadId !== "string" || !obj.leadId) {
    return null;
  }
  const identity = CoreIdentitySnapshotSchema.safeParse(
    obj.authoritativeIdentity,
  );
  if (!identity.success) {
    return null;
  }
  return {
    leadId: obj.leadId,
    brandProfileId:
      typeof obj.brandProfileId === "string" ? obj.brandProfileId : undefined,
    authoritativeIdentity: identity.data,
  };
}

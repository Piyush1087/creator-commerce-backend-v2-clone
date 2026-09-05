import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { NotificationJobStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import type { ClaimedNotificationJob } from "../types/notifications.types";
import { NotificationProcessorService } from "./notification-processor.service";

const WORKER_ID = `notifications-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;
const RETRY_DELAY_MS = 30_000;
const LEASE_MS = 5 * 60_000;

@Injectable()
export class NotificationWorkerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: NotificationProcessorService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `notification.worker.started workerId=${WORKER_ID} intervalMs=${POLL_INTERVAL_MS}`,
    );
  }

  @Interval(POLL_INTERVAL_MS)
  async pollQueue(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    try {
      await this.reclaimStaleJobs();
      const jobs = await this.claimJobs();
      for (const job of jobs) {
        await this.processClaimedJob(job);
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async reclaimStaleJobs(): Promise<void> {
    const staleBefore = new Date(Date.now() - LEASE_MS);
    await this.prisma.$executeRaw`
      UPDATE notification_jobs
      SET status = 'PENDING', scheduled_at = NOW(), locked_at = NULL,
          locked_by = NULL, claim_token = NULL,
          last_error = 'PROCESSING_LEASE_EXPIRED'
      WHERE status = 'PROCESSING' AND locked_at < ${staleBefore}
        AND attempts < max_attempts
    `;
    await this.prisma.$executeRaw`
      UPDATE notification_jobs
      SET status = 'FAILED', locked_at = NULL, locked_by = NULL,
          claim_token = NULL, last_error = 'MAX_ATTEMPTS_EXHAUSTED'
      WHERE status = 'PROCESSING' AND locked_at < ${staleBefore}
        AND attempts >= max_attempts
    `;
  }

  private async claimJobs(): Promise<ClaimedNotificationJob[]> {
    const candidates = await this.prisma.notificationJob.findMany({
      where: {
        status: NotificationJobStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: BATCH_SIZE,
      select: { id: true },
    });

    const claimed: ClaimedNotificationJob[] = [];

    for (const candidate of candidates) {
      const claimToken = randomUUID();
      const updated = await this.prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE notification_jobs
        SET status = 'PROCESSING', locked_at = NOW(), locked_by = ${WORKER_ID},
            claim_token = ${claimToken}, attempts = attempts + 1
        WHERE id = ${candidate.id} AND status = 'PENDING'
          AND scheduled_at <= NOW() AND attempts < max_attempts
        RETURNING id
      `;

      if (updated.length === 0) {
        continue;
      }

      const job = await this.prisma.notificationJob.findUnique({
        where: { id: candidate.id },
      });

      if (!job) {
        continue;
      }

      claimed.push({
        id: job.id,
        workspaceId: job.workspaceId,
        creatorWorkspaceId: job.creatorWorkspaceId,
        eventType: job.eventType,
        semanticEventKey: job.semanticEventKey,
        claimToken,
        triggerUserId: job.triggerUserId,
        payload: job.payload as ClaimedNotificationJob["payload"],
        actorName: job.actorName,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
    }

    return claimed;
  }

  private async processClaimedJob(job: ClaimedNotificationJob): Promise<void> {
    try {
      await this.processor.processJob(job);
      await this.prisma.notificationJob.updateMany({
        where: {
          id: job.id,
          status: NotificationJobStatus.PROCESSING,
          lockedBy: WORKER_ID,
          claimToken: job.claimToken,
        },
        data: {
          status: NotificationJobStatus.COMPLETED,
          completedAt: new Date(),
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          claimToken: null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldFail = job.attempts >= job.maxAttempts;

      await this.prisma.notificationJob.updateMany({
        where: {
          id: job.id,
          status: NotificationJobStatus.PROCESSING,
          lockedBy: WORKER_ID,
          claimToken: job.claimToken,
        },
        data: shouldFail
          ? {
              status: NotificationJobStatus.FAILED,
              lastError: message,
              lockedAt: null,
              lockedBy: null,
              claimToken: null,
            }
          : {
              status: NotificationJobStatus.PENDING,
              scheduledAt: new Date(
                Date.now() +
                  Math.min(
                    RETRY_DELAY_MS * 2 ** Math.max(job.attempts - 1, 0),
                    30 * 60_000,
                  ),
              ),
              lastError: message,
              lockedAt: null,
              lockedBy: null,
              claimToken: null,
            },
      });

      this.logger.warn(
        `notification.job.${shouldFail ? "failed" : "retry"} jobId=${job.id} attempts=${job.attempts} error=${message}`,
      );
    }
  }
}

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
      const jobs = await this.claimJobs();
      for (const job of jobs) {
        await this.processClaimedJob(job);
      }
    } finally {
      this.isPolling = false;
    }
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
      const updated = await this.prisma.notificationJob.updateMany({
        where: {
          id: candidate.id,
          status: NotificationJobStatus.PENDING,
        },
        data: {
          status: NotificationJobStatus.PROCESSING,
          lockedAt: new Date(),
          lockedBy: WORKER_ID,
          attempts: { increment: 1 },
        },
      });

      if (updated.count === 0) {
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
        eventType: job.eventType,
        urgencyLevel: job.urgencyLevel,
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
      await this.prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.COMPLETED,
          completedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldFail = job.attempts >= job.maxAttempts;

      await this.prisma.notificationJob.update({
        where: { id: job.id },
        data: shouldFail
          ? {
              status: NotificationJobStatus.FAILED,
              lastError: message,
            }
          : {
              status: NotificationJobStatus.PENDING,
              scheduledAt: new Date(Date.now() + RETRY_DELAY_MS),
              lastError: message,
              lockedAt: null,
              lockedBy: null,
            },
      });

      this.logger.warn(
        `notification.job.${shouldFail ? "failed" : "retry"} jobId=${job.id} attempts=${job.attempts} error=${message}`,
      );
    }
  }
}

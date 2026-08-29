import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { NotificationEmailDeliveryStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationChannelService } from "./notification-channel.service";
import { classifyNotificationProviderFailure } from "./notification-provider-outcome";

const EMAIL_WORKER_ID = `notification-email-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = 5_000;
const LEASE_MS = 5 * 60_000;
const HEARTBEAT_MS = 60_000;
const BATCH_SIZE = 20;

@Injectable()
export class NotificationEmailWorkerService implements OnModuleInit {
  private readonly logger = new Logger(NotificationEmailWorkerService.name);
  private polling = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: NotificationChannelService,
  ) {}
  onModuleInit(): void {
    this.logger.log(
      `notification.email-worker.started workerId=${EMAIL_WORKER_ID}`,
    );
  }

  @Interval(POLL_INTERVAL_MS)
  async pollQueue(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await this.reclaimStale();
      await this.prisma.$executeRaw`
        UPDATE notification_email_deliveries
        SET status = 'FAILED_TERMINAL', last_error = 'MAX_ATTEMPTS_EXHAUSTED', updated_at = NOW()
        WHERE status = 'FAILED_RETRYABLE' AND attempts >= max_attempts
      `;
      const candidates = await this.prisma.notificationEmailDelivery.findMany({
        where: {
          status: {
            in: [
              NotificationEmailDeliveryStatus.PENDING,
              NotificationEmailDeliveryStatus.FAILED_RETRYABLE,
            ],
          },
          scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
        take: BATCH_SIZE,
        select: { id: true },
      });
      for (const candidate of candidates)
        await this.claimAndDeliver(candidate.id);
    } finally {
      this.polling = false;
    }
  }

  private async reclaimStale(): Promise<void> {
    const staleBefore = new Date(Date.now() - LEASE_MS);
    await this.prisma.$executeRaw`
      UPDATE notification_email_deliveries
      SET status = 'FAILED_RETRYABLE', locked_at = NULL, locked_by = NULL,
          claim_token = NULL, scheduled_at = NOW(), last_error = 'PRE_PROVIDER_LEASE_EXPIRED', updated_at = NOW()
      WHERE status = 'PROCESSING' AND locked_at < ${staleBefore}
        AND provider_send_started_at IS NULL AND attempts < max_attempts
    `;
    await this.prisma.notificationEmailDelivery.updateMany({
      where: {
        status: NotificationEmailDeliveryStatus.PROCESSING,
        lockedAt: { lt: staleBefore },
        providerSendStartedAt: { not: null },
      },
      data: {
        status: NotificationEmailDeliveryStatus.FAILED_TERMINAL,
        lockedAt: null,
        lockedBy: null,
        claimToken: null,
        lastError: "AMBIGUOUS_PROVIDER_RESULT: provider-started lease expired",
      },
    });
    await this.prisma.$executeRaw`
      UPDATE notification_email_deliveries
      SET status = 'FAILED_TERMINAL', locked_at = NULL, locked_by = NULL,
          claim_token = NULL, last_error = 'MAX_ATTEMPTS_EXHAUSTED', updated_at = NOW()
      WHERE status = 'PROCESSING' AND locked_at < ${staleBefore}
        AND provider_send_started_at IS NULL AND attempts >= max_attempts
    `;
  }

  private async claimAndDeliver(id: string): Promise<void> {
    const claimToken = randomUUID();
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE notification_email_deliveries
      SET status = 'PROCESSING', locked_at = NOW(), locked_by = ${EMAIL_WORKER_ID},
          claim_token = ${claimToken}, provider_send_started_at = NULL,
          attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${id} AND status IN ('PENDING', 'FAILED_RETRYABLE')
        AND scheduled_at <= NOW() AND attempts < max_attempts
      RETURNING id
    `;
    if (claimed.length !== 1) return;
    const delivery =
      await this.prisma.notificationEmailDelivery.findUniqueOrThrow({
        where: { id },
        include: { notification: true, user: { select: { name: true } } },
      });
    let providerStarted = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      this.channels.assertEmailConfigured(delivery.notification.eventType);
      const started = await this.prisma.notificationEmailDelivery.updateMany({
        where: {
          id,
          status: NotificationEmailDeliveryStatus.PROCESSING,
          lockedBy: EMAIL_WORKER_ID,
          claimToken,
        },
        data: { providerSendStartedAt: new Date(), lockedAt: new Date() },
      });
      if (started.count !== 1) return;
      providerStarted = true;
      heartbeat = setInterval(() => {
        void this.prisma.notificationEmailDelivery.updateMany({
          where: {
            id,
            status: NotificationEmailDeliveryStatus.PROCESSING,
            lockedBy: EMAIL_WORKER_ID,
            claimToken,
          },
          data: { lockedAt: new Date() },
        });
      }, HEARTBEAT_MS);
      const response = await this.channels.deliverEmail({
        targetEmail: delivery.targetEmail,
        recipientName: delivery.user.name,
        eventType: delivery.notification.eventType,
        payload: delivery.notification.payload as Record<string, unknown>,
      });
      const saved = await this.prisma.notificationEmailDelivery.updateMany({
        where: {
          id,
          status: NotificationEmailDeliveryStatus.PROCESSING,
          lockedBy: EMAIL_WORKER_ID,
          claimToken,
        },
        data: {
          status: NotificationEmailDeliveryStatus.SENT,
          providerMessageId: response.MessageID ?? null,
          sentAt: new Date(),
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          claimToken: null,
        },
      });
      if (saved.count === 1 && delivery.recipientId) {
        await this.prisma.notificationRecipient.update({
          where: { id: delivery.recipientId },
          data: { isEmailed: true },
        });
      }
    } catch (error: unknown) {
      const outcome = classifyNotificationProviderFailure(
        error,
        providerStarted,
      );
      const terminal =
        outcome.disposition !== "RETRYABLE" ||
        delivery.attempts >= delivery.maxAttempts;
      const delay = Math.min(
        30_000 * 2 ** Math.max(delivery.attempts - 1, 0),
        30 * 60_000,
      );
      await this.prisma.notificationEmailDelivery.updateMany({
        where: {
          id,
          status: NotificationEmailDeliveryStatus.PROCESSING,
          lockedBy: EMAIL_WORKER_ID,
          claimToken,
        },
        data: {
          status: terminal
            ? NotificationEmailDeliveryStatus.FAILED_TERMINAL
            : NotificationEmailDeliveryStatus.FAILED_RETRYABLE,
          scheduledAt: terminal
            ? delivery.scheduledAt
            : new Date(Date.now() + delay),
          lastError: outcome.diagnostic,
          lockedAt: null,
          lockedBy: null,
          claimToken: null,
        },
      });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }
}

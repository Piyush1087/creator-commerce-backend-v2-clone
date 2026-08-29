import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { NotificationEmailDeliveryStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationChannelService } from "./notification-channel.service";

const EMAIL_WORKER_ID = `notification-email-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL_MS = 5_000;
const LEASE_MS = 5 * 60_000;
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
    await this.prisma.notificationEmailDelivery.updateMany({
      where: {
        status: NotificationEmailDeliveryStatus.PROCESSING,
        lockedAt: { lt: new Date(Date.now() - LEASE_MS) },
      },
      data: {
        status: NotificationEmailDeliveryStatus.FAILED_RETRYABLE,
        lockedAt: null,
        lockedBy: null,
        scheduledAt: new Date(),
        lastError: "Delivery lease expired before outcome was persisted",
      },
    });
  }

  private async claimAndDeliver(id: string): Promise<void> {
    const claimed = await this.prisma.notificationEmailDelivery.updateMany({
      where: {
        id,
        status: {
          in: [
            NotificationEmailDeliveryStatus.PENDING,
            NotificationEmailDeliveryStatus.FAILED_RETRYABLE,
          ],
        },
        scheduledAt: { lte: new Date() },
      },
      data: {
        status: NotificationEmailDeliveryStatus.PROCESSING,
        lockedAt: new Date(),
        lockedBy: EMAIL_WORKER_ID,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return;
    const delivery =
      await this.prisma.notificationEmailDelivery.findUniqueOrThrow({
        where: { id },
        include: { notification: true, user: { select: { name: true } } },
      });
    try {
      const response = await this.channels.deliverEmail({
        targetEmail: delivery.targetEmail,
        recipientName: delivery.user.name,
        eventType: delivery.notification.eventType,
        payload: delivery.notification.payload as Record<string, unknown>,
      });
      await this.prisma.$transaction([
        this.prisma.notificationEmailDelivery.update({
          where: { id },
          data: {
            status: NotificationEmailDeliveryStatus.SENT,
            providerMessageId: response.MessageID ?? null,
            sentAt: new Date(),
            lastError: null,
            lockedAt: null,
            lockedBy: null,
          },
        }),
        ...(delivery.recipientId
          ? [
              this.prisma.notificationRecipient.update({
                where: { id: delivery.recipientId },
                data: { isEmailed: true },
              }),
            ]
          : []),
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const ambiguous =
        /timeout|timed out|socket hang up|connection reset|econnreset/i.test(
          message,
        );
      const terminal = ambiguous || delivery.attempts >= delivery.maxAttempts;
      const delay = Math.min(
        30_000 * 2 ** Math.max(delivery.attempts - 1, 0),
        30 * 60_000,
      );
      await this.prisma.notificationEmailDelivery.update({
        where: { id },
        data: {
          status: terminal
            ? NotificationEmailDeliveryStatus.FAILED_TERMINAL
            : NotificationEmailDeliveryStatus.FAILED_RETRYABLE,
          scheduledAt: terminal
            ? delivery.scheduledAt
            : new Date(Date.now() + delay),
          lastError: ambiguous
            ? `AMBIGUOUS_PROVIDER_RESULT: ${message}`
            : message,
          lockedAt: null,
          lockedBy: null,
        },
      });
    }
  }
}

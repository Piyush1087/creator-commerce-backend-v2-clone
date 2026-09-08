import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import { PrismaService } from "../../../prisma/prisma.service";
import { getEventDefinition } from "../config/notification-event-registry";
import type {
  ClaimedNotificationJob,
  NotificationRealtimePayload,
} from "../types/notifications.types";

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);
  private server: Server | null = null;
  constructor(private readonly prisma: PrismaService) {}

  attachServer(server: Server): void {
    this.server = server;
    this.logger.log("notification-realtime.server-attached");
  }

  async processJob(job: ClaimedNotificationJob): Promise<void> {
    const definition = getEventDefinition(job.eventType);
    if (!definition)
      throw new Error(`Unknown notification event: ${job.eventType}`);
    if (
      Boolean(job.workspaceId) === Boolean(job.creatorWorkspaceId) ||
      Boolean(job.creatorWorkspaceId) !==
        (definition.recipientPolicy === "CREATOR_WORKSPACE_ACTIVE_TEAM")
    )
      throw new Error("NOTIFICATION_SCOPE_INVALID");
    const result = await this.prisma.$transaction(async (tx) => {
      const snapshots = await tx.notificationJobRecipient.findMany({
        where: { jobId: job.id },
        orderBy: { createdAt: "asc" },
      });
      const notification = await tx.notification.upsert({
        where: {
          ...(job.creatorWorkspaceId
            ? {
                creatorWorkspaceId_eventType_semanticEventKey: {
                  creatorWorkspaceId: job.creatorWorkspaceId,
                  eventType: definition.eventType,
                  semanticEventKey: job.semanticEventKey,
                },
              }
            : {
                workspaceId_eventType_semanticEventKey: {
                  workspaceId: job.workspaceId!,
                  eventType: definition.eventType,
                  semanticEventKey: job.semanticEventKey,
                },
              }),
        },
        create: {
          workspaceId: job.workspaceId,
          creatorWorkspaceId: job.creatorWorkspaceId,
          triggerUserId: job.triggerUserId,
          eventType: definition.eventType,
          urgencyLevel: definition.urgencyLevel,
          semanticEventKey: job.semanticEventKey,
          category: definition.category,
          actionable: definition.actionable,
          emailPolicy: definition.emailPolicy,
          inAppPolicy: definition.inAppPolicy,
          payload: job.payload as Prisma.InputJsonValue,
        },
        update: {},
      });
      for (const snapshot of snapshots) {
        const recipient = snapshot.inboxObligation
          ? await tx.notificationRecipient.upsert({
              where: {
                notificationId_userId: {
                  notificationId: notification.id,
                  userId: snapshot.userId,
                },
              },
              create: {
                notificationId: notification.id,
                userId: snapshot.userId,
              },
              update: {},
            })
          : null;
        await tx.notificationEmailDelivery.upsert({
          where: {
            notificationId_userId: {
              notificationId: notification.id,
              userId: snapshot.userId,
            },
          },
          create: {
            notificationId: notification.id,
            userId: snapshot.userId,
            recipientId: recipient?.id ?? null,
            targetEmail: snapshot.targetEmail,
            status: snapshot.emailStatus,
          },
          update: {},
        });
      }
      const first = await tx.notificationJob.updateMany({
        where: { id: job.id, materializedAt: null },
        data: { materializedAt: new Date() },
      });
      return {
        notification,
        snapshots,
        firstMaterialization: first.count === 1,
      };
    });

    if (result.firstMaterialization && definition.inAppPolicy !== "NONE") {
      const payload: NotificationRealtimePayload = {
        id: result.notification.id,
        event_type: definition.eventType,
        category: definition.category,
        urgency_level: definition.urgencyLevel,
        actionable: definition.actionable,
        payload: result.notification.payload as Record<string, unknown>,
        created_at: result.notification.createdAt.toISOString(),
      };
      await this.pushRealtime(
        result.snapshots
          .filter((row) => row.inboxObligation)
          .map((row) => row.userId),
        payload,
      );
    }
  }

  private async pushRealtime(
    userIds: string[],
    payload: NotificationRealtimePayload,
  ): Promise<void> {
    if (!this.server) return;
    for (const userId of userIds)
      this.server.to(`user:${userId}`).emit("notification:new", payload);
  }
}

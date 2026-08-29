import { Injectable, Logger } from "@nestjs/common";
import { NotificationEmailDeliveryStatus, Prisma } from "@prisma/client";
import type { Server } from "socket.io";
import { PrismaService } from "../../../prisma/prisma.service";
import { getEventDefinition } from "../config/notification-event-registry";
import type {
  ClaimedNotificationJob,
  NotificationRealtimePayload,
} from "../types/notifications.types";
import { NotificationRecipientPolicyService } from "./notification-recipient-policy.service";

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);
  private server: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipientPolicies: NotificationRecipientPolicyService,
  ) {}

  attachServer(server: Server): void {
    this.server = server;
    this.logger.log("notification-realtime.server-attached");
  }

  async processJob(job: ClaimedNotificationJob): Promise<void> {
    const definition = getEventDefinition(job.eventType);
    if (!definition)
      throw new Error(`Unknown notification event: ${job.eventType}`);
    const affectedUserId =
      typeof job.payload._affected_user_id === "string"
        ? job.payload._affected_user_id
        : null;
    const members = await this.recipientPolicies.resolve({
      workspaceId: job.workspaceId,
      policy: definition.recipientPolicy,
      triggerUserId: job.triggerUserId,
      affectedUserId,
    });

    let created = false;
    let notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          workspaceId: job.workspaceId,
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
      });
      created = true;
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      notification = await this.prisma.notification.findUniqueOrThrow({
        where: {
          workspaceId_eventType_semanticEventKey: {
            workspaceId: job.workspaceId,
            eventType: definition.eventType,
            semanticEventKey: job.semanticEventKey,
          },
        },
      });
    }

    const preferences =
      await this.prisma.userBrandNotificationPreference.findMany({
        where: {
          brandProfileId: job.workspaceId,
          userId: { in: members.map((member) => member.userId) },
          category: definition.category,
        },
      });
    const preferenceByUser = new Map(
      preferences.map((row) => [row.userId, row.optionalEmailEnabled]),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const member of members) {
        const recipient =
          member.inbox && definition.inAppPolicy !== "NONE"
            ? await tx.notificationRecipient.upsert({
                where: {
                  notificationId_userId: {
                    notificationId: notification.id,
                    userId: member.userId,
                  },
                },
                create: {
                  notificationId: notification.id,
                  userId: member.userId,
                },
                update: {},
              })
            : null;
        const emailDue =
          definition.emailPolicy === "MANDATORY" ||
          (definition.emailPolicy === "OPTIONAL" &&
            (preferenceByUser.get(member.userId) ?? true));
        await tx.notificationEmailDelivery.upsert({
          where: {
            notificationId_userId: {
              notificationId: notification.id,
              userId: member.userId,
            },
          },
          create: {
            notificationId: notification.id,
            userId: member.userId,
            recipientId: recipient?.id ?? null,
            targetEmail: member.email,
            status: emailDue
              ? NotificationEmailDeliveryStatus.PENDING
              : NotificationEmailDeliveryStatus.NOT_REQUIRED,
          },
          update: {},
        });
      }
    });

    if (created && definition.inAppPolicy !== "NONE") {
      const payload: NotificationRealtimePayload = {
        id: notification.id,
        event_type: definition.eventType,
        category: definition.category,
        urgency_level: definition.urgencyLevel,
        actionable: definition.actionable,
        payload: notification.payload as Record<string, unknown>,
        created_at: notification.createdAt.toISOString(),
      };
      await this.pushRealtime(
        members.filter((member) => member.inbox).map((member) => member.userId),
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

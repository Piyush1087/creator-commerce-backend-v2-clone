import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Server } from "socket.io";

import { PrismaService } from "../../../prisma/prisma.service";
import { getEventDefinition } from "../config/notification-event-registry";
import type {
  ClaimedNotificationJob,
  NotificationRealtimePayload,
} from "../types/notifications.types";
import { aggregatePayload } from "../utils/notification-aggregation.util";
import { AGGREGATION_WINDOW_MS } from "../config/notification-event-registry";
import { NotificationChannelService } from "./notification-channel.service";

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);
  private server: Server | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: NotificationChannelService,
  ) {}

  attachServer(server: Server): void {
    this.server = server;
    this.logger.log("notification-realtime.server-attached");
  }

  async processJob(job: ClaimedNotificationJob): Promise<void> {
    const definition = getEventDefinition(job.eventType);
    if (!definition) {
      throw new Error(`Unknown notification event: ${job.eventType}`);
    }

    const members = await this.resolveWorkspaceMembers(job.workspaceId);
    if (members.length === 0) {
      this.logger.warn(
        `notification.processor.no-recipients workspace=${job.workspaceId} event=${job.eventType}`,
      );
      return;
    }

    const windowStart = new Date(Date.now() - AGGREGATION_WINDOW_MS);
    const shouldAggregate = definition.aggregatable;

    if (shouldAggregate) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          workspaceId: job.workspaceId,
          eventType: job.eventType,
          createdAt: { gte: windowStart },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        const updatedPayload = aggregatePayload(
          existing.payload as Record<string, unknown>,
          job.actorName,
          job.payload,
        );

        const updated = await this.prisma.notification.update({
          where: { id: existing.id },
          data: {
            payload: updatedPayload as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });

        await this.pushRealtime(
          members.map((member) => member.userId),
          {
            id: updated.id,
            event_type: definition.eventType,
            urgency_level: updated.urgencyLevel,
            payload: updatedPayload,
            created_at: updated.updatedAt.toISOString(),
            is_aggregated: true,
          },
        );

        return;
      }
    }

    const notification = await this.prisma.notification.create({
      data: {
        workspaceId: job.workspaceId,
        triggerUserId: job.triggerUserId,
        eventType: job.eventType,
        urgencyLevel: job.urgencyLevel,
        payload: job.payload as Prisma.InputJsonValue,
      },
    });

    await this.prisma.notificationRecipient.createMany({
      data: members.map((member) => ({
        notificationId: notification.id,
        userId: member.userId,
      })),
      skipDuplicates: true,
    });

    const payload = notification.payload as Record<string, unknown>;

    const inAppEnabled =
      definition.inApp &&
      (await this.channels.isInAppEnabled(
        job.workspaceId,
        definition.settingsCategory,
      ));

    if (inAppEnabled) {
      await this.pushRealtime(
        members.map((member) => member.userId),
        {
          id: notification.id,
          event_type: definition.eventType,
          urgency_level: notification.urgencyLevel,
          payload,
          created_at: notification.createdAt.toISOString(),
        },
      );
    }

    await this.channels.deliverChannels({
      workspaceId: job.workspaceId,
      notificationId: notification.id,
      eventType: definition.eventType,
      payload,
      members,
    });
  }

  private async resolveWorkspaceMembers(workspaceId: string) {
    const rows = await this.prisma.brandTeamMember.findMany({
      where: { brandProfileId: workspaceId, isActive: true },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    return rows.map((row) => ({
      userId: row.userId,
      email: row.user.email,
      name: row.user.name,
    }));
  }

  private async pushRealtime(
    userIds: string[],
    payload: NotificationRealtimePayload,
  ): Promise<void> {
    if (!this.server) {
      return;
    }

    for (const userId of userIds) {
      this.server.to(`user:${userId}`).emit("notification:new", payload);
    }
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { NotificationAccessService } from "./notification-access.service";

@Injectable()
export class NotificationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: NotificationAccessService,
  ) {}

  async listForUser(
    user: AuthUser,
    query: { unread_only?: boolean; limit?: number },
  ) {
    const { brandProfileId, userId } =
      await this.access.resolveBrandWorkspace(user);
    const limit = Math.min(query.limit ?? 50, 100);

    const rows = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
        ...(query.unread_only ? { isRead: false } : {}),
        notification: { workspaceId: brandProfileId },
      },
      include: {
        notification: true,
      },
      orderBy: { notification: { createdAt: "desc" } },
      take: limit,
    });

    return {
      notifications: rows.map((row) => ({
        id: row.notification.id,
        event_type: row.notification.eventType,
        category: row.notification.category,
        urgency_level: row.notification.urgencyLevel,
        actionable: row.notification.actionable,
        payload: row.notification.payload,
        created_at: row.notification.createdAt.toISOString(),
        is_read: row.isRead,
        is_emailed: row.isEmailed,
        read_at: row.readAt?.toISOString() ?? null,
      })),
    };
  }

  async unreadCount(user: AuthUser) {
    const { brandProfileId, userId } =
      await this.access.resolveBrandWorkspace(user);

    const count = await this.prisma.notificationRecipient.count({
      where: {
        userId,
        isRead: false,
        notification: { workspaceId: brandProfileId },
      },
    });

    return { unread_count: count };
  }

  async markRead(user: AuthUser, notificationId: string) {
    const { brandProfileId, userId } =
      await this.access.resolveBrandWorkspace(user);

    const recipient = await this.prisma.notificationRecipient.findFirst({
      where: {
        notificationId,
        userId,
        notification: { workspaceId: brandProfileId },
      },
    });

    if (!recipient) {
      throw new NotFoundException("Notification not found");
    }

    const updated = recipient.isRead
      ? recipient
      : await this.prisma.notificationRecipient.update({
          where: { id: recipient.id },
          data: { isRead: true, readAt: new Date() },
        });

    return {
      notification_id: notificationId,
      is_read: updated.isRead,
      read_at: updated.readAt?.toISOString() ?? null,
    };
  }

  async markAllRead(user: AuthUser) {
    const { brandProfileId, userId } =
      await this.access.resolveBrandWorkspace(user);

    const result = await this.prisma.notificationRecipient.updateMany({
      where: {
        userId,
        isRead: false,
        notification: { workspaceId: brandProfileId },
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated_count: result.count };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { lockCreatorTeam } from "../../creator-settings/team/creator-team.policy";

@Injectable()
export class CreatorNotificationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  private async scoped<T>(
    user: AuthUser,
    read: (
      tx: Prisma.TransactionClient,
      where: Prisma.NotificationRecipientWhereInput,
    ) => Promise<T>,
  ) {
    const preliminary = await this.actors.resolve(user);
    return this.prisma.$transaction(async (tx) => {
      await lockCreatorTeam(tx, preliminary.workspaceId);
      const actor = await this.actors.resolveInTransaction(
        tx,
        user,
        preliminary.workspaceId,
      );
      return read(tx, {
        userId: actor.actorUserId,
        notification: {
          creatorWorkspaceId: actor.workspaceId,
          workspaceId: null,
        },
      });
    });
  }

  listForUser(
    user: AuthUser,
    query: { unread_only?: boolean; limit?: number },
  ) {
    return this.scoped(user, async (tx, where) => {
      const rows = await tx.notificationRecipient.findMany({
        where: { ...where, ...(query.unread_only ? { isRead: false } : {}) },
        include: { notification: true },
        orderBy: [{ notification: { createdAt: "desc" } }, { id: "desc" }],
        take: Math.max(1, Math.min(query.limit ?? 50, 100)),
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
    });
  }
  unreadCount(user: AuthUser) {
    return this.scoped(user, async (tx, where) => ({
      unread_count: await tx.notificationRecipient.count({
        where: { ...where, isRead: false },
      }),
    }));
  }
  markRead(user: AuthUser, notificationId: string) {
    return this.scoped(user, async (tx, where) => {
      const recipient = await tx.notificationRecipient.findFirst({
        where: { ...where, notificationId },
      });
      if (!recipient) throw new NotFoundException("Notification not found");
      const updated = recipient.isRead
        ? recipient
        : await tx.notificationRecipient.update({
            where: { id: recipient.id },
            data: { isRead: true, readAt: new Date() },
          });
      return {
        notification_id: notificationId,
        is_read: updated.isRead,
        read_at: updated.readAt?.toISOString() ?? null,
      };
    });
  }
  markAllRead(user: AuthUser) {
    return this.scoped(user, async (tx, where) => ({
      updated_count: (
        await tx.notificationRecipient.updateMany({
          where: { ...where, isRead: false },
          data: { isRead: true, readAt: new Date() },
        })
      ).count,
    }));
  }
}

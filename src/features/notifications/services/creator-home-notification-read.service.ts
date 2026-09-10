import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";

const EXCLUDED_PREFIXES = [
  "billing.",
  "escrow.",
  "intelligence.",
  "payout.",
  "provider.",
] as const;

export function creatorHomeNotificationRecipientWhere(
  actor: CreatorWorkspaceActorContext,
): Prisma.NotificationRecipientWhereInput {
  return {
    userId: actor.actorUserId,
    notification: {
      creatorWorkspaceId: actor.workspaceId,
      workspaceId: null,
    },
  };
}

function safeCopy(eventType: string): readonly [string, string] {
  if (eventType === "campaigns.application_approved")
    return ["Application approved", "A campaign application was approved."];
  if (eventType === "campaigns.application_rejected")
    return ["Application update", "A campaign application was not approved."];
  if (eventType.startsWith("COLLABORATION_"))
    return ["Collaboration update", "A collaboration changed."];
  if (eventType === "team.member_access_revoked")
    return ["Workspace access updated", "Creator workspace access changed."];
  if (eventType === "integration.instagram_token_expired")
    return [
      "Instagram needs attention",
      "Open Settings to restore Instagram access.",
    ];
  return ["Creator update", "There is a new workspace update."];
}

function activityAllowed(eventType: string): boolean {
  if (EXCLUDED_PREFIXES.some((prefix) => eventType.startsWith(prefix)))
    return false;
  if (eventType.includes("SETTLEMENT") || eventType.includes("PAYMENT"))
    return false;
  return true;
}

@Injectable()
export class CreatorHomeNotificationReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(actor: CreatorWorkspaceActorContext, activityLimit: number) {
    const where = creatorHomeNotificationRecipientWhere(actor);
    const [unreadCount, rows] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.count({
        where: { ...where, isRead: false },
      }),
      this.prisma.notificationRecipient.findMany({
        where,
        select: {
          id: true,
          isRead: true,
          notification: {
            select: {
              id: true,
              eventType: true,
              semanticEventKey: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ notification: { createdAt: "desc" } }, { id: "asc" }],
        take: Math.max(activityLimit * 3, activityLimit),
      }),
    ]);
    return {
      exactUnreadCount: unreadCount,
      activity: rows
        .filter((row) => activityAllowed(row.notification.eventType))
        .slice(0, activityLimit)
        .map((row) => {
          const copy = safeCopy(row.notification.eventType);
          return {
            id: `notification:${row.notification.id}`,
            sourceId: row.notification.id,
            eventType: row.notification.eventType,
            semanticEventKey: row.notification.semanticEventKey,
            title: copy[0],
            subtitle: copy[1],
            unread: !row.isRead,
            occurredAt: row.notification.createdAt.toISOString(),
          };
        }),
      observedAt: new Date().toISOString(),
    };
  }
}

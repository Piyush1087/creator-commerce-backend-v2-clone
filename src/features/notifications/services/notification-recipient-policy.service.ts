import { Injectable } from "@nestjs/common";
import { BrandRole, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type { NotificationRecipientPolicy } from "../types/notifications.types";

export type ResolvedNotificationRecipient = {
  userId: string;
  email: string;
  name: string | null;
  inbox: boolean;
};

@Injectable()
export class NotificationRecipientPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    args: {
      workspaceId?: string;
      creatorWorkspaceId?: string;
      policy: NotificationRecipientPolicy;
      triggerUserId: string | null;
      affectedUserId: string | null;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ResolvedNotificationRecipient[]> {
    if (args.policy === "CREATOR_WORKSPACE_ACTIVE_TEAM") {
      if (!args.creatorWorkspaceId || args.workspaceId)
        throw new Error("NOTIFICATION_SCOPE_INVALID");
      const rows = await db.creatorWorkspaceMember.findMany({
        where: {
          workspaceId: args.creatorWorkspaceId,
          isActive: true,
          securityRole: { in: ["OWNER", "MANAGER", "ASSISTANT"] },
          userId: { not: null },
          user: { authState: "ACTIVE", role: "CREATOR" },
        },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      });
      const recipients = new Map<string, ResolvedNotificationRecipient>();
      for (const row of rows)
        if (row.user)
          recipients.set(row.user.id, {
            userId: row.user.id,
            email: row.user.email,
            name: row.user.name,
            inbox: true,
          });
      return [...recipients.values()];
    }
    if (!args.workspaceId || args.creatorWorkspaceId)
      throw new Error("NOTIFICATION_SCOPE_INVALID");
    if (args.policy === "AFFECTED_USER_EMAIL_ONLY") {
      if (!args.affectedUserId) return [];
      const membership = await db.brandTeamMember.findFirst({
        where: {
          brandProfileId: args.workspaceId,
          userId: args.affectedUserId,
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!membership) {
        throw new Error("NOTIFICATION_AFFECTED_USER_WORKSPACE_MISMATCH");
      }
      return [
        {
          userId: membership.user.id,
          email: membership.user.email,
          name: membership.user.name,
          inbox: false,
        },
      ];
    }

    const roleSet =
      args.policy === "OWNER_CAMPAIGN_MANAGERS"
        ? [BrandRole.BRAND_OWNER, BrandRole.CAMPAIGN_MANAGER]
        : [BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN];
    const rows = await db.brandTeamMember.findMany({
      where: {
        brandProfileId: args.workspaceId,
        isActive: true,
        role: { in: roleSet },
      },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    });
    const recipients = new Map(
      rows.map((row) => [
        row.userId,
        {
          userId: row.userId,
          email: row.user.email,
          name: row.user.name,
          inbox: true,
        },
      ]),
    );

    if (
      args.policy === "OWNER_FINANCE_PLUS_ACTIVE_TRIGGERING_CM" &&
      args.triggerUserId
    ) {
      const trigger = await db.brandTeamMember.findFirst({
        where: {
          brandProfileId: args.workspaceId,
          userId: args.triggerUserId,
          role: BrandRole.CAMPAIGN_MANAGER,
          isActive: true,
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (trigger)
        recipients.set(trigger.userId, {
          userId: trigger.userId,
          email: trigger.user.email,
          name: trigger.user.name,
          inbox: true,
        });
    }
    return [...recipients.values()];
  }
}

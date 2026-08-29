import { Injectable } from "@nestjs/common";
import { BrandRole } from "@prisma/client";
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

  async resolve(args: {
    workspaceId: string;
    policy: NotificationRecipientPolicy;
    triggerUserId: string | null;
    affectedUserId: string | null;
  }): Promise<ResolvedNotificationRecipient[]> {
    if (args.policy === "AFFECTED_USER_EMAIL_ONLY") {
      if (!args.affectedUserId) return [];
      const user = await this.prisma.user.findUnique({
        where: { id: args.affectedUserId },
        select: { id: true, email: true, name: true },
      });
      return user
        ? [
            {
              userId: user.id,
              email: user.email,
              name: user.name,
              inbox: false,
            },
          ]
        : [];
    }

    const roleSet =
      args.policy === "OWNER_CAMPAIGN_MANAGERS"
        ? [BrandRole.BRAND_OWNER, BrandRole.CAMPAIGN_MANAGER]
        : [BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN];
    const rows = await this.prisma.brandTeamMember.findMany({
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
      const trigger = await this.prisma.brandTeamMember.findFirst({
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

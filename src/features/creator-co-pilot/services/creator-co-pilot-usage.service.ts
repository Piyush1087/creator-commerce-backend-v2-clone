import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { isCoPilotQuotaEnforced } from "../../../shared/config/co-pilot-quota";

const FREE_TIER_LIMIT = 100;

@Injectable()
export class CreatorCoPilotUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageSnapshot(creatorProfileId: string) {
    if (!isCoPilotQuotaEnforced()) {
      return {
        featureKey: "MAX_CREATOR_AI_CHATS" as const,
        current: 0,
        limit: 999_999,
        remaining: 999_999,
        warningLevel: "ok" as const,
        canSend: true,
        tier: "DEV_UNLIMITED",
      };
    }

    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const current = await this.prisma.creatorCoPilotInteractionLog.count({
      where: {
        creatorProfileId,
        createdAt: { gte: since },
        status: "SUCCESS",
      },
    });

    const remaining = Math.max(0, FREE_TIER_LIMIT - current);
    const warningLevel =
      current >= FREE_TIER_LIMIT
        ? ("exhausted" as const)
        : current >= FREE_TIER_LIMIT * 0.8
          ? ("warn" as const)
          : ("ok" as const);

    return {
      featureKey: "MAX_CREATOR_AI_CHATS" as const,
      current,
      limit: FREE_TIER_LIMIT,
      remaining,
      warningLevel,
      canSend: current < FREE_TIER_LIMIT,
      tier: "FOUNDING_FREE",
    };
  }

  async assertCanRun(creatorProfileId: string): Promise<void> {
    if (!isCoPilotQuotaEnforced()) {
      return;
    }
    const usage = await this.getUsageSnapshot(creatorProfileId);
    if (!usage.canSend) {
      throw new ForbiddenException(
        "Creator co-pilot quota exhausted for this month.",
      );
    }
  }
}

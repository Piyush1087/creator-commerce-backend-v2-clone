import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

const FREE_TIER_LIMIT = 100;

@Injectable()
export class CreatorCoPilotUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsageSnapshot(creatorProfileId: string) {
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
        ? "exhausted"
        : current >= FREE_TIER_LIMIT * 0.8
          ? "warn"
          : "ok";

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
    const usage = await this.getUsageSnapshot(creatorProfileId);
    if (!usage.canSend) {
      throw new ForbiddenException(
        "Creator co-pilot quota exhausted for this month.",
      );
    }
  }
}

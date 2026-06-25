import { ForbiddenException, Injectable } from "@nestjs/common";

import { EntitlementService } from "../../pricing/services/entitlement.service";

export type CoPilotUsageSnapshot = {
  featureKey: "MAX_AI_CHATS";
  current: number;
  limit: number;
  resetAt: string | null;
  percentUsed: number;
  warningLevel: "ok" | "warn" | "critical" | "exhausted";
  warningMessage: string | null;
  canSend: boolean;
  tier: string;
};

@Injectable()
export class CoPilotUsageService {
  constructor(private readonly entitlements: EntitlementService) {}

  async getUsageSnapshot(brandProfileId: string): Promise<CoPilotUsageSnapshot | null> {
    const snapshot = await this.entitlements.getUsageSnapshot(brandProfileId);
    if (!snapshot) {
      return null;
    }

    const usage = snapshot.usages.find((u) => u.featureKey === "MAX_AI_CHATS");
    const limit = snapshot.limits.MAX_AI_CHATS;
    const current = usage?.currentUsageCount ?? 0;
    const percentUsed = limit > 0 ? Math.round((current / limit) * 100) : 0;
    const warningLevel = this.resolveWarningLevel(current, limit);
    const remaining = Math.max(0, limit - current);

    return {
      featureKey: "MAX_AI_CHATS",
      current,
      limit,
      resetAt: usage?.resetAt?.toISOString() ?? null,
      percentUsed,
      warningLevel,
      warningMessage: this.buildWarningMessage(warningLevel, remaining, limit),
      canSend: warningLevel !== "exhausted",
      tier: snapshot.tier,
    };
  }

  async assertCanRun(brandProfileId: string): Promise<void> {
    const usage = await this.getUsageSnapshot(brandProfileId);
    if (!usage) {
      return;
    }
    if (!usage.canSend) {
      throw new ForbiddenException(
        "Co-pilot quota exhausted for this billing period. Upgrade your plan to continue.",
      );
    }
  }

  async incrementRun(brandProfileId: string): Promise<void> {
    await this.entitlements.checkAndIncrementUsage(
      brandProfileId,
      "MAX_AI_CHATS",
      1,
    );
  }

  private resolveWarningLevel(
    current: number,
    limit: number,
  ): CoPilotUsageSnapshot["warningLevel"] {
    if (limit >= 999_000) {
      return "ok";
    }
    if (current >= limit) {
      return "exhausted";
    }
    const ratio = current / limit;
    if (ratio >= 0.95) {
      return "critical";
    }
    if (ratio >= 0.8) {
      return "warn";
    }
    return "ok";
  }

  private buildWarningMessage(
    level: CoPilotUsageSnapshot["warningLevel"],
    remaining: number,
    limit: number,
  ): string | null {
    switch (level) {
      case "exhausted":
        return `You have used all ${limit} co-pilot turns this period. Upgrade to unlock more.`;
      case "critical":
        return `${remaining} co-pilot turn${remaining === 1 ? "" : "s"} remaining this period.`;
      case "warn":
        return `${remaining} of ${limit} co-pilot turns remaining (${Math.round((remaining / limit) * 100)}%).`;
      default:
        return null;
    }
  }
}

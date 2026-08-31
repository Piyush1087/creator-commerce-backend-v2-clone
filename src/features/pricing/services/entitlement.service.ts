import { ForbiddenException, Injectable } from "@nestjs/common";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  CYCLIC_FEATURE_KEYS,
  FEATURE_LIMITS,
  FOUNDERS_BETA_COMMISSION_RATE,
  LEGACY_ESCROW_TAKE_RATES,
} from "../constants/subscription.constants";
import type { EntitlementFeatureKey } from "../types";

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAndIncrementUsage(
    brandProfileId: string,
    featureKey: EntitlementFeatureKey,
    incrementBy = 1,
  ): Promise<void> {
    const sub = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      include: { featureUsages: true },
    });

    if (
      !sub ||
      sub.status === SubscriptionStatus.CANCELED ||
      sub.status === SubscriptionStatus.HALTED
    ) {
      throw new ForbiddenException(
        "Resource execution rejected: Active billing tier authorization required.",
      );
    }

    if (sub.tier === SubscriptionTier.ENTERPRISE) {
      return;
    }

    const maxPlanLimit = FEATURE_LIMITS[sub.tier][featureKey];
    let usageRecord = sub.featureUsages.find(
      (usage) => usage.featureKey === featureKey,
    );

    if (!usageRecord) {
      usageRecord = await this.prisma.featureUsage.create({
        data: {
          subscriptionId: sub.id,
          featureKey,
          currentUsageCount: 0,
          resetAt: this.calculateInitialResetWindow(),
        },
      });
    }

    if (
      this.isCyclicFeature(featureKey) &&
      usageRecord.resetAt &&
      new Date() > usageRecord.resetAt
    ) {
      usageRecord = await this.prisma.featureUsage.update({
        where: { id: usageRecord.id },
        data: {
          currentUsageCount: 0,
          resetAt: this.calculateInitialResetWindow(),
        },
      });
    }

    if (usageRecord.currentUsageCount + incrementBy > maxPlanLimit) {
      throw new ForbiddenException(
        `Plan Allocation Exhausted: Target tier ${sub.tier} restricts ${featureKey} to limits of ${maxPlanLimit}.`,
      );
    }

    await this.prisma.featureUsage.update({
      where: { id: usageRecord.id },
      data: { currentUsageCount: { increment: incrementBy } },
    });
  }

  async getUsageSnapshot(brandProfileId: string) {
    const sub = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      include: { featureUsages: true },
    });

    if (!sub) {
      return null;
    }

    const limits = FEATURE_LIMITS[sub.tier];
    return {
      tier: sub.tier,
      status: sub.status,
      limits,
      usages: sub.featureUsages.map((usage) => ({
        featureKey: usage.featureKey,
        currentUsageCount: usage.currentUsageCount,
        limit:
          usage.featureKey in limits
            ? limits[usage.featureKey as keyof typeof limits]
            : null,
        resetAt: usage.resetAt,
      })),
    };
  }

  getEscrowTakeRate(tier: SubscriptionTier): number {
    return tier === SubscriptionTier.FOUNDERS_BETA
      ? FOUNDERS_BETA_COMMISSION_RATE
      : LEGACY_ESCROW_TAKE_RATES[tier];
  }

  getEscrowAggregateCap(tier: SubscriptionTier): number {
    return FEATURE_LIMITS[tier].ESCROW_AGGREGATE_CAP;
  }

  private isCyclicFeature(key: EntitlementFeatureKey): boolean {
    return (CYCLIC_FEATURE_KEYS as readonly string[]).includes(key);
  }

  private calculateInitialResetWindow(): Date {
    const current = new Date();
    current.setMonth(current.getMonth() + 1);
    return current;
  }
}

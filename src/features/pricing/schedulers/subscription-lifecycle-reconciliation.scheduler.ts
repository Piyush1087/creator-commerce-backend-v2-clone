import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { PricingRazorpayClient } from "../services/pricing-razorpay.client";

@Injectable()
export class SubscriptionLifecycleReconciliationScheduler {
  private readonly logger = new Logger(
    SubscriptionLifecycleReconciliationScheduler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: PricingRazorpayClient,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcileTemporalStates(now = new Date()): Promise<void> {
    await this.expireTrials(now);
    await this.expirePaymentGrace(now);
    await this.finalizeScheduledCancellations(now);
  }

  private async expireTrials(now: Date): Promise<void> {
    const expired = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { lte: now },
      },
      select: { id: true, brandProfileId: true },
    });
    for (const subscription of expired) {
      const result = await this.prisma.brandSubscription.updateMany({
        where: {
          id: subscription.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: { lte: now },
        },
        data: { status: SubscriptionStatus.TRIAL_EXPIRED },
      });
      if (result.count > 0) {
        await this.updateLegacyStatus(
          subscription.brandProfileId,
          SubscriptionStatus.TRIAL_EXPIRED,
        );
      }
    }
  }

  private async expirePaymentGrace(now: Date): Promise<void> {
    const expired = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        paymentGraceEndsAt: { lte: now },
      },
      select: { id: true, brandProfileId: true },
    });
    for (const subscription of expired) {
      const result = await this.prisma.brandSubscription.updateMany({
        where: {
          id: subscription.id,
          status: SubscriptionStatus.PAST_DUE,
          paymentGraceEndsAt: { lte: now },
        },
        data: { status: SubscriptionStatus.HALTED },
      });
      if (result.count > 0) {
        await this.updateLegacyStatus(
          subscription.brandProfileId,
          SubscriptionStatus.HALTED,
        );
      }
    }
  }

  private async finalizeScheduledCancellations(now: Date): Promise<void> {
    const due = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.CANCEL_SCHEDULED,
        cancelEffectiveAt: { lte: now },
      },
      select: {
        id: true,
        brandProfileId: true,
        razorpaySubscriptionId: true,
      },
    });

    for (const subscription of due) {
      try {
        if (subscription.razorpaySubscriptionId) {
          await this.razorpay.cancelSubscription(
            subscription.razorpaySubscriptionId,
            false,
          );
        }
        const result = await this.prisma.brandSubscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.CANCEL_SCHEDULED,
            cancelEffectiveAt: { lte: now },
          },
          data: {
            status: SubscriptionStatus.CANCELED,
            providerStatus: subscription.razorpaySubscriptionId
              ? "cancelled"
              : undefined,
          },
        });
        if (result.count > 0) {
          await this.updateLegacyStatus(
            subscription.brandProfileId,
            SubscriptionStatus.CANCELED,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to finalize scheduled cancellation ${subscription.id}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  private async updateLegacyStatus(
    brandProfileId: string,
    status: SubscriptionStatus,
  ): Promise<void> {
    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: { subscriptionStatus: status },
    });
  }
}

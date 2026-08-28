import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  PROVIDER_CANCELLATION_PENDING,
  PROVIDER_CANCELLATION_SCHEDULED,
} from "../constants/subscription.constants";
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
    await this.retryPendingProviderCancellations(now);
    await this.reconcilePendingCancellationsAtBoundary(now);
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
        providerCancellationState: PROVIDER_CANCELLATION_SCHEDULED,
        cancelEffectiveAt: { lte: now },
      },
      select: {
        id: true,
        brandProfileId: true,
      },
    });

    for (const subscription of due) {
      try {
        const result = await this.prisma.brandSubscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.CANCEL_SCHEDULED,
            providerCancellationState: PROVIDER_CANCELLATION_SCHEDULED,
            cancelEffectiveAt: { lte: now },
          },
          data: {
            status: SubscriptionStatus.CANCELED,
            providerStatus: "cancelled",
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

  private async reconcilePendingCancellationsAtBoundary(
    now: Date,
  ): Promise<void> {
    const pending = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        providerCancellationState: PROVIDER_CANCELLATION_PENDING,
        cancelEffectiveAt: { lte: now },
        razorpaySubscriptionId: { not: null },
      },
      select: {
        id: true,
        brandProfileId: true,
        razorpaySubscriptionId: true,
      },
    });

    for (const subscription of pending) {
      try {
        const provider = await this.razorpay.fetchSubscription(
          subscription.razorpaySubscriptionId!,
        );
        if (provider.status.toLowerCase() !== "cancelled") {
          this.logger.warn(
            `Cancellation remains unresolved at boundary for ${subscription.id}; provider status is ${provider.status}`,
          );
          continue;
        }
        const result = await this.prisma.brandSubscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.ACTIVE,
            providerCancellationState: PROVIDER_CANCELLATION_PENDING,
            cancelEffectiveAt: { lte: now },
          },
          data: {
            status: SubscriptionStatus.CANCELED,
            providerStatus: "cancelled",
          },
        });
        if (result.count > 0) {
          await this.updateLegacyStatus(
            subscription.brandProfileId,
            SubscriptionStatus.CANCELED,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to reconcile pending cancellation ${subscription.id}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
  }

  private async retryPendingProviderCancellations(now: Date): Promise<void> {
    const pending = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        providerCancellationState: PROVIDER_CANCELLATION_PENDING,
        cancelEffectiveAt: { gt: now },
        razorpaySubscriptionId: { not: null },
      },
      select: {
        id: true,
        brandProfileId: true,
        razorpaySubscriptionId: true,
      },
    });

    for (const subscription of pending) {
      try {
        const provider = await this.razorpay.cancelSubscription(
          subscription.razorpaySubscriptionId!,
          true,
        );
        const result = await this.prisma.brandSubscription.updateMany({
          where: {
            id: subscription.id,
            status: SubscriptionStatus.ACTIVE,
            providerCancellationState: PROVIDER_CANCELLATION_PENDING,
          },
          data: {
            status: SubscriptionStatus.CANCEL_SCHEDULED,
            providerCancellationState: PROVIDER_CANCELLATION_SCHEDULED,
            providerStatus: provider.status ?? undefined,
          },
        });
        if (result.count > 0) {
          await this.updateLegacyStatus(
            subscription.brandProfileId,
            SubscriptionStatus.CANCEL_SCHEDULED,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Provider cancellation scheduling retry failed for ${subscription.id}: ${
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

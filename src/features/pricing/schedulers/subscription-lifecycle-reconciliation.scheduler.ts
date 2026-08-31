import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  PROVIDER_CANCELLATION_PENDING,
  PROVIDER_CANCELLATION_SCHEDULED,
} from "../constants/subscription.constants";
import { PricingRazorpayClient } from "../services/pricing-razorpay.client";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { runNotificationTransaction } from "../../notifications/services/notification-transaction";

@Injectable()
export class SubscriptionLifecycleReconciliationScheduler {
  private readonly logger = new Logger(
    SubscriptionLifecycleReconciliationScheduler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: PricingRazorpayClient,
    private readonly notifications: NotificationDispatchService,
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
      select: { id: true, brandProfileId: true, trialEndsAt: true },
    });
    for (const subscription of expired) {
      await runNotificationTransaction(this.prisma, async (tx) => {
        const result = await tx.brandSubscription.updateMany({
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
            tx,
          );
          await this.notifications?.enqueueWithinTransaction(tx, {
            workspaceId: subscription.brandProfileId,
            eventType: "billing.trial_expired",
            source: {
              sourceType: "brand_subscription",
              sourceId: subscription.id,
              transitionId: `trial_expired:${subscription.trialEndsAt!.toISOString()}`,
            },
            payload: { subscription_id: subscription.id },
          });
        }
      });
    }
  }

  private async expirePaymentGrace(now: Date): Promise<void> {
    const expired = await this.prisma.brandSubscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        paymentGraceEndsAt: { lte: now },
      },
      select: { id: true, brandProfileId: true, paymentGraceEndsAt: true },
    });
    for (const subscription of expired) {
      await runNotificationTransaction(this.prisma, async (tx) => {
        const result = await tx.brandSubscription.updateMany({
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
            tx,
          );
          await this.notifications?.enqueueWithinTransaction(tx, {
            workspaceId: subscription.brandProfileId,
            eventType: "billing.subscription_halted",
            source: {
              sourceType: "brand_subscription",
              sourceId: subscription.id,
              transitionId: `halted:${subscription.paymentGraceEndsAt!.toISOString()}`,
            },
            payload: { subscription_id: subscription.id },
          });
        }
      });
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
        cancelEffectiveAt: true,
      },
    });

    for (const subscription of due) {
      try {
        await runNotificationTransaction(this.prisma, async (tx) => {
          const result = await tx.brandSubscription.updateMany({
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
              tx,
            );
            await this.notifications?.enqueueWithinTransaction(tx, {
              workspaceId: subscription.brandProfileId,
              eventType: "billing.cancellation_effective",
              source: {
                sourceType: "brand_subscription",
                sourceId: subscription.id,
                transitionId: `cancel_effective:${subscription.cancelEffectiveAt!.toISOString()}`,
              },
              payload: { subscription_id: subscription.id },
            });
          }
        });
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
        cancelEffectiveAt: true,
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
        await runNotificationTransaction(this.prisma, async (tx) => {
          const result = await tx.brandSubscription.updateMany({
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
              tx,
            );
            await this.notifications?.enqueueWithinTransaction(tx, {
              workspaceId: subscription.brandProfileId,
              eventType: "billing.cancellation_effective",
              source: {
                sourceType: "brand_subscription",
                sourceId: subscription.id,
                transitionId: `cancel_effective:${subscription.cancelEffectiveAt!.toISOString()}`,
              },
              payload: { subscription_id: subscription.id },
            });
          }
        });
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
        cancelScheduledAt: true,
      },
    });

    for (const subscription of pending) {
      try {
        const provider = await this.razorpay.cancelSubscription(
          subscription.razorpaySubscriptionId!,
          true,
        );
        await runNotificationTransaction(this.prisma, async (tx) => {
          const result = await tx.brandSubscription.updateMany({
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
              tx,
            );
            await this.notifications?.enqueueWithinTransaction(tx, {
              workspaceId: subscription.brandProfileId,
              eventType: "billing.cancellation_scheduled",
              source: {
                sourceType: "brand_subscription",
                sourceId: subscription.id,
                transitionId: `cancel_scheduled:${subscription.cancelScheduledAt!.toISOString()}`,
              },
              payload: { subscription_id: subscription.id },
            });
          }
        });
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
    db: Pick<PrismaService, "brandProfile"> = this.prisma,
  ): Promise<void> {
    await db.brandProfile.update({
      where: { id: brandProfileId },
      data: { subscriptionStatus: status },
    });
  }
}

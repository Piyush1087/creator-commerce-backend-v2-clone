import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  FEATURE_LIMIT_KEYS,
  TRIAL_DURATION_DAYS,
  type BillableSubscriptionTier,
} from "../constants/subscription.constants";
import type { TierChangeResult } from "../types/tier-change.types";
import { GeoRoutingService } from "./geo-routing.service";
import { PricingRazorpayClient } from "./pricing-razorpay.client";
import { RazorpayPlanProvisioningService } from "./razorpay-plan-provisioning.service";
import { SubscriptionAccessService } from "./subscription-access.service";

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly geoRouting: GeoRoutingService,
    private readonly razorpay: PricingRazorpayClient,
    private readonly planProvisioning: RazorpayPlanProvisioningService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async getSubscription(brandProfileId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      include: { featureUsages: true },
    });
    return subscription
      ? this.subscriptionAccess.toReadModel(subscription)
      : null;
  }

  async bootstrapLocalTrial(brandProfileId: string) {
    const existing = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });
    if (existing) {
      throw new ConflictException(
        "A subscription record already exists for this brand",
      );
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { countryCode: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const resolvedCurrency = this.geoRouting.resolveGeoContext(
      profile.countryCode,
    ).currency;
    const trialEndsAt = this.addDays(new Date(), TRIAL_DURATION_DAYS);

    const subscription = await this.prisma.brandSubscription.create({
      data: {
        brandProfileId,
        tier: SubscriptionTier.FOUNDERS_BETA,
        status: SubscriptionStatus.TRIALING,
        currency: resolvedCurrency as SubscriptionCurrency,
        trialEndsAt,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        featureUsages: {
          create: this.buildInitialFeatureUsageRows(),
        },
      },
      include: { featureUsages: true },
    });

    await this.syncLegacyBrandProfileFields(brandProfileId, subscription);

    return subscription;
  }

  async initializeRazorpayTrial(brandProfileId: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { countryCode: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const resolvedCurrency = this.geoRouting.resolveGeoContext(
      profile.countryCode,
    ).currency;
    const trialDurationSeconds = TRIAL_DURATION_DAYS * 24 * 60 * 60;
    const startBillingEpoch =
      Math.floor(Date.now() / 1000) + trialDurationSeconds;
    const selectedPlanId = await this.planProvisioning.resolvePlanId(
      SubscriptionTier.FOUNDERS_BETA,
      resolvedCurrency,
    );

    const razorpaySub = await this.razorpay.createDeferredTrialSubscription(
      selectedPlanId,
      startBillingEpoch,
    );

    const trialEndsAt = new Date(startBillingEpoch * 1000);
    const existing = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });

    const subscription = existing
      ? await this.prisma.brandSubscription.update({
          where: { brandProfileId },
          data: {
            tier: SubscriptionTier.FOUNDERS_BETA,
            status: SubscriptionStatus.TRIALING,
            currency: resolvedCurrency as SubscriptionCurrency,
            razorpaySubscriptionId: razorpaySub.id,
            razorpayPlanId: selectedPlanId,
            trialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
          },
          include: { featureUsages: true },
        })
      : await this.prisma.brandSubscription.create({
          data: {
            brandProfileId,
            tier: SubscriptionTier.FOUNDERS_BETA,
            status: SubscriptionStatus.TRIALING,
            currency: resolvedCurrency as SubscriptionCurrency,
            razorpaySubscriptionId: razorpaySub.id,
            razorpayPlanId: selectedPlanId,
            trialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
            featureUsages: {
              create: this.buildInitialFeatureUsageRows(),
            },
          },
          include: { featureUsages: true },
        });

    await this.syncLegacyBrandProfileFields(brandProfileId, subscription);
    return subscription;
  }

  async upgradeOrDowngradeTier(
    brandProfileId: string,
    targetTier: SubscriptionTier,
  ): Promise<TierChangeResult> {
    void brandProfileId;
    throw new BadRequestException(
      `${targetTier} is not an available MVP plan change target. Founder's Beta is the only purchasable plan.`,
    );
  }

  private async beginPaidTierCheckoutFromTrial(
    brandProfileId: string,
    subscription: {
      razorpaySubscriptionId: string | null;
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
      currentPeriodStart: Date;
      featureUsages: unknown[];
    },
    targetTier: SubscriptionTier,
    targetPlanId: string,
  ): Promise<TierChangeResult> {
    if (subscription.razorpaySubscriptionId) {
      await this.cancelRazorpaySubscriptionQuietly(
        subscription.razorpaySubscriptionId,
      );
    }

    const razorpaySub = await this.razorpay.createImmediateSubscription(
      targetPlanId,
      {
        brand_profile_id: brandProfileId,
        target_tier: targetTier,
      },
    );

    const updated = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        status: SubscriptionStatus.TRIALING,
        razorpaySubscriptionId: razorpaySub.id,
        razorpayPlanId: targetPlanId,
      },
      include: { featureUsages: true },
    });

    await this.syncLegacyBrandProfileFields(brandProfileId, updated);

    const razorpayKeyId = this.config.get<string>("RAZORPAY_API_KEY_ID", "");
    if (!razorpayKeyId) {
      throw new BadRequestException("Razorpay is not configured for checkout.");
    }

    return {
      subscription: updated,
      checkout: {
        subscriptionId: razorpaySub.id,
        razorpayKeyId,
        targetTier,
      },
    };
  }

  async reactivateSubscription(brandProfileId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      include: { featureUsages: true },
    });

    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    const recoverableStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.HALTED,
      SubscriptionStatus.PAST_DUE,
    ];

    if (!recoverableStatuses.includes(subscription.status)) {
      throw new BadRequestException(
        "Subscription is not in a recoverable billing state.",
      );
    }

    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      const paymentLinks =
        await this.resolvePendingSubscriptionPaymentLinks(subscription);
      return {
        subscription,
        recovery_mode: "update_payment" as const,
        payment_links: paymentLinks,
      };
    }

    if (
      subscription.status === SubscriptionStatus.CANCELED &&
      this.isFoundersTrialWindowOpen(subscription)
    ) {
      const restored = await this.restoreFoundersTrialAccess(
        brandProfileId,
        subscription,
      );
      return {
        subscription: restored,
        recovery_mode: "trial_restored" as const,
      };
    }

    if (
      subscription.status === SubscriptionStatus.HALTED &&
      subscription.razorpaySubscriptionId
    ) {
      await this.razorpay.resumeSubscription(
        subscription.razorpaySubscriptionId,
      );

      const updated = await this.prisma.brandSubscription.update({
        where: { brandProfileId },
        data: { status: SubscriptionStatus.ACTIVE },
        include: { featureUsages: true },
      });

      await this.syncLegacyBrandProfileFields(brandProfileId, updated);

      return {
        subscription: updated,
        recovery_mode: "resume_submitted" as const,
      };
    }

    if (subscription.tier === SubscriptionTier.ENTERPRISE) {
      throw new BadRequestException(
        "Enterprise reactivation requires sales assistance.",
      );
    }

    const currency =
      subscription.currency === SubscriptionCurrency.INR ? "INR" : "USD";
    if (!this.planProvisioning.isBillableTier(subscription.tier)) {
      throw new BadRequestException(
        "Plan mapping unavailable for the current tier.",
      );
    }

    const planId = await this.planProvisioning.resolvePlanId(
      subscription.tier as BillableSubscriptionTier,
      currency,
    );
    const razorpaySub = await this.razorpay.createImmediateSubscription(planId);

    const updated = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        razorpaySubscriptionId: razorpaySub.id,
        razorpayPlanId: planId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { featureUsages: true },
    });

    await this.syncLegacyBrandProfileFields(brandProfileId, updated);

    return {
      subscription: updated,
      recovery_mode: "new_subscription" as const,
    };
  }

  async cancelSubscription(brandProfileId: string, cancelAtCycleEnd = false) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.razorpaySubscriptionId) {
      await this.razorpay.cancelSubscription(
        subscription.razorpaySubscriptionId,
        cancelAtCycleEnd,
      );
    }

    const updated = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        status: cancelAtCycleEnd
          ? subscription.status
          : SubscriptionStatus.CANCELED,
      },
      include: { featureUsages: true },
    });

    if (!cancelAtCycleEnd) {
      await this.syncLegacyBrandProfileFields(brandProfileId, updated);
    }

    return updated;
  }

  private async applyRazorpayPlanChange(
    razorpaySubscriptionId: string,
    targetPlanId: string,
  ): Promise<{ subscriptionId: string; planId: string }> {
    const razorpaySubscription = await this.razorpay.fetchSubscription(
      razorpaySubscriptionId,
    );
    const razorpayStatus = (razorpaySubscription.status ?? "").toLowerCase();

    if (razorpayStatus === "authenticated" || razorpayStatus === "active") {
      try {
        await this.razorpay.changeSubscriptionPlan(
          razorpaySubscriptionId,
          targetPlanId,
        );
        return {
          subscriptionId: razorpaySubscriptionId,
          planId: targetPlanId,
        };
      } catch (error) {
        const message =
          error instanceof BadRequestException ? String(error.message) : "";
        if (
          message.toLowerCase().includes("authenticated") ||
          message.toLowerCase().includes("active state")
        ) {
          this.logger.warn(
            `Razorpay PATCH plan failed for ${razorpaySubscriptionId} (${razorpayStatus}); replacing subscription`,
          );
          return this.replaceRazorpaySubscription(
            razorpaySubscriptionId,
            targetPlanId,
          );
        }
        throw error;
      }
    }

    if (
      razorpayStatus === "created" ||
      razorpayStatus === "pending" ||
      razorpayStatus === "halted" ||
      razorpayStatus === "cancelled"
    ) {
      return this.replaceRazorpaySubscription(
        razorpaySubscriptionId,
        targetPlanId,
      );
    }

    throw new BadRequestException(
      `Cannot change plan while Razorpay subscription is ${razorpaySubscription.status ?? "unknown"}. Resolve billing status first.`,
    );
  }

  private async replaceRazorpaySubscription(
    razorpaySubscriptionId: string,
    targetPlanId: string,
  ): Promise<{ subscriptionId: string; planId: string }> {
    await this.cancelRazorpaySubscriptionQuietly(razorpaySubscriptionId);

    const replacement =
      await this.razorpay.createImmediateSubscription(targetPlanId);

    return {
      subscriptionId: replacement.id,
      planId: targetPlanId,
    };
  }

  async restoreFoundersTrialAfterAbandonedCheckout(brandProfileId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      include: { featureUsages: true },
    });
    if (!subscription || !this.isFoundersTrialWindowOpen(subscription)) {
      throw new BadRequestException(
        "No restorable Founder's trial window for this brand.",
      );
    }

    return this.restoreFoundersTrialAccess(brandProfileId, subscription);
  }

  private requiresPaidTierCheckout(subscription: {
    status: SubscriptionStatus;
    tier: SubscriptionTier;
    trialEndsAt: Date | null;
  }): boolean {
    if (subscription.status === SubscriptionStatus.TRIALING) {
      return true;
    }

    return (
      (subscription.status === SubscriptionStatus.CANCELED ||
        subscription.status === SubscriptionStatus.HALTED) &&
      subscription.tier === SubscriptionTier.FOUNDERS_BETA &&
      this.isFoundersTrialWindowOpen(subscription)
    );
  }

  private isFoundersTrialWindowOpen(subscription: {
    trialEndsAt: Date | null;
  }): boolean {
    return (
      subscription.trialEndsAt !== null &&
      subscription.trialEndsAt.getTime() > Date.now()
    );
  }

  private async restoreFoundersTrialAccess(
    brandProfileId: string,
    subscription: { razorpaySubscriptionId: string | null },
  ) {
    if (subscription.razorpaySubscriptionId) {
      await this.cancelRazorpaySubscriptionQuietly(
        subscription.razorpaySubscriptionId,
      );
    }

    const restored = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        status: SubscriptionStatus.TRIALING,
        razorpaySubscriptionId: null,
        razorpayPlanId: null,
      },
      include: { featureUsages: true },
    });

    await this.syncLegacyBrandProfileFields(brandProfileId, restored);
    return restored;
  }

  private async cancelRazorpaySubscriptionQuietly(
    razorpaySubscriptionId: string,
  ): Promise<void> {
    try {
      await this.razorpay.cancelSubscription(razorpaySubscriptionId, false);
    } catch (error) {
      this.logger.warn(
        `Cancel failed for ${razorpaySubscriptionId}: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }

  private async resolvePendingSubscriptionPaymentLinks(subscription: {
    razorpaySubscriptionId: string | null;
  }): Promise<string[]> {
    if (!subscription.razorpaySubscriptionId) {
      return [];
    }

    const invoices = await this.razorpay.listSubscriptionInvoices(
      subscription.razorpaySubscriptionId,
    );

    return invoices
      .filter(
        (invoice) =>
          invoice.status === "issued" || invoice.status === "partially_paid",
      )
      .map((invoice) => invoice.short_url)
      .filter(
        (url): url is string => typeof url === "string" && url.length > 0,
      );
  }

  private buildInitialFeatureUsageRows() {
    const resetAt = this.calculateInitialResetWindow();
    return FEATURE_LIMIT_KEYS.filter(
      (key) => key !== "ESCROW_AGGREGATE_CAP",
    ).map((featureKey) => ({
      featureKey,
      currentUsageCount: 0,
      resetAt,
    }));
  }

  private calculateInitialResetWindow(): Date {
    const current = new Date();
    current.setMonth(current.getMonth() + 1);
    return current;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async syncLegacyBrandProfileFields(
    brandProfileId: string,
    subscription: {
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      trialEndsAt: Date | null;
      currentPeriodStart: Date;
    },
  ) {
    const planTypeMap: Record<
      SubscriptionTier,
      "FREE_TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
    > = {
      FOUNDERS_BETA: "FREE_TRIAL",
      GROWTH_STARTER: "STARTER",
      PROFESSIONAL: "PROFESSIONAL",
      ENTERPRISE: "ENTERPRISE",
    };

    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        planType: planTypeMap[subscription.tier],
        subscriptionStatus: subscription.status,
        planStartedAt: subscription.currentPeriodStart,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
  }
}

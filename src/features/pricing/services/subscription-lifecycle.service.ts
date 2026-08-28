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
import { BrandSettingsService } from "../../brand-settings/services/brand-settings.service";
import {
  FEATURE_LIMIT_KEYS,
  PROVIDER_CANCELLATION_PENDING,
  PROVIDER_CANCELLATION_SCHEDULED,
  TRIAL_DURATION_DAYS,
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
    private readonly brandSettings: BrandSettingsService,
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

  async upgradeOrDowngradeTier(
    brandProfileId: string,
    targetTier: SubscriptionTier,
  ): Promise<TierChangeResult> {
    void brandProfileId;
    throw new BadRequestException(
      `${targetTier} is not an available MVP plan change target. Founder's Beta is the only purchasable plan.`,
    );
  }

  async startPaidConversion(brandProfileId: string) {
    await this.brandSettings.requireCompleteBillingProfile(brandProfileId);

    const [profile, subscription] = await Promise.all([
      this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { countryCode: true },
      }),
      this.prisma.brandSubscription.findUnique({
        where: { brandProfileId },
      }),
    ]);
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    if (
      subscription.status === SubscriptionStatus.ACTIVE ||
      (subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
        subscription.cancelEffectiveAt !== null &&
        subscription.cancelEffectiveAt > new Date() &&
        subscription.providerStatus !== "cancelled") ||
      (subscription.status === SubscriptionStatus.PAST_DUE &&
        subscription.paymentGraceEndsAt !== null &&
        subscription.paymentGraceEndsAt > new Date())
    ) {
      throw new BadRequestException(
        "The current subscription does not require first paid conversion.",
      );
    }

    const currency = this.geoRouting.resolveGeoContext(
      profile.countryCode,
    ).currency;
    const razorpayKeyId = this.config.get<string>("RAZORPAY_API_KEY_ID", "");
    if (!razorpayKeyId) {
      throw new BadRequestException("Razorpay is not configured for checkout.");
    }
    const planId = await this.planProvisioning.resolvePlanId(
      SubscriptionTier.FOUNDERS_BETA,
      currency,
    );
    const providerSubscription =
      await this.razorpay.createImmediateSubscription(planId, {
        brand_profile_id: brandProfileId,
        target_tier: SubscriptionTier.FOUNDERS_BETA,
      });

    const now = new Date();
    const unexpiredTrial =
      subscription.trialEndsAt !== null && subscription.trialEndsAt > now;
    const pendingStatus = unexpiredTrial
      ? SubscriptionStatus.TRIALING
      : subscription.status === SubscriptionStatus.TRIALING ||
          subscription.status === SubscriptionStatus.TRIAL_EXPIRED
        ? SubscriptionStatus.TRIAL_EXPIRED
        : subscription.status;
    const providerStatus =
      subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
      subscription.providerStatus === "cancelled"
        ? "reactivation_pending"
        : (providerSubscription.status ?? "created");
    const updated = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        tier: SubscriptionTier.FOUNDERS_BETA,
        status: pendingStatus,
        currency: currency as SubscriptionCurrency,
        razorpaySubscriptionId: providerSubscription.id,
        razorpayPlanId: planId,
        providerStatus,
      },
      include: { featureUsages: true },
    });
    if (
      subscription.razorpaySubscriptionId &&
      subscription.razorpaySubscriptionId !== providerSubscription.id
    ) {
      await this.cancelRazorpaySubscriptionQuietly(
        subscription.razorpaySubscriptionId,
      );
    }

    return {
      subscription: this.subscriptionAccess.toReadModel(updated),
      checkout: {
        subscriptionId: providerSubscription.id,
        razorpayKeyId,
        targetTier: SubscriptionTier.FOUNDERS_BETA,
      },
    };
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

    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.providerCancellationState ===
        PROVIDER_CANCELLATION_PENDING &&
      subscription.cancelEffectiveAt !== null &&
      subscription.cancelEffectiveAt > new Date() &&
      subscription.razorpaySubscriptionId
    ) {
      throw new ConflictException(
        "Cancellation reconciliation is still pending. Retry after provider scheduling is confirmed.",
      );
    }

    if (
      subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
      subscription.providerCancellationState ===
        PROVIDER_CANCELLATION_SCHEDULED &&
      subscription.cancelEffectiveAt !== null &&
      subscription.cancelEffectiveAt > new Date()
    ) {
      return this.startCancellationContinuation(subscription);
    }

    if (
      subscription.status === SubscriptionStatus.PAST_DUE &&
      subscription.paymentGraceEndsAt !== null &&
      subscription.paymentGraceEndsAt > new Date()
    ) {
      const paymentLinks =
        await this.resolvePendingSubscriptionPaymentLinks(subscription);
      return {
        subscription: this.subscriptionAccess.toReadModel(subscription),
        recovery_mode: "update_payment" as const,
        payment_links: paymentLinks,
      };
    }

    if (
      (subscription.status === SubscriptionStatus.CANCELED ||
        subscription.status === SubscriptionStatus.TRIAL_EXPIRED) &&
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
      subscription.status === SubscriptionStatus.CANCELED ||
      subscription.status === SubscriptionStatus.HALTED ||
      subscription.status === SubscriptionStatus.TRIAL_EXPIRED ||
      (subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
        (subscription.providerStatus === "cancelled" ||
          subscription.cancelEffectiveAt === null ||
          subscription.cancelEffectiveAt <= new Date())) ||
      (subscription.status === SubscriptionStatus.PAST_DUE &&
        (subscription.paymentGraceEndsAt === null ||
          subscription.paymentGraceEndsAt <= new Date()))
    ) {
      return this.startPaidConversion(brandProfileId);
    }

    throw new BadRequestException(
      "Subscription is not in a recoverable billing state.",
    );
  }

  async cancelSubscription(brandProfileId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        "Only an active paid subscription can be scheduled for cancellation.",
      );
    }
    if (!subscription.razorpaySubscriptionId) {
      throw new BadRequestException(
        "Active subscription is missing its provider binding.",
      );
    }

    const cancelScheduledAt = new Date();
    const intent = await this.prisma.brandSubscription.update({
      where: { brandProfileId },
      data: {
        cancelScheduledAt,
        cancelEffectiveAt: subscription.currentPeriodEnd,
        providerCancellationState: PROVIDER_CANCELLATION_PENDING,
      },
    });

    const provider = await this.razorpay.cancelSubscription(
      subscription.razorpaySubscriptionId,
      true,
    );
    const confirmed = await this.prisma.brandSubscription.updateMany({
      where: {
        id: intent.id,
        status: SubscriptionStatus.ACTIVE,
        providerCancellationState: PROVIDER_CANCELLATION_PENDING,
      },
      data: {
        status: SubscriptionStatus.CANCEL_SCHEDULED,
        providerCancellationState: PROVIDER_CANCELLATION_SCHEDULED,
        providerStatus: provider.status ?? subscription.providerStatus,
      },
    });
    if (confirmed.count === 0) {
      throw new ConflictException(
        "Provider cancellation was scheduled but local confirmation requires reconciliation.",
      );
    }

    const updated = await this.prisma.brandSubscription.findUniqueOrThrow({
      where: { brandProfileId },
      include: { featureUsages: true },
    });
    await this.syncLegacyBrandProfileFields(brandProfileId, updated);
    return this.subscriptionAccess.toReadModel(updated);
  }

  private async startCancellationContinuation(subscription: {
    brandProfileId: string;
    currentPeriodEnd: Date;
    continuationRazorpaySubscriptionId: string | null;
  }) {
    await this.brandSettings.requireCompleteBillingProfile(
      subscription.brandProfileId,
    );
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: subscription.brandProfileId },
      select: { countryCode: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    const razorpayKeyId = this.config.get<string>("RAZORPAY_API_KEY_ID", "");
    if (!razorpayKeyId) {
      throw new BadRequestException("Razorpay is not configured for checkout.");
    }

    if (subscription.continuationRazorpaySubscriptionId) {
      return {
        subscription: await this.getSubscription(subscription.brandProfileId),
        checkout: {
          subscriptionId: subscription.continuationRazorpaySubscriptionId,
          razorpayKeyId,
          targetTier: SubscriptionTier.FOUNDERS_BETA,
        },
        recovery_mode: "continuation_authorization" as const,
      };
    }

    const currency = this.geoRouting.resolveGeoContext(
      profile.countryCode,
    ).currency;
    const planId = await this.planProvisioning.resolvePlanId(
      SubscriptionTier.FOUNDERS_BETA,
      currency,
    );
    const provider = await this.razorpay.createFutureSubscription(
      planId,
      Math.floor(subscription.currentPeriodEnd.getTime() / 1000),
      {
        brand_profile_id: subscription.brandProfileId,
        target_tier: SubscriptionTier.FOUNDERS_BETA,
      },
    );
    const updated = await this.prisma.brandSubscription.update({
      where: { brandProfileId: subscription.brandProfileId },
      data: {
        currency: currency as SubscriptionCurrency,
        continuationRazorpaySubscriptionId: provider.id,
        continuationRazorpayPlanId: planId,
        continuationProviderStatus: provider.status ?? "created",
        continuationStartsAt: subscription.currentPeriodEnd,
      },
      include: { featureUsages: true },
    });

    return {
      subscription: this.subscriptionAccess.toReadModel(updated),
      checkout: {
        subscriptionId: provider.id,
        razorpayKeyId,
        targetTier: SubscriptionTier.FOUNDERS_BETA,
      },
      recovery_mode: "continuation_authorization" as const,
    };
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

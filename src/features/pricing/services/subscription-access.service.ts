import { Injectable } from "@nestjs/common";
import {
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
  type BrandSubscription,
} from "@prisma/client";

import {
  FOUNDERS_BETA_COMMISSION_RATE,
  RAZORPAY_PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
} from "../constants/subscription.constants";
import type {
  SubscriptionAccessMode,
  SubscriptionLifecycleStatus,
  SubscriptionRequiredAction,
} from "../types";

type SubscriptionLifecycleInput = Pick<
  BrandSubscription,
  "status" | "trialEndsAt" | "cancelEffectiveAt" | "paymentGraceEndsAt"
>;

@Injectable()
export class SubscriptionAccessService {
  derive(
    subscription: SubscriptionLifecycleInput,
    now = new Date(),
  ): {
    lifecycleStatus: SubscriptionLifecycleStatus;
    accessMode: SubscriptionAccessMode;
    requiredAction: SubscriptionRequiredAction;
  } {
    if (
      subscription.status === SubscriptionStatus.TRIAL_EXPIRED ||
      (subscription.status === SubscriptionStatus.TRIALING &&
        subscription.trialEndsAt !== null &&
        subscription.trialEndsAt <= now)
    ) {
      return {
        lifecycleStatus: "TRIAL_EXPIRED",
        accessMode: "RESTRICTED_WIND_DOWN",
        requiredAction: "PAYMENT_REQUIRED",
      };
    }

    if (subscription.status === SubscriptionStatus.TRIALING) {
      return this.fullAccess("TRIALING");
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return this.fullAccess("ACTIVE");
    }

    if (subscription.status === SubscriptionStatus.CANCEL_SCHEDULED) {
      const cancellationEffective =
        subscription.cancelEffectiveAt !== null &&
        subscription.cancelEffectiveAt <= now;
      return {
        lifecycleStatus: cancellationEffective
          ? "CANCELLED"
          : "CANCEL_SCHEDULED",
        accessMode: cancellationEffective
          ? "RESTRICTED_WIND_DOWN"
          : "FULL_ACCESS",
        requiredAction: "NONE",
      };
    }

    if (subscription.status === SubscriptionStatus.PAST_DUE) {
      const graceExpired =
        subscription.paymentGraceEndsAt === null ||
        subscription.paymentGraceEndsAt <= now;
      return {
        lifecycleStatus: graceExpired ? "HALTED" : "PAST_DUE",
        accessMode: graceExpired ? "RESTRICTED_WIND_DOWN" : "FULL_ACCESS",
        requiredAction: "UPDATE_PAYMENT_METHOD",
      };
    }

    return {
      lifecycleStatus:
        subscription.status === SubscriptionStatus.CANCELED
          ? "CANCELLED"
          : "HALTED",
      accessMode: "RESTRICTED_WIND_DOWN",
      requiredAction: "NONE",
    };
  }

  toReadModel(subscription: BrandSubscription) {
    const authority = this.derive(subscription);
    const currency =
      subscription.currency === SubscriptionCurrency.INR ? "INR" : "USD";
    const foundersTerms = RAZORPAY_PLAN_DEFINITIONS.FOUNDERS_BETA[currency];

    return {
      ...subscription,
      ...authority,
      plan: subscription.tier,
      commercialTerms:
        subscription.tier === SubscriptionTier.FOUNDERS_BETA
          ? {
              amountMinor: foundersTerms.amountMinor,
              currency,
              billingInterval: "MONTH" as const,
              trialDays: TRIAL_DURATION_DAYS,
              platformCommissionRate: FOUNDERS_BETA_COMMISSION_RATE,
              taxInclusive: currency === "INR",
            }
          : null,
    };
  }

  private fullAccess(lifecycleStatus: "TRIALING" | "ACTIVE") {
    return {
      lifecycleStatus,
      accessMode: "FULL_ACCESS" as const,
      requiredAction: "NONE" as const,
    };
  }
}

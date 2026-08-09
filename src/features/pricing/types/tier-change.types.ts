import type { BrandSubscription, FeatureUsage, SubscriptionTier } from "@prisma/client";

export type PricingCheckoutSession = {
  subscriptionId: string;
  razorpayKeyId: string;
  targetTier: SubscriptionTier;
};

export type TierChangeResult = {
  subscription: BrandSubscription & { featureUsages: FeatureUsage[] };
  checkout: PricingCheckoutSession | null;
};

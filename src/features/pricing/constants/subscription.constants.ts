import { SubscriptionTier } from "@prisma/client";

export type BillableSubscriptionTier = Extract<
  SubscriptionTier,
  "FOUNDERS_BETA"
>;
export type ProviderMappedSubscriptionTier = Exclude<
  SubscriptionTier,
  "ENTERPRISE"
>;

export type RazorpayPlanCurrency = "INR" | "USD";

export type RazorpayPlanDefinition = {
  name: string;
  description: string;
  amountMinor: number;
  currency: RazorpayPlanCurrency;
};

/**
 * Provider compatibility definitions in minor units (USD cents / INR paise).
 * Only FOUNDERS_BETA is purchasable Product authority for MVP.
 */
export const RAZORPAY_PLAN_DEFINITIONS: Record<
  ProviderMappedSubscriptionTier,
  Record<RazorpayPlanCurrency, RazorpayPlanDefinition>
> = {
  FOUNDERS_BETA: {
    INR: {
      name: "Founder's Beta",
      description: "Founder's Beta monthly — Creator Commerce",
      amountMinor: 999_000,
      currency: "INR",
    },
    USD: {
      name: "Founder's Beta",
      description: "Founder's Beta monthly — Creator Commerce",
      amountMinor: 9900,
      currency: "USD",
    },
  },
  GROWTH_STARTER: {
    INR: {
      name: "Growth Starter",
      description: "Legacy Growth Starter provider mapping",
      amountMinor: 1_490_000,
      currency: "INR",
    },
    USD: {
      name: "Growth Starter",
      description: "Legacy Growth Starter provider mapping",
      amountMinor: 14_900,
      currency: "USD",
    },
  },
  PROFESSIONAL: {
    INR: {
      name: "Professional",
      description: "Legacy Professional provider mapping",
      amountMinor: 3_400_000,
      currency: "INR",
    },
    USD: {
      name: "Professional",
      description: "Legacy Professional provider mapping",
      amountMinor: 39_900,
      currency: "USD",
    },
  },
};

/** Optional dashboard plan id hints; resolved or auto-created via Razorpay Plans API. */
export const PLAN_MAPPINGS: Record<
  ProviderMappedSubscriptionTier,
  Record<RazorpayPlanCurrency, string>
> = {
  FOUNDERS_BETA: {
    INR: "plan_inr_founders_9900",
    USD: "plan_usd_founders_99",
  },
  GROWTH_STARTER: {
    INR: "plan_inr_growth_14900",
    USD: "plan_usd_growth_149",
  },
  PROFESSIONAL: {
    INR: "plan_inr_pro_39900",
    USD: "plan_usd_pro_399",
  },
};

export const FEATURE_LIMIT_KEYS = [
  "MAX_RIVALS",
  "MAX_DEEP_SCANS_MONTHLY",
  "MAX_PRODUCTS",
  "MAX_COLLECTIONS",
  "MAX_LOCATIONS",
  "MAX_MANAGED_OUTREACH",
  "MAX_AI_CHATS",
  "ESCROW_AGGREGATE_CAP",
] as const;

export type FeatureLimitKey = (typeof FEATURE_LIMIT_KEYS)[number];

export const FEATURE_LIMITS: Record<
  SubscriptionTier,
  Record<FeatureLimitKey, number>
> = {
  FOUNDERS_BETA: {
    MAX_RIVALS: 3,
    MAX_DEEP_SCANS_MONTHLY: 1,
    MAX_PRODUCTS: 5,
    MAX_COLLECTIONS: 3,
    MAX_LOCATIONS: 3,
    MAX_MANAGED_OUTREACH: 100,
    MAX_AI_CHATS: 50,
    ESCROW_AGGREGATE_CAP: 500_000,
  },
  GROWTH_STARTER: {
    MAX_RIVALS: 5,
    MAX_DEEP_SCANS_MONTHLY: 2,
    MAX_PRODUCTS: 10,
    MAX_COLLECTIONS: 5,
    MAX_LOCATIONS: 5,
    MAX_MANAGED_OUTREACH: 250,
    MAX_AI_CHATS: 150,
    ESCROW_AGGREGATE_CAP: 1_500_000,
  },
  PROFESSIONAL: {
    MAX_RIVALS: 10,
    MAX_DEEP_SCANS_MONTHLY: 5,
    MAX_PRODUCTS: 20,
    MAX_COLLECTIONS: 10,
    MAX_LOCATIONS: 10,
    MAX_MANAGED_OUTREACH: 500,
    MAX_AI_CHATS: 1000,
    ESCROW_AGGREGATE_CAP: 5_000_000,
  },
  ENTERPRISE: {
    MAX_RIVALS: 999_999,
    MAX_DEEP_SCANS_MONTHLY: 999_999,
    MAX_PRODUCTS: 999_999,
    MAX_COLLECTIONS: 999_999,
    MAX_LOCATIONS: 999_999,
    MAX_MANAGED_OUTREACH: 999_999,
    MAX_AI_CHATS: 999_999,
    ESCROW_AGGREGATE_CAP: 999_999_999,
  },
};

/** Legacy future-tier values are compatibility data, not purchasable MVP terms. */
export const LEGACY_ESCROW_TAKE_RATES: Record<SubscriptionTier, number> = {
  FOUNDERS_BETA: 0.07,
  GROWTH_STARTER: 0.06,
  PROFESSIONAL: 0.05,
  ENTERPRISE: 0.02,
};

export const FOUNDERS_BETA_COMMISSION_RATE = 0.07;

export const CYCLIC_FEATURE_KEYS: FeatureLimitKey[] = [
  "MAX_DEEP_SCANS_MONTHLY",
  "MAX_MANAGED_OUTREACH",
  "MAX_AI_CHATS",
];

export const TRIAL_DURATION_DAYS = 30;

export const PROVIDER_CANCELLATION_PENDING = "SCHEDULE_PENDING";
export const PROVIDER_CANCELLATION_SCHEDULED = "SCHEDULED";

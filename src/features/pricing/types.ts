import type { FeatureLimitKey } from "./constants/subscription.constants";

export type GeoZone = "ZONE_IN" | "ZONE_US" | "ZONE_ROW";

export interface GeoContext {
  zone: GeoZone;
  currency: "INR" | "USD";
  complianceWarning?: string;
}

export interface CatalogPlanView {
  tierKey: string;
  name: string;
  priceDescriptor: string;
  isPubliclyAvailable: boolean;
  availability: "PURCHASABLE" | "UPCOMING";
  isPurchasable: boolean;
  currency: "INR" | "USD" | null;
  amountMinor: number | null;
  billingInterval: "MONTH" | null;
  trialDays: number | null;
  platformCommissionRate: number | null;
  taxInclusive: boolean | null;
}

export type SubscriptionLifecycleStatus =
  | "TRIALING"
  | "TRIAL_EXPIRED"
  | "ACTIVE"
  | "CANCEL_SCHEDULED"
  | "CANCELLED"
  | "PAST_DUE"
  | "HALTED";

export type SubscriptionAccessMode = "FULL_ACCESS" | "RESTRICTED_WIND_DOWN";

export type SubscriptionRequiredAction =
  | "NONE"
  | "PAYMENT_REQUIRED"
  | "UPDATE_PAYMENT_METHOD";

export type EntitlementFeatureKey = Exclude<
  FeatureLimitKey,
  "ESCROW_AGGREGATE_CAP"
>;

export { SUBSCRIPTION_CAPABILITIES } from "./types/subscription-capability.types";
export type {
  SubscriptionCapability,
  SubscriptionCapabilityDecision,
} from "./types/subscription-capability.types";

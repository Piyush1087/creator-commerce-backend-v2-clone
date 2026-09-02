export const SUBSCRIPTION_CAPABILITIES = [
  "AI_SCAN_START",
  "CAMPAIGN_PUBLISH",
  "APPLICATION_CREATE",
  "COLLABORATION_CREATE",
  "ESCROW_TOP_UP",
  "ESCROW_RESERVE",
] as const;

export type SubscriptionCapability = (typeof SUBSCRIPTION_CAPABILITIES)[number];

export type SubscriptionCapabilityDecision = {
  allowed: boolean;
  code: "ALLOWED" | "SUBSCRIPTION_RESTRICTED";
  access_mode: "FULL_ACCESS" | "RESTRICTED_WIND_DOWN";
  lifecycle_status:
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCEL_SCHEDULED"
    | "TRIAL_EXPIRED"
    | "CANCELLED"
    | "HALTED";
  required_action: "NONE" | "PAYMENT_REQUIRED" | "UPDATE_PAYMENT_METHOD";
  blocked_capability: SubscriptionCapability | null;
};

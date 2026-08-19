export type CanonicalObjective = "PULSE" | "PROOF" | "PRODUCTION" | "PUSH";
export type CanonicalCurrency = "INR" | "USD";

export type CanonicalReadinessReady = {
  objective: CanonicalObjective;
  status: "READY";
  currency: CanonicalCurrency;
  primaryKpi: string;
  supportingKpis: string[];
  revision: string;
};

export type CanonicalReadinessNotReady = {
  objective: null;
  status: "NOT_READY";
  reason: "OBJECTIVE_REQUIRED";
};

export type CanonicalReadinessConfigurationUnavailable = {
  objective: CanonicalObjective;
  status: "FAILED";
  reason: "SUPPORTING_KPI_CONFIGURATION_UNAVAILABLE";
  retryable: false;
  revision: string;
};

export type CanonicalCampaignReadiness =
  | CanonicalReadinessReady
  | CanonicalReadinessNotReady
  | CanonicalReadinessConfigurationUnavailable;

const PRIMARY_KPI: Record<CanonicalObjective, string> = {
  PULSE: "REACH",
  PROOF: "MEANINGFUL_ENGAGEMENT",
  PRODUCTION: "ASSET_QUALITY_SCORE",
  PUSH: "UNIQUE_CTA_CLICKS",
};

const SUPPORTING_KPIS: Record<
  "D2C" | "SAAS_AI" | "HEALTHCARE",
  Record<CanonicalObjective, readonly string[]>
> = {
  D2C: {
    PULSE: ["DISCOVER_REACH", "IMPRESSIONS", "PROFILE_VISITS", "NEW_FOLLOWERS"],
    PROOF: ["SAVES", "SHARES", "COMMENT_SENTIMENT", "UGC_MENTIONS"],
    PRODUCTION: [
      "BRAND_COMPLIANCE",
      "CREATIVE_VARIETY",
      "VISUAL_QUALITY",
      "ASSET_REUSABILITY",
    ],
    PUSH: ["CTR", "TOTAL_CTA_CLICKS", "REPEAT_CLICKS", "PROMO_LINK_CLICKS"],
  },
  SAAS_AI: {
    PULSE: ["IMPRESSIONS", "PROFILE_VISITS", "WEBSITE_CLICKS", "NEW_FOLLOWERS"],
    PROOF: ["STORY_COMPLETION_RATE", "SAVES", "PROFILE_VISITS", "DM_INQUIRIES"],
    PRODUCTION: [
      "FEATURE_CLARITY",
      "SCREEN_RECORDING_QUALITY",
      "TECHNICAL_ACCURACY",
      "ASSET_REUSABILITY",
    ],
    PUSH: [
      "CTR",
      "LANDING_PAGE_VISITS",
      "DOCUMENTATION_CLICKS",
      "TRIAL_PAGE_VISITS",
    ],
  },
  HEALTHCARE: {
    PULSE: [
      "LOCAL_REACH",
      "PROFILE_VISITS",
      "NEW_FOLLOWERS",
      "LOCAL_AUDIENCE_PERCENT",
    ],
    PROOF: ["DM_INQUIRIES", "SAVES", "SHARES", "COMMENT_SENTIMENT"],
    PRODUCTION: [
      "MEDICAL_COMPLIANCE",
      "BRAND_COMPLIANCE",
      "EDUCATIONAL_ACCURACY",
      "ASSET_REUSABILITY",
    ],
    PUSH: [
      "WHATSAPP_CLICKS",
      "BOOKING_PAGE_CLICKS",
      "MAPS_CLICKS",
      "TOTAL_CTA_CLICKS",
    ],
  },
};

export function resolveCanonicalCampaignReadiness(
  objective: CanonicalObjective | null | undefined,
  industry: string | null | undefined,
  countryCode: string | null | undefined,
): CanonicalCampaignReadiness {
  if (!objective) {
    return {
      objective: null,
      status: "NOT_READY",
      reason: "OBJECTIVE_REQUIRED",
    };
  }

  const revision = `objective:${objective}`;
  const supportingKpis =
    SUPPORTING_KPIS[industry as keyof typeof SUPPORTING_KPIS]?.[objective];
  if (!supportingKpis || supportingKpis.length < 2) {
    return {
      objective,
      status: "FAILED",
      reason: "SUPPORTING_KPI_CONFIGURATION_UNAVAILABLE",
      retryable: false,
      revision,
    };
  }

  return {
    objective,
    status: "READY",
    currency: (countryCode ?? "").toUpperCase() === "IN" ? "INR" : "USD",
    primaryKpi: PRIMARY_KPI[objective],
    supportingKpis: [...supportingKpis],
    revision,
  };
}

export function canonicalDerivedProjection(readiness: CanonicalReadinessReady) {
  return {
    currency: readiness.currency,
    primaryKpi: readiness.primaryKpi,
    supportingKpis: [...readiness.supportingKpis],
    supportingKpiStatus: "READY" as const,
  };
}

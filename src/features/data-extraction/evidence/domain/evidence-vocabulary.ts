export const WAVE1_EVIDENCE_CAPABILITIES = [
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
  "observed_brand_communication_language_signals",
  "derived_communication_constraint_evidence",
] as const;

export type EvidenceCapabilityId = (typeof WAVE1_EVIDENCE_CAPABILITIES)[number];

export type CapabilityAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "NOT_REQUESTED";

export type EvidenceFreshness = "CURRENT" | "POSSIBLY_STALE" | "UNKNOWN";

export type EvidenceRepresentativeness =
  | "PERSISTENT_BRAND_LEVEL"
  | "REPEATED_REPRESENTATIVE"
  | "CONTEXT_SPECIFIC"
  | "OFFERING_SPECIFIC"
  | "INCIDENTAL";

export type EvidenceCoverage =
  | "SINGLE_RESOURCE"
  | "MULTI_RESOURCE_PARTIAL"
  | "MULTI_RESOURCE_BROAD"
  | "SITE_WIDE_BOUNDED";

export type AcquisitionQuality =
  | "COMPLETE"
  | "PARTIAL"
  | "DEGRADED"
  | "UNAVAILABLE";

export type EvidencePolarity =
  | "AFFIRMATIVE"
  | "EXPLICIT_NEGATIVE"
  | "RESTRICTION"
  | "NEUTRAL";

export type EvidenceSourceClass = "OWNED_WEBSITE";
export type EvidenceResourceType = "OWNED_WEB_PAGE" | "OWNED_WEB_FRAGMENT";

export type EvidencePageRole =
  | "HOMEPAGE"
  | "ABOUT_COMPANY"
  | "BRAND_STORY"
  | "MISSION_VALUES"
  | "COMPANY_OVERVIEW"
  | "PORTFOLIO_OVERVIEW"
  | "CATEGORY_OVERVIEW"
  | "SERVICE_OVERVIEW"
  | "SOLUTIONS_OVERVIEW"
  | "PRICING_PLANS"
  | "OFFERING_DETAIL"
  | "CAMPAIGN_LANDING"
  | "POLICY"
  | "LEGAL"
  | "TESTIMONIAL"
  | "SUPPORT"
  | "FAQ_HELP"
  | "LOCALIZED_VARIANT"
  | "OTHER";

export type EvidenceRetryability =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "NOT_APPLICABLE";

export type EvidenceFreshnessIntent =
  | "REUSE_ALLOWED"
  | "REFRESH_IF_NOT_CURRENT"
  | "FORCE_RECAPTURE";

export interface EvidenceAcquisitionQuality {
  readonly state: AcquisitionQuality;
  readonly failureCategories: readonly string[];
  readonly detailCodes: readonly string[];
}

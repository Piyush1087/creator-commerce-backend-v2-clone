import { IndustryVertical } from "@prisma/client";

export const GATEKEEPER_RESULT_VERSION = "gatekeeper_v1" as const;
export const GATEKEEPER_PROCESSOR_ID = "gatekeeper_site_assessment" as const;
export const GATEKEEPER_PROFILE_ID = "gatekeeper_scan" as const;

export const SUPPORTED_MVP_INDUSTRIES = [
  IndustryVertical.D2C,
  IndustryVertical.SAAS_AI,
  IndustryVertical.HEALTHCARE,
  IndustryVertical.OFFLINE_SERVICES,
] as const;

export type GatekeeperAssessmentConfidence = "HIGH" | "MEDIUM" | "LOW";
export type GatekeeperEntityCategory =
  | "BRAND"
  | "MARKETPLACE"
  | "CREATOR_MARKETING_PLATFORM"
  | "NON_COMMERCIAL_ENTITY"
  | "UNKNOWN";
export type GatekeeperEnglishEvidenceStatus =
  | "SUFFICIENT"
  | "INSUFFICIENT"
  | "UNCERTAIN";
export type GatekeeperCreatorMarketingApplicability =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "UNCERTAIN";
export type GatekeeperCommercialDestinationType =
  | "WEBSITE"
  | "APP_STORE"
  | "PLAY_STORE"
  | "DIRECT_APK"
  | "LEAD_GENERATION"
  | "BOOKING"
  | "OFFLINE_LOCATION"
  | "SALES_CONTACT"
  | "MULTI_DESTINATION";

export type GatekeeperSiteAssessment = {
  provisional_industry: IndustryVertical | null;
  provisional_sub_industry: string | null;
  entity_category: GatekeeperEntityCategory;
  english_evidence_status: GatekeeperEnglishEvidenceStatus;
  creator_marketing_applicability: GatekeeperCreatorMarketingApplicability;
  commercial_destination_types: GatekeeperCommercialDestinationType[];
  assessment_confidence: GatekeeperAssessmentConfidence;
};

export type GatekeeperOutcome =
  | "ADMITTED"
  | "RESUME_AVAILABLE"
  | "EXISTING_BRAND"
  | "ORG_CLAIMED"
  | "VERIFICATION_REQUIRED"
  | "UNSUPPORTED"
  | "UNSUPPORTED_LANGUAGE"
  | "CLASSIFICATION_UNCERTAIN"
  | "HARD_BLOCKED"
  | "DOMAIN_UNREACHABLE"
  | "DOMAIN_INVALID"
  | "TECHNICAL_FAILURE";

export type GatekeeperRecoveryAction =
  | "CONTINUE"
  | "RESUME"
  | "SIGN_IN"
  | "REQUEST_ORG_ACCESS"
  | "VERIFY_DOMAIN"
  | "JOIN_WAITLIST"
  | "REQUEST_CLASSIFICATION_REVIEW"
  | "RETRY"
  | "CONTACT_SUPPORT";

export type GatekeeperReasonCode =
  | "INVALID_URL"
  | "PRIVATE_OR_LOCAL_HOST"
  | "PROHIBITED_URL"
  | "BLOCKED_DOMAIN_OR_TLD"
  | "EXISTING_VERIFIED_BRAND"
  | "ORGANIZATION_ALREADY_CLAIMED"
  | "RECENT_RESUMABLE_SCAN"
  | "DOMAIN_VERIFICATION_REQUIRED"
  | "DNS_OR_TIMEOUT"
  | "REDIRECT_INTEGRITY_FAILED"
  | "PARKED_OR_UNUSABLE_WEBSITE"
  | "INSUFFICIENT_ENGLISH_EVIDENCE"
  | "UNSUPPORTED_INDUSTRY"
  | "CREATOR_MARKETING_NOT_APPLICABLE"
  | "HARD_BLOCKED_INDUSTRY"
  | "UNKNOWN_CLASSIFICATION"
  | "AMBIGUOUS_ENTITY"
  | "CONFLICTING_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "PROVIDER_CHAIN_EXHAUSTED";

export type GatekeeperDecision = {
  outcome: GatekeeperOutcome;
  reason_code: GatekeeperReasonCode | null;
  recovery_actions: GatekeeperRecoveryAction[];
  manual_review_eligible: boolean;
};

export type GatekeeperStageState =
  | "NOT_RUN"
  | "SUCCEEDED"
  | "FAILED_PRECHECK"
  | "TECHNICAL_FAILURE"
  | "SEMANTIC_UNCERTAINTY";

export type GatekeeperExecutionTrace = {
  primary: GatekeeperStageState;
  parallel: GatekeeperStageState;
  reassessment: GatekeeperStageState;
  openai: GatekeeperStageState;
};

export type GatekeeperConfirmationSource =
  | "AI_ASSESSED_ACCEPTED"
  | "USER_CONFIRMED_OVERRIDE"
  | "USER_CONFIRMED_UNSUPPORTED";

export type GatekeeperConfirmation = {
  assessed_industry: IndustryVertical | null;
  confirmed_industry: IndustryVertical | null;
  confirmation_source: GatekeeperConfirmationSource | null;
  industry_disagreement_flag: boolean;
  surface_eligible: boolean;
};

export type GatekeeperStructuredResult = {
  version: typeof GATEKEEPER_RESULT_VERSION;
  submission: {
    normalized_url: string;
    normalized_domain: string;
  };
  assessment: GatekeeperSiteAssessment | null;
  decision: GatekeeperDecision;
  confirmation: GatekeeperConfirmation;
  handoff: {
    gatekeeper_completed: boolean;
    confirmed_industry_required: boolean;
  };
  execution: GatekeeperExecutionTrace;
};

export type GatekeeperSurfaceHandoff = {
  normalized_url: string;
  normalized_domain: string;
  confirmed_industry: IndustryVertical;
  gatekeeper_completed: true;
  provisional_sub_industry?: string;
};

export type GatekeeperConfirmationResult = {
  leadId: string;
  gatekeeper_result: GatekeeperStructuredResult;
  surface_handoff: GatekeeperSurfaceHandoff | null;
};

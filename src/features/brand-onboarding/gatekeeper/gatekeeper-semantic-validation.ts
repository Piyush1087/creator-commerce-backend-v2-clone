import { IndustryVertical } from "@prisma/client";

import type { GatekeeperSiteAssessment } from "./gatekeeper-v1.types";

export type GatekeeperSemanticValidation = {
  valid: boolean;
  admissionCriticalUncertainty: boolean;
  reason:
    | "LOW_CONFIDENCE"
    | "UNKNOWN_CLASSIFICATION"
    | "AMBIGUOUS_ENTITY"
    | "INSUFFICIENT_EVIDENCE"
    | null;
};

export function validateGatekeeperAssessmentSemantics(
  assessment: GatekeeperSiteAssessment,
): GatekeeperSemanticValidation {
  if (assessment.assessment_confidence === "LOW") {
    return {
      valid: true,
      admissionCriticalUncertainty: true,
      reason: "LOW_CONFIDENCE",
    };
  }
  if (
    assessment.provisional_industry == null ||
    assessment.provisional_industry === IndustryVertical.UNKNOWN
  ) {
    return {
      valid: true,
      admissionCriticalUncertainty: true,
      reason: "UNKNOWN_CLASSIFICATION",
    };
  }
  if (assessment.entity_category === "UNKNOWN") {
    return {
      valid: true,
      admissionCriticalUncertainty: true,
      reason: "AMBIGUOUS_ENTITY",
    };
  }
  if (
    assessment.english_evidence_status === "UNCERTAIN" ||
    assessment.creator_marketing_applicability === "UNCERTAIN"
  ) {
    return {
      valid: true,
      admissionCriticalUncertainty: true,
      reason: "INSUFFICIENT_EVIDENCE",
    };
  }

  // MEDIUM is not a fallback trigger by itself. If all admission-critical
  // dimensions resolve cleanly, the assessment may proceed to policy decision.
  return { valid: true, admissionCriticalUncertainty: false, reason: null };
}

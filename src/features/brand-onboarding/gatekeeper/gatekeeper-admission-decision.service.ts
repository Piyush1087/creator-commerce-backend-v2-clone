import { Injectable } from "@nestjs/common";
import { IndustryVertical } from "@prisma/client";

import type {
  GatekeeperDecision,
  GatekeeperSiteAssessment,
} from "./gatekeeper-v1.types";
import { SUPPORTED_MVP_INDUSTRIES } from "./gatekeeper-v1.types";

const SUPPORTED = new Set<IndustryVertical>(SUPPORTED_MVP_INDUSTRIES);
const HARD_BLOCKED = new Set<IndustryVertical>([
  IndustryVertical.GAMBLING,
  IndustryVertical.ADULT,
  IndustryVertical.FRAUDULENT_HIGH_RISK,
]);

@Injectable()
export class GatekeeperAdmissionDecisionService {
  resolve(assessment: GatekeeperSiteAssessment): GatekeeperDecision {
    if (
      assessment.provisional_industry != null &&
      HARD_BLOCKED.has(assessment.provisional_industry)
    ) {
      return {
        outcome: "HARD_BLOCKED",
        reason_code: "HARD_BLOCKED_INDUSTRY",
        recovery_actions: ["CONTACT_SUPPORT"],
        manual_review_eligible: false,
      };
    }
    if (assessment.english_evidence_status === "INSUFFICIENT") {
      return {
        outcome: "UNSUPPORTED_LANGUAGE",
        reason_code: "INSUFFICIENT_ENGLISH_EVIDENCE",
        recovery_actions: ["JOIN_WAITLIST"],
        manual_review_eligible: false,
      };
    }
    if (assessment.assessment_confidence === "LOW") {
      return this.uncertain("INSUFFICIENT_EVIDENCE");
    }
    if (
      assessment.provisional_industry == null ||
      assessment.provisional_industry === IndustryVertical.UNKNOWN
    ) {
      return this.uncertain("UNKNOWN_CLASSIFICATION");
    }
    if (assessment.entity_category === "UNKNOWN") {
      return this.uncertain("AMBIGUOUS_ENTITY");
    }
    if (
      assessment.english_evidence_status === "UNCERTAIN" ||
      assessment.creator_marketing_applicability === "UNCERTAIN"
    ) {
      return this.uncertain("INSUFFICIENT_EVIDENCE");
    }
    if (assessment.creator_marketing_applicability === "NOT_APPLICABLE") {
      return {
        outcome: "UNSUPPORTED",
        reason_code: "CREATOR_MARKETING_NOT_APPLICABLE",
        recovery_actions: ["JOIN_WAITLIST", "REQUEST_CLASSIFICATION_REVIEW"],
        manual_review_eligible: true,
      };
    }
    if (
      assessment.entity_category === "CREATOR_MARKETING_PLATFORM" ||
      assessment.entity_category === "NON_COMMERCIAL_ENTITY" ||
      !SUPPORTED.has(assessment.provisional_industry)
    ) {
      return {
        outcome: "UNSUPPORTED",
        reason_code: "UNSUPPORTED_INDUSTRY",
        recovery_actions: ["JOIN_WAITLIST", "REQUEST_CLASSIFICATION_REVIEW"],
        manual_review_eligible: true,
      };
    }
    return {
      outcome: "ADMITTED",
      reason_code: null,
      recovery_actions: ["CONTINUE"],
      manual_review_eligible: false,
    };
  }

  private uncertain(
    reason:
      | "UNKNOWN_CLASSIFICATION"
      | "AMBIGUOUS_ENTITY"
      | "INSUFFICIENT_EVIDENCE",
  ): GatekeeperDecision {
    return {
      outcome: "CLASSIFICATION_UNCERTAIN",
      reason_code: reason,
      recovery_actions: ["REQUEST_CLASSIFICATION_REVIEW", "RETRY"],
      manual_review_eligible: true,
    };
  }
}

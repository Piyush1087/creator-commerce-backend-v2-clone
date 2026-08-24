import { IndustryVertical } from "@prisma/client";
import { z } from "zod";

export const GatekeeperSiteAssessmentSchema = z
  .object({
    provisional_industry: z.nativeEnum(IndustryVertical).nullable(),
    // Gatekeeper-specific path: deliberately free-form. Downstream controlled
    // Identity Sub-industry validators remain separate and unchanged.
    provisional_sub_industry: z.string().trim().min(1).max(160).nullable(),
    entity_category: z.enum([
      "BRAND",
      "MARKETPLACE",
      "CREATOR_MARKETING_PLATFORM",
      "NON_COMMERCIAL_ENTITY",
      "UNKNOWN",
    ]),
    english_evidence_status: z.enum([
      "SUFFICIENT",
      "INSUFFICIENT",
      "UNCERTAIN",
    ]),
    creator_marketing_applicability: z.enum([
      "APPLICABLE",
      "NOT_APPLICABLE",
      "UNCERTAIN",
    ]),
    commercial_destination_types: z
      .array(
        z.enum([
          "WEBSITE",
          "APP_STORE",
          "PLAY_STORE",
          "DIRECT_APK",
          "LEAD_GENERATION",
          "BOOKING",
          "OFFLINE_LOCATION",
          "SALES_CONTACT",
          "MULTI_DESTINATION",
        ]),
      )
      .refine((values) => new Set(values).size === values.length, {
        message: "commercial_destination_types must contain unique values",
      }),
    assessment_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })
  .strict();

export type GatekeeperSiteAssessmentPayload = z.infer<
  typeof GatekeeperSiteAssessmentSchema
>;

export type GatekeeperSemanticReason =
  | "LOW_CONFIDENCE"
  | "UNKNOWN_CLASSIFICATION"
  | "AMBIGUOUS_ENTITY"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_EVIDENCE"
  | null;

export type GatekeeperSemanticValidation = {
  admissionCriticalUncertainty: boolean;
  reason: GatekeeperSemanticReason;
};

export function validateGatekeeperAssessmentSemantics(
  assessment: GatekeeperSiteAssessmentPayload,
  evidenceQualityFlags: readonly string[] = [],
): GatekeeperSemanticValidation {
  if (assessment.assessment_confidence === "LOW") {
    return { admissionCriticalUncertainty: true, reason: "LOW_CONFIDENCE" };
  }
  if (
    assessment.provisional_industry == null ||
    assessment.provisional_industry === IndustryVertical.UNKNOWN
  ) {
    return {
      admissionCriticalUncertainty: true,
      reason: "UNKNOWN_CLASSIFICATION",
    };
  }
  if (assessment.entity_category === "UNKNOWN") {
    return { admissionCriticalUncertainty: true, reason: "AMBIGUOUS_ENTITY" };
  }
  if (
    assessment.english_evidence_status === "UNCERTAIN" ||
    assessment.creator_marketing_applicability === "UNCERTAIN"
  ) {
    return {
      admissionCriticalUncertainty: true,
      reason: "INSUFFICIENT_EVIDENCE",
    };
  }
  if (
    evidenceQualityFlags.includes("OWNED_DOMAIN_CONTEXT_MISSING") ||
    evidenceQualityFlags.includes("PUBLIC_WEB_GROUNDING_MISSING") ||
    evidenceQualityFlags.includes("CONFLICTING_ADMISSION_CRITICAL_EVIDENCE")
  ) {
    return {
      admissionCriticalUncertainty: true,
      reason: evidenceQualityFlags.includes(
        "CONFLICTING_ADMISSION_CRITICAL_EVIDENCE",
      )
        ? "CONFLICTING_EVIDENCE"
        : "INSUFFICIENT_EVIDENCE",
    };
  }
  return { admissionCriticalUncertainty: false, reason: null };
}

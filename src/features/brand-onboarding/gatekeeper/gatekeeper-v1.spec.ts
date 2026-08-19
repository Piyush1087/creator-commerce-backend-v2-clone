import { IndustryVertical } from "@prisma/client";

import { GatekeeperAdmissionDecisionService } from "./gatekeeper-admission-decision.service";
import { GatekeeperIndustryConfirmationService } from "./gatekeeper-industry-confirmation.service";
import { GatekeeperSiteAssessmentSchema } from "./gatekeeper-site-assessment.schema";
import { GATEKEEPER_RESULT_VERSION } from "./gatekeeper-v1.types";

const base = {
  provisional_industry: IndustryVertical.D2C,
  provisional_sub_industry: "Clean Skincare",
  entity_category: "BRAND" as const,
  english_evidence_status: "SUFFICIENT" as const,
  creator_marketing_applicability: "APPLICABLE" as const,
  commercial_destination_types: ["WEBSITE" as const],
  assessment_confidence: "HIGH" as const,
};

describe("Gatekeeper v1 contracts", () => {
  const decisions = new GatekeeperAdmissionDecisionService();
  const confirmation = new GatekeeperIndustryConfirmationService();

  it("accepts free-form provisional sub-industry and semantic confidence", () => {
    expect(GatekeeperSiteAssessmentSchema.parse(base)).toEqual(base);
  });

  it("rejects numeric confidence", () => {
    expect(() =>
      GatekeeperSiteAssessmentSchema.parse({ ...base, assessment_confidence: 82 }),
    ).toThrow();
  });

  it("admits a supported applicable brand", () => {
    expect(decisions.resolve(base).outcome).toBe("ADMITTED");
  });

  it("does not auto-admit LOW confidence", () => {
    expect(
      decisions.resolve({ ...base, assessment_confidence: "LOW" }).outcome,
    ).toBe("CLASSIFICATION_UNCERTAIN");
  });

  it("hard-blocks explicit hard-block industries", () => {
    const decision = decisions.resolve({
      ...base,
      provisional_industry: IndustryVertical.GAMBLING,
    });
    expect(decision.outcome).toBe("HARD_BLOCKED");
    expect(decision.manual_review_eligible).toBe(false);
  });

  it("allows a confirmed supported Industry to differ and flags review", () => {
    const gatekeeper = {
      version: GATEKEEPER_RESULT_VERSION,
      submission: {
        normalized_url: "https://example.com/",
        normalized_domain: "example.com",
      },
      assessment: base,
      decision: decisions.resolve(base),
      handoff: { gatekeeper_completed: true, confirmed_industry_required: true },
      execution: { primary: "SUCCEEDED" as const, parallel: "NOT_RUN" as const, openai: "NOT_RUN" as const },
    };
    const result = confirmation.confirm({
      gatekeeper,
      selectedIndustry: IndustryVertical.SAAS_AI,
    });
    expect(result.surfaceEligible).toBe(true);
    expect(result.operationalReviewFlag).toBe(true);
    expect(result.surfaceHandoff?.confirmed_industry).toBe(IndustryVertical.SAAS_AI);
  });

  it("blocks unsupported confirmed Industry from Surface handoff", () => {
    const gatekeeper = {
      version: GATEKEEPER_RESULT_VERSION,
      submission: {
        normalized_url: "https://example.com/",
        normalized_domain: "example.com",
      },
      assessment: base,
      decision: decisions.resolve(base),
      handoff: { gatekeeper_completed: true, confirmed_industry_required: true },
      execution: { primary: "SUCCEEDED" as const, parallel: "NOT_RUN" as const, openai: "NOT_RUN" as const },
    };
    const result = confirmation.confirm({
      gatekeeper,
      selectedIndustry: IndustryVertical.MEDIA,
    });
    expect(result.surfaceEligible).toBe(false);
    expect(result.surfaceHandoff).toBeNull();
  });
});

import { IndustryVertical } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GatekeeperGeminiSchema } from "../industry/gatekeeper.schema";
import { GatekeeperAdmissionDecisionService } from "./gatekeeper-admission-decision.service";
import { GatekeeperIndustryConfirmationService } from "./gatekeeper-industry-confirmation.service";
import type { GatekeeperPersistenceService } from "./gatekeeper-persistence.service";
import { GatekeeperSiteAssessmentSchema } from "./gatekeeper-site-assessment.schema";
import {
  GATEKEEPER_RESULT_VERSION,
  type GatekeeperStructuredResult,
} from "./gatekeeper-v1.types";

const assessment = {
  provisional_industry: IndustryVertical.D2C,
  provisional_sub_industry: "Arbitrary Grounded Free Form Specialty",
  entity_category: "BRAND" as const,
  english_evidence_status: "SUFFICIENT" as const,
  creator_marketing_applicability: "APPLICABLE" as const,
  commercial_destination_types: ["WEBSITE" as const],
  assessment_confidence: "HIGH" as const,
};

function gatekeeper(): GatekeeperStructuredResult {
  return {
    version: GATEKEEPER_RESULT_VERSION,
    submission: {
      normalized_url: "https://example.com/",
      normalized_domain: "example.com",
    },
    assessment,
    decision: {
      outcome: "ADMITTED",
      reason_code: null,
      recovery_actions: ["CONTINUE"],
      manual_review_eligible: false,
    },
    confirmation: {
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: null,
      confirmation_source: null,
      industry_disagreement_flag: false,
      surface_eligible: false,
    },
    handoff: {
      gatekeeper_completed: true,
      confirmed_industry_required: true,
    },
    execution: {
      primary: "SUCCEEDED",
      parallel: "NOT_RUN",
      reassessment: "NOT_RUN",
      openai: "NOT_RUN",
    },
  };
}

describe("Gatekeeper validation and confirmation contracts", () => {
  const decisions = new GatekeeperAdmissionDecisionService();
  const getGatekeeperResult = vi.fn();
  const persistConfirmation = vi.fn();
  const persistence = {
    getGatekeeperResult,
    persistConfirmation,
  } as unknown as GatekeeperPersistenceService;
  const confirmation = new GatekeeperIndustryConfirmationService(persistence);

  beforeEach(() => {
    getGatekeeperResult.mockReset();
    persistConfirmation.mockReset();
    getGatekeeperResult.mockResolvedValue(gatekeeper());
    persistConfirmation.mockResolvedValue(undefined);
  });

  it("accepts arbitrary grounded free-form provisional Sub-industry", () => {
    expect(GatekeeperSiteAssessmentSchema.parse(assessment)).toEqual(
      assessment,
    );
  });

  it("rejects numeric Gatekeeper confidence", () => {
    expect(() =>
      GatekeeperSiteAssessmentSchema.parse({
        ...assessment,
        assessment_confidence: 85,
      }),
    ).toThrow();
  });

  it("leaves the legacy downstream classifier contract intact", () => {
    expect(() =>
      GatekeeperGeminiSchema.parse({
        supported: true,
        industry: "D2C",
        sub_industry: "",
        confidence: "HIGH",
      }),
    ).toThrow();
  });

  it("does not auto-admit LOW confidence", () => {
    expect(
      decisions.resolve({ ...assessment, assessment_confidence: "LOW" })
        .outcome,
    ).toBe("CLASSIFICATION_UNCERTAIN");
  });

  it("confirms the same supported Industry as downstream authority", async () => {
    const result = await confirmation.confirm("lead-1", {
      selectedIndustry: IndustryVertical.D2C,
      explicitConfirmation: true,
    });

    expect(result.gatekeeper_result.confirmation).toEqual({
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: IndustryVertical.D2C,
      confirmation_source: "AI_ASSESSED_ACCEPTED",
      industry_disagreement_flag: false,
      surface_eligible: true,
    });
    expect(result.gatekeeper_result.decision.outcome).toBe("ADMITTED");
    expect(result.surface_handoff?.confirmed_industry).toBe(
      IndustryVertical.D2C,
    );
  });

  it("allows an explicit different supported Industry without classification-review semantics", async () => {
    const result = await confirmation.confirm("lead-1", {
      selectedIndustry: IndustryVertical.SAAS_AI,
      explicitConfirmation: true,
    });

    expect(result.gatekeeper_result.confirmation).toMatchObject({
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: IndustryVertical.SAAS_AI,
      confirmation_source: "USER_CONFIRMED_OVERRIDE",
      industry_disagreement_flag: true,
      surface_eligible: true,
    });
    expect(result.gatekeeper_result.assessment?.provisional_industry).toBe(
      IndustryVertical.D2C,
    );
    expect(result.gatekeeper_result.decision.manual_review_eligible).toBe(
      false,
    );
    expect(result.gatekeeper_result.decision.recovery_actions).not.toContain(
      "REQUEST_CLASSIFICATION_REVIEW",
    );
  });

  it("returns authoritative UNSUPPORTED and blocks Surface for unsupported confirmation", async () => {
    const result = await confirmation.confirm("lead-1", {
      selectedIndustry: IndustryVertical.MEDIA,
      explicitConfirmation: true,
    });

    expect(result.gatekeeper_result.confirmation).toMatchObject({
      assessed_industry: IndustryVertical.D2C,
      confirmed_industry: IndustryVertical.MEDIA,
      confirmation_source: "USER_CONFIRMED_UNSUPPORTED",
      industry_disagreement_flag: false,
      surface_eligible: false,
    });
    expect(result.gatekeeper_result.decision).toMatchObject({
      outcome: "UNSUPPORTED",
      reason_code: "UNSUPPORTED_INDUSTRY",
    });
    expect(result.surface_handoff).toBeNull();
  });

  it("limits Surface handoff to the canonical fields", async () => {
    const result = await confirmation.confirm("lead-1", {
      selectedIndustry: IndustryVertical.D2C,
      explicitConfirmation: true,
    });
    expect(Object.keys(result.surface_handoff ?? {}).sort()).toEqual(
      [
        "confirmed_industry",
        "gatekeeper_completed",
        "normalized_domain",
        "normalized_url",
        "provisional_sub_industry",
      ].sort(),
    );
    expect(result.surface_handoff).not.toHaveProperty("assessment_confidence");
    expect(result.surface_handoff).not.toHaveProperty(
      "industry_disagreement_flag",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  BrandPreviewSynthesisSchema,
  evaluateBrandPreviewReadiness,
  validateAndPruneBrandPreview,
  type BrandPreviewSynthesis,
} from "./brand-preview.validation";

const refs = ["owned:https://example.com/"];
const archetypes = [
  { id: "EDUCATOR", label: "Educator", isActive: true },
  { id: "DEMONSTRATOR", label: "Demonstrator", isActive: true },
  { id: "RESEARCHER", label: "Researcher", isActive: true },
];

function output(): BrandPreviewSynthesis {
  return {
    brand_descriptor: "Evidence-led tools for practical teams",
    brand_understanding_narrative:
      "Example builds practical tools that help working teams understand difficult decisions with clear, useful guidance. Its detailed product explanations create a credible role for creators who can demonstrate workflows and make unfamiliar choices easier to evaluate.",
    internal_trace: {
      brand_descriptor: {
        internal_grounding_refs: refs,
        internal_confidence: "HIGH",
      },
      brand_understanding_narrative: {
        internal_grounding_refs: refs,
        internal_confidence: "HIGH",
      },
    },
    audience_groups: [
      {
        id: "evaluating-teams",
        label: "Teams evaluating new tools",
        why_it_matters:
          "They need clear explanations before changing an established workflow.",
        internal_grounding_refs: refs,
        internal_confidence: "HIGH",
      },
      {
        id: "hands-on-users",
        label: "Hands-on users",
        why_it_matters:
          "They want to see how the offering works in a realistic context.",
        internal_grounding_refs: refs,
        internal_confidence: "MEDIUM",
      },
    ],
    creator_marketing_opportunities: [
      {
        title: "Make complex choices easier",
        why_it_matters:
          "Creators can explain the important differences in approachable language.",
        internal_grounding_refs: refs,
        internal_confidence: "HIGH",
      },
      {
        title: "Show the workflow in context",
        why_it_matters:
          "A practical demonstration can connect product detail to a recognizable use situation.",
        internal_grounding_refs: refs,
        internal_confidence: "MEDIUM",
      },
    ],
    creator_archetype_recommendations: [
      {
        archetype_id: "EDUCATOR",
        rationale:
          "Explains complex decisions with useful, evidence-grounded clarity.",
        internal_grounding_refs: refs,
        internal_confidence: "HIGH",
      },
      {
        archetype_id: "DEMONSTRATOR",
        rationale:
          "Shows the offering in realistic use without overclaiming outcomes.",
        internal_grounding_refs: refs,
        internal_confidence: "MEDIUM",
      },
    ],
  };
}

function evaluate(
  candidate: BrandPreviewSynthesis,
  industry = "D2C",
  logo: string | null = "https://example.com/logo.png",
) {
  const validated = validateAndPruneBrandPreview({
    output: candidate,
    evidenceRefs: refs,
    archetypes,
    confirmedIndustry: industry,
  });
  return {
    validated,
    readiness: evaluateBrandPreviewReadiness({
      gatekeeperAdmitted: true,
      confirmedSupportedIndustry: true,
      brandName: "Example",
      websiteUrl: "https://example.com/",
      logoUrl: logo,
      mandatoryNarrativeValid: validated.mandatoryNarrativeValid,
      output: validated.output,
    }),
  };
}

describe("frozen Brand Preview structural, semantic and readiness contract", () => {
  it.each(["D2C", "SAAS_AI", "OFFLINE_SERVICES"])(
    "accepts a normal-density %s Preview",
    (industry) => {
      expect(evaluate(output(), industry).readiness).toEqual({
        state: "PREVIEW_READY",
        completeness: "NORMAL",
      });
    },
  );

  it("accepts grounded Healthcare language", () => {
    expect(evaluate(output(), "HEALTHCARE").readiness.state).toBe(
      "PREVIEW_READY",
    );
  });

  it("rejects an ungrounded Healthcare outcome promise", () => {
    const candidate = output();
    candidate.brand_understanding_narrative =
      "Example explains a treatment pathway for people comparing available options and seeking practical context. Its product guarantees a health outcome, so creators can communicate the offering with confidence while helping audiences understand the decision process.";
    expect(evaluate(candidate, "HEALTHCARE").readiness.state).toBe(
      "PREVIEW_NOT_READY",
    );
  });

  it("returns READY/PARTIAL for one Audience, Opportunity and Archetype", () => {
    const candidate = output();
    candidate.brand_descriptor = null;
    candidate.internal_trace.brand_descriptor = null;
    candidate.audience_groups = candidate.audience_groups.slice(0, 1);
    candidate.creator_marketing_opportunities =
      candidate.creator_marketing_opportunities.slice(0, 1);
    candidate.creator_archetype_recommendations =
      candidate.creator_archetype_recommendations.slice(0, 1);
    expect(evaluate(candidate, "D2C", null).readiness).toEqual({
      state: "PREVIEW_READY",
      completeness: "PARTIAL",
    });
  });

  it("treats a missing optional logo as PARTIAL", () => {
    expect(evaluate(output(), "D2C", null).readiness.completeness).toBe(
      "PARTIAL",
    );
  });

  it("drops an invalid archetype ID without inventing a replacement", () => {
    const candidate = output();
    candidate.creator_archetype_recommendations[0].archetype_id = "INVENTED";
    const { validated, readiness } = evaluate(candidate);
    expect(validated.output.creator_archetype_recommendations).toHaveLength(1);
    expect(validated.pruned.archetypes).toBe(1);
    expect(readiness.completeness).toBe("PARTIAL");
  });

  it("drops a duplicate archetype deterministically", () => {
    const candidate = output();
    candidate.creator_archetype_recommendations[1].archetype_id = "EDUCATOR";
    expect(
      evaluate(candidate).validated.output.creator_archetype_recommendations,
    ).toHaveLength(1);
  });

  it("drops duplicate Audience IDs even when model labels differ", () => {
    const candidate = output();
    candidate.audience_groups[1].id = candidate.audience_groups[0].id;
    candidate.audience_groups[1].label = "A renamed duplicate";
    expect(evaluate(candidate).validated.output.audience_groups).toHaveLength(
      1,
    );
  });

  it("omits an optional descriptor whose grounding reference is invalid", () => {
    const candidate = output();
    candidate.internal_trace.brand_descriptor!.internal_grounding_refs = [
      "invented:reference",
    ];
    const { validated, readiness } = evaluate(candidate);
    expect(validated.output.brand_descriptor).toBeNull();
    expect(validated.pruned.descriptor).toBe(1);
    expect(readiness.completeness).toBe("PARTIAL");
  });

  it("rejects malformed model output before persistence", () => {
    expect(
      BrandPreviewSynthesisSchema.safeParse({ audience_groups: [] }).success,
    ).toBe(false);
  });

  it("fails readiness when Gatekeeper admission is absent", () => {
    const validated = evaluate(output()).validated;
    expect(
      evaluateBrandPreviewReadiness({
        gatekeeperAdmitted: false,
        confirmedSupportedIndustry: true,
        brandName: "Example",
        websiteUrl: "https://example.com",
        logoUrl: null,
        mandatoryNarrativeValid: true,
        output: validated.output,
      }).state,
    ).toBe("PREVIEW_NOT_READY");
  });
});

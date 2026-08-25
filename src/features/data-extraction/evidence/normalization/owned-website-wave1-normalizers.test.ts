import { describe, expect, it } from "vitest";

import {
  BrandCompanyContextNormalizer,
  BrandMessagingNormalizer,
  CommunicationConstraintEvidenceNormalizer,
  CommunicationLanguageSignalsNormalizer,
  OfferingContextNormalizer,
  canonicalSemanticText,
  itemFingerprint,
  observationKey,
  type DataExtractionNormalizationInput,
} from "./owned-website-wave1-normalizers";

const baseExecution = {
  brandId: "brand:test",
  capabilityExecutionRef: "capability-execution:test",
  capabilityId: "owned_website.brand_messaging",
  resourceScope: ["resource:home"],
  freshnessIntent: "REUSE_ALLOWED",
  normalizationContractVersion: "1.0",
  availability: "AVAILABLE",
  retryability: "NOT_APPLICABLE",
  reasonCodes: [],
  coverage: "SINGLE_RESOURCE",
  acquisitionQuality: {
    state: "COMPLETE",
    failureCategories: [],
    detailCodes: [],
  },
  evidenceRefs: [],
  createdAt: "2026-08-25T00:00:00.000Z",
  completedAt: "2026-08-25T00:01:00.000Z",
} as any;

function source(
  ref: string,
  role: string,
  text: string,
  html = '<html lang="en"><body></body></html>',
) {
  return {
    resource: {
      brandId: "brand:test",
      resourceRef: ref,
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      canonicalResourceKey: `https://example.com/${ref}`,
      canonicalUrl: `https://example.com/${ref}`,
      aliases: [],
      pageRole: role,
      createdAt: "2026-08-25T00:00:00.000Z",
    },
    capture: {
      brandId: "brand:test",
      captureRef: `capture:${ref}`,
      resourceRef: ref,
      acquisitionRequestKey: `request:${ref}`,
      startedAt: "2026-08-25T00:00:00.000Z",
      capturedAt: "2026-08-25T00:00:10.000Z",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      providerExecutionRefs: [],
    },
    normalizedContentRef: `content:${ref}`,
    normalizedText: text,
    acquiredSourceBody: html,
    freshness: {
      state: "CURRENT",
      basis: "SAME_ACTIVE_RUN",
      evaluatedAt: "2026-08-25T00:00:10.000Z",
    },
  } as any;
}

function input(
  capabilityId: string,
  sources: any[],
  parentEvidence: any[] = [],
): DataExtractionNormalizationInput {
  return {
    execution: {
      ...baseExecution,
      capabilityId,
      resourceScope: sources.map((item) => item.resource.resourceRef),
    },
    sources,
    parentEvidence,
  } as any;
}

function messagingParent(src: any, text: string) {
  return {
    brandId: "brand:test",
    evidenceRef: `evidence:${src.resource.resourceRef}`,
    capabilityId: "owned_website.brand_messaging",
    normalizationContractVersion: "1.0",
    resourceRef: src.resource.resourceRef,
    captureRef: src.capture.captureRef,
    sourceClass: "OWNED_WEBSITE",
    resourceType: "OWNED_WEB_PAGE",
    pageRole: src.resource.pageRole,
    capturedAt: src.capture.capturedAt,
    freshnessAtEmission: src.freshness,
    representativeness: "PERSISTENT_BRAND_LEVEL",
    coverageSnapshot: "SINGLE_RESOURCE",
    qualitySnapshot: src.capture.acquisitionQuality,
    provenance: {
      acquisitionOrNormalizationRunRef: "capability-execution:parent",
      captureMethodClass: "DIRECT_FETCH",
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
    },
    deduplication: {
      itemFingerprint: "parent",
      repetitionCount: 1,
      supportingResourceRefs: [src.resource.resourceRef],
    },
    boundedNormalizedPayload: {
      text_or_normalized_message: text,
      message_role: "BRAND_PROPOSITION",
      authorship_class: "BRAND_AUTHORED",
      visibility_class: "VISIBLE_PRIMARY_COPY",
    },
    contentHash: "a".repeat(64),
    semanticObservationKey: "observation:parent",
    relationshipRefs: [],
  } as any;
}

describe("DE-W1.0E deterministic normalizers", () => {
  it("keeps fingerprints and semantic observation identity deterministic", () => {
    const payload = { text_or_normalized_message: "We help creators grow" };
    expect(
      itemFingerprint(
        "owned_website.brand_messaging",
        "We help creators grow",
        payload,
      ),
    ).toBe(
      itemFingerprint(
        "owned_website.brand_messaging",
        "We help creators grow",
        payload,
      ),
    );
    expect(
      observationKey("owned_website.brand_messaging", "We help creators grow"),
    ).toBe(
      observationKey("owned_website.brand_messaging", "we help creators grow"),
    );
    expect(canonicalSemanticText("Hello,   WORLD!")).toBe("hello world");
  });

  it("normalizes repeated messaging as repeated representative without synthesizing Intelligence", () => {
    const first = source(
      "resource:home",
      "HOMEPAGE",
      "We help creators grow with better brand partnerships.",
    );
    const second = source(
      "resource:about",
      "ABOUT_COMPANY",
      "We help creators grow with better brand partnerships.",
    );
    const result = new BrandMessagingNormalizer().normalize(
      input("owned_website.brand_messaging", [first, second]),
    );
    expect(result.drafts).toHaveLength(2);
    expect(
      result.drafts.every(
        (item) => item.representativeness === "REPEATED_REPRESENTATIVE",
      ),
    ).toBe(true);
    expect(result.drafts[0]?.boundedNormalizedPayload).not.toHaveProperty(
      "value_proposition",
    );
    expect(
      JSON.stringify(result.drafts[0]?.boundedNormalizedPayload),
    ).not.toContain("BRAND_CONFIRMED");
  });

  it("emits explicit company context but does not infer missing geography or Industry", () => {
    const about = source(
      "resource:about",
      "ABOUT_COMPANY",
      "We are a creator commerce platform serving independent brands. Our mission is to make partnerships simpler.",
    );
    const result = new BrandCompanyContextNormalizer().normalize(
      input("owned_website.brand_company_context", [about]),
    );
    expect(result.drafts.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(
      result.drafts.map((item) => item.boundedNormalizedPayload),
    );
    expect(serialized).not.toContain("inferred_industry");
    expect(serialized).not.toContain("currency");
    expect(serialized).not.toContain("geography");
  });

  it("keeps distinct offering observations and does not claim canonical catalogue completeness", () => {
    const offering = source(
      "resource:pricing",
      "PRICING_PLANS",
      "Starter plan for small teams. Pro plan for growing teams. Enterprise plan for larger organizations.",
    );
    const result = new OfferingContextNormalizer().normalize(
      input("owned_website.offering_context", [offering]),
    );
    expect(result.drafts.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(result.drafts.map((item) => item.semanticObservationKey)).size,
    ).toBe(result.drafts.length);
    expect(JSON.stringify(result.drafts)).not.toContain(
      "canonical_catalogue_completeness",
    );
  });

  it("emits contract-valid observed language signals, not tone/personality judgments", () => {
    const home = source(
      "resource:home",
      "HOMEPAGE",
      "We help you find the right creators for your brand. Our platform gives you the tools to start, choose and grow partnerships with confidence. You can discover creators and manage your campaigns in one place.",
    );
    const parent = messagingParent(
      home,
      "We help you find the right creators for your brand.",
    );
    const result = new CommunicationLanguageSignalsNormalizer().normalize(
      input("observed_brand_communication_language_signals", [home], [parent]),
    );
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.boundedNormalizedPayload).toMatchObject({
      language_code: "en",
      signal_type: "PRINCIPAL_MESSAGING_LANGUAGE",
      surface_importance: "PRINCIPAL",
    });
    expect(
      JSON.stringify(result.drafts[0]?.boundedNormalizedPayload),
    ).not.toMatch(/warm|empathetic|personality|tone_trait/i);
  });

  it("emits explicit constraint Evidence but does not promote ordinary repeated style to a hard rule", () => {
    const home = source("resource:home", "HOMEPAGE", "We help creators grow.");
    const prohibition = messagingParent(
      home,
      "We never use guaranteed outcome claims in creator copy.",
    );
    const ordinary = {
      ...messagingParent(home, "You can discover creators today."),
      evidenceRef: "evidence:ordinary",
    };
    const normalizer = new CommunicationConstraintEvidenceNormalizer();
    const result = normalizer.normalize(
      input(
        "derived_communication_constraint_evidence",
        [home],
        [prohibition, ordinary],
      ),
    );
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.boundedNormalizedPayload).toMatchObject({
      constraint_signal_type: "EXPLICIT_BRAND_AUTHORED_PROHIBITION",
      explicitness: "EXPLICIT_SOURCE_STATEMENT",
    });
    expect(result.drafts[0]?.polarity).toBe("RESTRICTION");

    const empty = normalizer.normalize(
      input("derived_communication_constraint_evidence", [home], [ordinary]),
    );
    expect(empty.drafts).toEqual([]);
  });
});

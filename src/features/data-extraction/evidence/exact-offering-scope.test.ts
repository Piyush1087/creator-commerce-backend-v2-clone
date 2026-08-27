import { describe, expect, it, vi } from "vitest";

import { reconciledPageRole } from "./acquisition/owned-website-wave1-acquisition.service";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asResourceRef,
  asSemanticObservationKey,
  type EvidenceRef,
} from "./domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
} from "./domain/evidence-records";
import {
  CommunicationConstraintEvidenceNormalizer,
  OfferingContextNormalizer,
  type DataExtractionNormalizationInput,
  type DataExtractionNormalizationSource,
} from "./normalization/owned-website-wave1-normalizers";
import { ProofEvidenceNormalizer } from "./normalization/wave2/proof-evidence.normalizer";
import { ServiceabilityEvidenceNormalizer } from "./normalization/wave2/serviceability-evidence.normalizer";
import { DataExtractionEvidenceQueryService } from "./query/data-extraction-evidence-query.service";

const brandId = asBrandId("brand-exact-a");
const offeringA = "offering-a";
const offeringB = "offering-b";

function source(
  suffix: string,
  text: string,
  pageRole: DataExtractionNormalizationSource["resource"]["pageRole"] = "OFFERING_DETAIL",
): DataExtractionNormalizationSource {
  const resourceRef = asResourceRef(`resource:${suffix}`);
  const captureRef = asCaptureRef(`capture:${suffix}`);
  return {
    resource: {
      brandId,
      resourceRef,
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      canonicalResourceKey: `https://brand.example/${suffix}`,
      canonicalUrl: `https://brand.example/${suffix}`,
      aliases: [],
      pageRole,
      createdAt: "2026-08-28T00:00:00.000Z",
    },
    capture: {
      brandId,
      captureRef,
      resourceRef,
      acquisitionRequestKey: `request:${suffix}`,
      startedAt: "2026-08-28T00:00:00.000Z",
      capturedAt: "2026-08-28T00:00:01.000Z",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      providerExecutionRefs: [],
    },
    normalizedText: text,
    acquiredSourceBody: `<main><p>${text}</p></main>`,
    freshness: {
      state: "CURRENT",
      basis: "SAME_ACTIVE_RUN",
      evaluatedAt: "2026-08-28T00:00:01.000Z",
    },
  };
}

function normalizationInput(
  capabilityId: DataExtractionCapabilityExecutionRecord["capabilityId"],
  sources: readonly DataExtractionNormalizationSource[],
  exactCaptureRefs: readonly string[] = [],
  parentEvidence: readonly DataExtractionEvidenceItemRecord[] = [],
): DataExtractionNormalizationInput {
  return {
    execution: {
      brandId,
      capabilityExecutionRef: asCapabilityExecutionRef(
        `capability-execution:${capabilityId}`,
      ),
      capabilityId,
      resourceScope: sources.map((entry) => entry.resource.resourceRef),
      freshnessIntent: "REUSE_ALLOWED",
      normalizationContractVersion: "1.0",
      availability: "NOT_REQUESTED",
      retryability: "NOT_APPLICABLE",
      reasonCodes: [],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      evidenceRefs: [],
      createdAt: "2026-08-28T00:00:00.000Z",
    },
    sources,
    parentEvidence,
    ...(exactCaptureRefs.length
      ? {
          exactOfferingScope: {
            canonicalOfferingRef: offeringA,
            captureRefs: exactCaptureRefs,
          },
        }
      : {}),
  };
}

function evidence(
  ref: string,
  payload: Readonly<Record<string, unknown>>,
  overrides: Partial<DataExtractionEvidenceItemRecord> = {},
): DataExtractionEvidenceItemRecord {
  const evidenceRef = asEvidenceRef(ref);
  return {
    brandId,
    evidenceRef,
    capabilityId: "owned_website.offering_context",
    normalizationContractVersion: "1.0",
    resourceRef: asResourceRef(`resource:${ref}`),
    captureRef: asCaptureRef(`capture:${ref}`),
    sourceClass: "OWNED_WEBSITE",
    resourceType: "OWNED_WEB_PAGE",
    pageRole: "OFFERING_DETAIL",
    capturedAt: "2026-08-28T00:00:00.000Z",
    freshnessAtEmission: {
      state: "CURRENT",
      evaluatedAt: "2026-08-28T00:00:00.000Z",
      basis: "SAME_ACTIVE_RUN",
    },
    representativeness: "OFFERING_SPECIFIC",
    coverageSnapshot: "SINGLE_RESOURCE",
    qualitySnapshot: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: `capability-execution:${ref}`,
      captureMethodClass: "DIRECT_FETCH",
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
    },
    deduplication: {
      itemFingerprint: `fingerprint:${ref}`,
      repetitionCount: 1,
      supportingResourceRefs: [asResourceRef(`resource:${ref}`)],
    },
    boundedNormalizedPayload: payload,
    contentHash: ref.padEnd(64, "0").slice(0, 64),
    semanticObservationKey: asSemanticObservationKey(`observation:${ref}`),
    relationshipRefs: [],
    ...overrides,
  };
}

function execution(
  suffix: string,
  evidenceRefs: readonly EvidenceRef[],
  capabilityId: DataExtractionCapabilityExecutionRecord["capabilityId"] = "owned_website.offering_context",
): DataExtractionCapabilityExecutionRecord {
  return {
    brandId,
    capabilityExecutionRef: asCapabilityExecutionRef(
      `capability-execution:${suffix}`,
    ),
    capabilityId,
    resourceScope: [],
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
    evidenceRefs,
    createdAt: `2026-08-28T00:0${suffix.length}:00.000Z`,
    completedAt: `2026-08-28T00:0${suffix.length}:01.000Z`,
  };
}

describe("P2B-1 exact Offering resource reconciliation", () => {
  it.each([
    ["D2C", "https://brand.example/products/red-shoe"],
    ["SaaS/AI", "https://brand.example/plans/copilot-pro"],
    ["Healthcare", "https://brand.example/treatments/physiotherapy"],
    ["Offline", "https://brand.example/experiences/pottery-class"],
  ])(
    "treats an application-reconciled %s resource as OFFERING_DETAIL",
    (_family, url) => {
      expect(reconciledPageRole(url, true)).toBe("OFFERING_DETAIL");
    },
  );

  it("does not infer detail scope from URL shape and leaves a broad collection broad", () => {
    expect(
      reconciledPageRole("https://brand.example/products/red-shoe", false),
    ).toBe("PORTFOLIO_OVERVIEW");
    expect(
      reconciledPageRole("https://brand.example/collections/summer", false),
    ).toBe("CATEGORY_OVERVIEW");
  });

  it("stamps only the explicitly reconciled capture in offering_context", () => {
    const exact = source(
      "exact",
      "Premium physiotherapy provides a bounded one-to-one treatment session.",
    );
    const sibling = source(
      "sibling",
      "Dental consultation is a separate professional service.",
    );
    const result = new OfferingContextNormalizer().normalize(
      normalizationInput(
        "owned_website.offering_context",
        [exact, sibling],
        [exact.capture.captureRef],
      ),
    );
    const exactDraft = result.drafts.find(
      (draft) => draft.source.capture.captureRef === exact.capture.captureRef,
    );
    const siblingDraft = result.drafts.find(
      (draft) => draft.source.capture.captureRef === sibling.capture.captureRef,
    );
    expect(exactDraft?.boundedNormalizedPayload).toMatchObject({
      generalization_scope: "SINGLE_OFFERING",
      canonical_offering_ref: offeringA,
    });
    expect(
      siblingDraft?.boundedNormalizedPayload.canonical_offering_ref,
    ).toBeNull();
  });

  it("keeps broad context null-scoped", () => {
    const broad = source(
      "collection",
      "Starter plan for small teams. Pro plan for growing teams.",
      "PRICING_PLANS",
    );
    const result = new OfferingContextNormalizer().normalize(
      normalizationInput("owned_website.offering_context", [broad]),
    );
    expect(result.drafts[0]?.boundedNormalizedPayload).toMatchObject({
      generalization_scope: "MULTIPLE_OFFERINGS",
      canonical_offering_ref: null,
    });
  });

  it("carries the same exact ref through proof, serviceability, and offering-specific constraints", () => {
    const exact = source(
      "proof",
      "Our premium plan is ISO 9001 certified and available worldwide.",
    );
    const exactInput = normalizationInput(
      "explicit_factual_proof_or_claim_evidence",
      [exact],
      [exact.capture.captureRef],
    );
    const proof = new ProofEvidenceNormalizer().normalize(exactInput).drafts[0];
    expect(proof?.boundedNormalizedPayload).toMatchObject({
      factual_referent_ref: offeringA,
      offering_refs: [offeringA],
      verification_status: "NOT_EXTERNALLY_VERIFIED",
    });

    const service = new ServiceabilityEvidenceNormalizer().normalize({
      ...exactInput,
      execution: {
        ...exactInput.execution,
        capabilityId: "owned_website.serviceability_evidence",
      },
    }).drafts[0];
    expect(service?.boundedNormalizedPayload).toMatchObject({
      offering_ref: offeringA,
      subject_scope: "OFFERING_SPECIFIC",
    });

    const parent = evidence(
      "evidence:parent",
      {
        text_or_normalized_message:
          "We never use guaranteed outcome claims in premium plan copy.",
      },
      {
        capabilityId: "owned_website.brand_messaging",
        resourceRef: exact.resource.resourceRef,
        captureRef: exact.capture.captureRef,
      },
    );
    const constraint =
      new CommunicationConstraintEvidenceNormalizer().normalize(
        normalizationInput(
          "derived_communication_constraint_evidence",
          [exact],
          [exact.capture.captureRef],
          [parent],
        ),
      ).drafts[0];
    expect(constraint?.boundedNormalizedPayload).toMatchObject({
      source_instruction_scope: "OFFERING_SPECIFIC",
      canonical_offering_ref: offeringA,
    });
  });
});

describe("P2B-1 exact Offering Evidence reader", () => {
  it("reads one Offering across completed executions without sibling or broad replacement", async () => {
    const a1 = evidence("evidence:a1", {
      generalization_scope: "SINGLE_OFFERING",
      canonical_offering_ref: offeringA,
    });
    const a2 = evidence("evidence:a2", {
      generalization_scope: "SINGLE_OFFERING",
      canonical_offering_ref: offeringA,
    });
    const b = evidence("evidence:b", {
      generalization_scope: "SINGLE_OFFERING",
      canonical_offering_ref: offeringB,
    });
    const broad = evidence(
      "evidence:broad",
      {
        generalization_scope: "MULTIPLE_OFFERINGS",
        canonical_offering_ref: null,
      },
      {
        pageRole: "CATEGORY_OVERVIEW",
        representativeness: "PERSISTENT_BRAND_LEVEL",
      },
    );
    const executions = [
      execution("b-newest", [b.evidenceRef]),
      execution("broad-new", [broad.evidenceRef]),
      execution("a-second", [a2.evidenceRef]),
      execution("a-first", [a1.evidenceRef]),
    ];
    const rows = new Map(
      [a1, a2, b, broad].map((item) => [item.evidenceRef, item]),
    );
    const repositories = {
      canonicalOfferings: { assertOwnedByBrand: vi.fn(async () => undefined) },
      capabilityExecutions: {
        findCompleted: vi.fn(async () => executions),
      },
      evidenceItems: {
        findByRef: vi.fn(
          async (_brand: string, ref: EvidenceRef) => rows.get(ref) ?? null,
        ),
      },
      semanticObservations: {
        findByCapability: vi.fn(async () => [
          {
            brandId,
            semanticObservationKey: a1.semanticObservationKey!,
            capabilityId: a1.capabilityId,
            supportingEvidenceRefs: [a1.evidenceRef],
            repetitionCount: 1,
            equivalentObservationKeys: [],
            conflictingObservationKeys: [a2.semanticObservationKey!],
            createdAt: "2026-08-28T00:00:00.000Z",
          },
          {
            brandId,
            semanticObservationKey: a2.semanticObservationKey!,
            capabilityId: a2.capabilityId,
            supportingEvidenceRefs: [a2.evidenceRef],
            repetitionCount: 1,
            equivalentObservationKeys: [],
            conflictingObservationKeys: [a1.semanticObservationKey!],
            createdAt: "2026-08-28T00:00:00.000Z",
          },
        ]),
      },
    };
    const query = new DataExtractionEvidenceQueryService({
      repositories: () => repositories,
    } as never);

    const result = await query.readExisting({
      brandId,
      capabilityIds: ["owned_website.offering_context"],
      exactOfferingScope: { canonicalOfferingRef: offeringA },
    });

    const completed = result.capabilityResults[0];
    expect(completed?.state).toBe("COMPLETED");
    if (completed?.state !== "COMPLETED") throw new Error("expected completed");
    expect(completed.evidence.map((item) => item.evidenceRef).sort()).toEqual(
      [a1.evidenceRef, a2.evidenceRef].sort(),
    );
    expect(
      completed.capabilityExecutions?.map(
        (item) => item.capabilityExecutionRef,
      ),
    ).toEqual([
      "capability-execution:a-second",
      "capability-execution:a-first",
    ]);
    expect(completed.evidence.every((item) => item.conflictGroupRef)).toBe(
      true,
    );
    expect(
      completed.evidence.every(
        (item) => item.freshnessAtEmission.state === "CURRENT",
      ),
    ).toBe(true);
    expect(
      repositories.canonicalOfferings.assertOwnedByBrand,
    ).toHaveBeenCalledWith(brandId, offeringA);
  });

  it("fails closed when canonical Offering ownership validation fails", async () => {
    const query = new DataExtractionEvidenceQueryService({
      repositories: () => ({
        canonicalOfferings: {
          assertOwnedByBrand: vi.fn(async () => {
            throw new Error("PERSISTENCE_INVARIANT");
          }),
        },
      }),
    } as never);
    await expect(
      query.readExisting({
        brandId,
        capabilityIds: ["owned_website.offering_context"],
        exactOfferingScope: { canonicalOfferingRef: "other-brand-offering" },
      }),
    ).rejects.toThrow("PERSISTENCE_INVARIANT");
  });

  it("rejects sibling and Brand-level proof from an exact Offering proof read", async () => {
    const exact = evidence(
      "evidence:proof-a",
      {
        subject_scope: "OFFERING_SPECIFIC",
        scope: "OFFERING_SPECIFIC",
        factual_referent_ref: offeringA,
        offering_refs: [offeringA],
      },
      { capabilityId: "explicit_factual_proof_or_claim_evidence" },
    );
    const sibling = evidence(
      "evidence:proof-b",
      {
        subject_scope: "OFFERING_SPECIFIC",
        scope: "OFFERING_SPECIFIC",
        factual_referent_ref: offeringB,
        offering_refs: [offeringB],
      },
      { capabilityId: "explicit_factual_proof_or_claim_evidence" },
    );
    const brandProof = evidence(
      "evidence:proof-brand",
      {
        subject_scope: "BRAND_LEVEL",
        scope: "BRAND_LEVEL",
        factual_referent_ref: null,
        offering_refs: [],
      },
      {
        capabilityId: "explicit_factual_proof_or_claim_evidence",
        pageRole: "HOMEPAGE",
        representativeness: "PERSISTENT_BRAND_LEVEL",
      },
    );
    const completed = execution(
      "proof",
      [exact.evidenceRef, sibling.evidenceRef, brandProof.evidenceRef],
      "explicit_factual_proof_or_claim_evidence",
    );
    const rows = new Map(
      [exact, sibling, brandProof].map((item) => [item.evidenceRef, item]),
    );
    const query = new DataExtractionEvidenceQueryService({
      repositories: () => ({
        canonicalOfferings: {
          assertOwnedByBrand: vi.fn(async () => undefined),
        },
        capabilityExecutions: { findCompleted: vi.fn(async () => [completed]) },
        evidenceItems: {
          findByRef: vi.fn(
            async (_brand: string, ref: EvidenceRef) => rows.get(ref) ?? null,
          ),
        },
        semanticObservations: { findByCapability: vi.fn(async () => []) },
      }),
    } as never);

    const result = await query.readExisting({
      brandId,
      capabilityIds: ["explicit_factual_proof_or_claim_evidence"],
      exactOfferingScope: { canonicalOfferingRef: offeringA },
    });
    expect(
      result.capabilityResults[0]?.evidence.map((item) => item.evidenceRef),
    ).toEqual([exact.evidenceRef]);
  });
});

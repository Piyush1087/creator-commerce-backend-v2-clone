import { describe, expect, it } from "vitest";

import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asProviderExecutionRef,
  asResourceRef,
  asSemanticObservationKey,
  type EvidenceRef,
} from "./domain/evidence-identities";
import { assertSameBrand } from "./domain/evidence-guards";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionSemanticObservationRecord,
} from "./domain/evidence-records";
import {
  WAVE1_EVIDENCE_CAPABILITIES,
  type EvidenceCoverage,
  type EvidenceRepresentativeness,
} from "./domain/evidence-vocabulary";
import type {
  DataExtractionCapabilityAcquisitionPortV1,
  DataExtractionEvidenceQueryPortV1,
} from "./ports/evidence-runtime.ports";

const brandId = asBrandId("brand-a");

function zeroEvidenceExecution(): DataExtractionCapabilityExecutionRecord {
  return {
    brandId,
    capabilityExecutionRef: asCapabilityExecutionRef("capability-execution:1"),
    capabilityId: "owned_website.brand_messaging",
    resourceScope: [asResourceRef("resource:home")],
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
    createdAt: "2026-08-25T10:00:00.000Z",
    completedAt: "2026-08-25T10:00:01.000Z",
  };
}

describe("DE-W1.0A runtime contracts", () => {
  it("freezes exactly the five MVP capability IDs", () => {
    expect(WAVE1_EVIDENCE_CAPABILITIES).toEqual([
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
      "observed_brand_communication_language_signals",
      "derived_communication_constraint_evidence",
    ]);
  });

  it("supports AVAILABLE with zero Evidence while retaining capability lineage", () => {
    const execution = zeroEvidenceExecution();
    expect(execution.availability).toBe("AVAILABLE");
    expect(execution.evidenceRefs).toEqual([]);
    expect(execution.capabilityExecutionRef).toBe("capability-execution:1");
  });

  it("preserves POSSIBLY_STALE and independent coverage/representativeness", () => {
    const coverage: EvidenceCoverage = "SINGLE_RESOURCE";
    const representativeness: EvidenceRepresentativeness =
      "PERSISTENT_BRAND_LEVEL";
    const item: DataExtractionEvidenceItemRecord = {
      brandId,
      evidenceRef: asEvidenceRef("evidence:1"),
      capabilityId: "owned_website.brand_messaging",
      normalizationContractVersion: "1.0",
      resourceRef: asResourceRef("resource:home"),
      captureRef: asCaptureRef("capture:1"),
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      capturedAt: "2026-08-25T10:00:00.000Z",
      freshnessAtEmission: {
        state: "POSSIBLY_STALE",
        basis: "CAPTURE_AGE_UNEVALUATED",
        evaluatedAt: "2026-08-25T10:00:01.000Z",
      },
      representativeness,
      coverageSnapshot: coverage,
      qualitySnapshot: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      provenance: {
        acquisitionOrNormalizationRunRef: "run:1",
        captureMethodClass: "DIRECT_FETCH",
        normalizationContractVersion: "1.0",
        parentEvidenceRefs: [],
        parentCaptureRefs: [],
      },
      deduplication: {
        itemFingerprint: "fingerprint:1",
        repetitionCount: 1,
        supportingResourceRefs: [asResourceRef("resource:home")],
      },
      contentHash: "a".repeat(64),
      relationshipRefs: [],
    };
    expect(item.freshnessAtEmission.state).toBe("POSSIBLY_STALE");
    expect(item.coverageSnapshot).toBe("SINGLE_RESOURCE");
    expect(item.representativeness).toBe("PERSISTENT_BRAND_LEVEL");
  });

  it("keeps explicit negative Evidence distinct from absence", () => {
    const absent = zeroEvidenceExecution();
    expect(absent.evidenceRefs).toHaveLength(0);
    const negative: Pick<DataExtractionEvidenceItemRecord, "polarity"> = {
      polarity: "EXPLICIT_NEGATIVE",
    };
    expect(negative.polarity).toBe("EXPLICIT_NEGATIVE");
  });

  it("preserves conflict/equivalence without a winner field", () => {
    const observation: DataExtractionSemanticObservationRecord = {
      brandId,
      semanticObservationKey: asSemanticObservationKey("observation:shipping"),
      capabilityId: "owned_website.brand_company_context",
      supportingEvidenceRefs: [asEvidenceRef("evidence:1")],
      repetitionCount: 1,
      equivalentObservationKeys: [],
      conflictingObservationKeys: [
        asSemanticObservationKey("observation:shipping:conflict"),
      ],
      createdAt: "2026-08-25T10:00:00.000Z",
    };
    expect(observation.conflictingObservationKeys).toHaveLength(1);
    expect("winner" in observation).toBe(false);
  });

  it("rejects cross-Brand guards", () => {
    expect(() => assertSameBrand(brandId, asBrandId("brand-b"))).toThrow(
      "DATA_EXTRACTION_TENANCY_VIOLATION",
    );
  });

  it("keeps read-existing and acquisition as distinct contracts", () => {
    const readPort: DataExtractionEvidenceQueryPortV1 = {
      readExisting: async (request) => ({
        brandId: request.brandId,
        capabilityResults: [],
      }),
    };
    const acquisitionPort: DataExtractionCapabilityAcquisitionPortV1 = {
      request: async () => ({
        capabilityExecutionRef: asCapabilityExecutionRef(
          "capability-execution:2",
        ),
        evidenceRefs: [],
      }),
    };
    expect("readExisting" in readPort).toBe(true);
    expect("request" in readPort).toBe(false);
    expect("request" in acquisitionPort).toBe(true);
    expect("readExisting" in acquisitionPort).toBe(false);
  });

  it("keeps provider execution refs out of permanent identity types", () => {
    const providerRef = asProviderExecutionRef("provider-request:1");
    expect(providerRef).toBe("provider-request:1");
    // @ts-expect-error ProviderExecutionRef must not substitute EvidenceRef.
    const evidenceRef: EvidenceRef = providerRef;
    expect(evidenceRef).toBe(providerRef);
  });
});

import { describe, expect, it } from "vitest";

import { NORMALIZED_EVIDENCE_CAPABILITIES } from "../../brand-intelligence/input/evidence/intelligence-evidence.port";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asResourceRef,
} from "./domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
} from "./domain/evidence-records";
import { WAVE1_EVIDENCE_CAPABILITIES } from "./domain/evidence-vocabulary";

describe("DE-W1.0A W1.0E compatibility", () => {
  it("uses the exact integrated W1.0E capability vocabulary", () => {
    expect(WAVE1_EVIDENCE_CAPABILITIES).toEqual(
      NORMALIZED_EVIDENCE_CAPABILITIES,
    );
  });

  it("keeps capabilityExecutionRef as DE lineage even before W1.0E.1 integration", () => {
    const brandId = asBrandId("brand-a");
    const execution: DataExtractionCapabilityExecutionRecord = {
      brandId,
      capabilityExecutionRef: asCapabilityExecutionRef(
        "capability-execution:1",
      ),
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
    expect(execution.capabilityExecutionRef).toBe("capability-execution:1");
  });

  it("keeps DE Evidence fields mechanically mappable to W1.0E", () => {
    const brandId = asBrandId("brand-a");
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
        state: "CURRENT",
        evaluatedAt: "2026-08-25T10:00:00.000Z",
        basis: "SAME_ACTIVE_RUN",
      },
      representativeness: "PERSISTENT_BRAND_LEVEL",
      coverageSnapshot: "SINGLE_RESOURCE",
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

    expect(item).toMatchObject({
      capabilityId: "owned_website.brand_messaging",
      sourceClass: "OWNED_WEBSITE",
      representativeness: "PERSISTENT_BRAND_LEVEL",
      coverageSnapshot: "SINGLE_RESOURCE",
    });
  });
});

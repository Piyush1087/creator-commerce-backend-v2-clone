import { describe, expect, it, vi } from "vitest";

import { EvidenceManifestBuilder } from "../../../brand-intelligence/input/evidence/evidence-manifest";
import type { IntelligenceEvidenceReadRequest } from "../../../brand-intelligence/input/evidence/intelligence-evidence.port";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asNormalizedContentRef,
  asProviderExecutionRef,
  asResourceRef,
  asSemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
} from "../domain/evidence-records";
import type { DataExtractionEvidenceQueryPortV1 } from "../ports/evidence-runtime.ports";
import { DataExtractionIntelligenceEvidenceAdapter } from "./data-extraction-intelligence-evidence.adapter";

const brandId = asBrandId("brand-adapter-a");
const capabilityId = "owned_website.brand_messaging" as const;

function execution(
  ref = "capability-execution:adapter:1",
  evidenceRefs = [asEvidenceRef("evidence:adapter:a")],
): DataExtractionCapabilityExecutionRecord {
  return {
    brandId,
    capabilityExecutionRef: asCapabilityExecutionRef(ref),
    capabilityId,
    resourceScope: [asResourceRef("resource:adapter")],
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
    createdAt: "2026-08-26T00:00:00.000Z",
    completedAt: "2026-08-26T00:01:00.000Z",
  };
}

function evidence(
  suffix: string,
  overrides: Partial<DataExtractionEvidenceItemRecord> = {},
): DataExtractionEvidenceItemRecord {
  const captureRef = asCaptureRef(`capture:adapter:${suffix}`);
  return {
    brandId,
    evidenceRef: asEvidenceRef(`evidence:adapter:${suffix}`),
    capabilityId,
    normalizationContractVersion: "1.0",
    resourceRef: asResourceRef(`resource:adapter:${suffix}`),
    captureRef,
    sourceClass: "OWNED_WEBSITE",
    resourceType: "OWNED_WEB_PAGE",
    capturedAt: "2026-08-26T00:00:00.000Z",
    freshnessAtEmission: {
      state: "UNKNOWN",
      evaluatedAt: "2026-08-26T00:00:30.000Z",
      basis: "NO_DURABLE_FRESHNESS_ASSESSMENT",
    },
    representativeness: "REPEATED_REPRESENTATIVE",
    coverageSnapshot: "MULTI_RESOURCE_PARTIAL",
    qualitySnapshot: {
      state: "DEGRADED",
      failureCategories: ["CONTENT_EXTRACTION_DEGRADED"],
      detailCodes: ["BOUNDED_TEXT_ONLY"],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: "run:adapter",
      captureMethodClass: "PROVIDER_MEDIATED_FETCH",
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [asEvidenceRef("evidence:parent")],
      parentCaptureRefs: [asCaptureRef("capture:parent")],
      providerExecutionRef: asProviderExecutionRef("provider-execution:trace"),
    },
    deduplication: {
      itemFingerprint: `fingerprint:${suffix}`,
      equivalentPriorEvidenceRef: asEvidenceRef("evidence:prior"),
      repetitionCount: 3,
      supportingResourceRefs: [asResourceRef("resource:support")],
    },
    normalizedContentRef: asNormalizedContentRef("content:bounded"),
    boundedNormalizedPayload: { statement: "bounded" },
    contentHash: suffix.repeat(64).slice(0, 64),
    polarity: "RESTRICTION",
    semanticObservationKey: asSemanticObservationKey(`observation:${suffix}`),
    relationshipRefs: [],
    conflictGroupRef: "conflict-group:stable",
    ...overrides,
  };
}

function request(): IntelligenceEvidenceReadRequest {
  return {
    brandId,
    processorId: "brand_communication",
    processorVersion: "1.0",
    capabilityIds: [capabilityId],
  };
}

function adapterFor(
  rows: readonly DataExtractionEvidenceItemRecord[],
  capabilityExecution = execution(
    "capability-execution:adapter:1",
    rows.map((row) => row.evidenceRef),
  ),
) {
  const readExisting = vi.fn(async () => ({
    brandId,
    capabilityResults: [
      { state: "COMPLETED" as const, capabilityExecution, evidence: rows },
    ],
  }));
  return {
    adapter: new DataExtractionIntelligenceEvidenceAdapter({
      readExisting,
    } as DataExtractionEvidenceQueryPortV1),
    readExisting,
  };
}

describe("DE-W1.0F Intelligence Evidence adapter", () => {
  it("passes processor context only as consumerContext and projects every accepted field", async () => {
    const derived = evidence("derived", {
      capabilityId: "derived_communication_constraint_evidence",
      sourceClass: "SYSTEM_DERIVATION_INPUT",
      provenance: {
        ...evidence("derived").provenance,
        captureMethodClass: "DETERMINISTIC_DERIVATION",
      },
    });
    const derivedExecution: DataExtractionCapabilityExecutionRecord = {
      ...execution("capability-execution:derived", [derived.evidenceRef]),
      capabilityId: "derived_communication_constraint_evidence",
    };
    const readExisting = vi.fn(async () => ({
      brandId,
      capabilityResults: [
        {
          state: "COMPLETED" as const,
          capabilityExecution: derivedExecution,
          evidence: [derived],
        },
      ],
    }));
    const adapter = new DataExtractionIntelligenceEvidenceAdapter({
      readExisting,
    });
    const result = await adapter.read({
      ...request(),
      capabilityIds: ["derived_communication_constraint_evidence"],
    });

    expect(readExisting).toHaveBeenCalledWith({
      brandId,
      capabilityIds: ["derived_communication_constraint_evidence"],
      consumerContext: {
        processorId: "brand_communication",
        processorVersion: "1.0",
      },
    });
    expect(result.capabilityResults[0]).toMatchObject({
      capabilityExecutionRef: "capability-execution:derived",
      status: "AVAILABLE",
      evidence: [
        {
          sourceClass: "SYSTEM_DERIVATION_INPUT",
          captureVersion: derived.captureRef,
          freshness: { state: "UNKNOWN" },
          normalizedContentRef: "content:bounded",
          boundedNormalizedPayload: { statement: "bounded" },
          polarity: "RESTRICTION",
          conflictGroupRef: "conflict-group:stable",
          provenance: {
            captureMethodClass: "DETERMINISTIC_DERIVATION",
            parentEvidenceRefs: ["evidence:parent"],
            parentCaptureRefs: ["capture:parent"],
            providerExecutionRef: "provider-execution:trace",
          },
          deduplication: {
            equivalentPriorEvidenceRef: "evidence:prior",
            repetitionCount: 3,
            supportingResourceRefs: ["resource:support"],
          },
        },
      ],
    });
  });

  it("returns deterministic Evidence ordering independent of query order", async () => {
    const a = evidence("a");
    const b = evidence("b");
    const { adapter } = adapterFor([b, a]);
    const result = await adapter.read(request());
    expect(
      result.capabilityResults[0]?.evidence.map((item) => item.evidenceRef),
    ).toEqual([a.evidenceRef, b.evidenceRef]);
  });

  it("maps explicit query absence to NOT_REQUESTED with null lineage", async () => {
    const readExisting = vi.fn(async () => ({
      brandId,
      capabilityResults: [
        {
          state: "NOT_REQUESTED" as const,
          capabilityId,
          evidence: [] as const,
        },
      ],
    }));
    const adapter = new DataExtractionIntelligenceEvidenceAdapter({
      readExisting,
    });

    const result = await adapter.read(request());

    expect(result.capabilityResults[0]).toEqual({
      capabilityExecutionRef: null,
      capabilityId,
      normalizationContractVersion: "1.0",
      status: "NOT_REQUESTED",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["NO_COMPLETED_SEMANTIC_EXECUTION"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "UNAVAILABLE",
        failureCategories: [],
        detailCodes: ["NOT_REQUESTED"],
      },
      evidence: [],
    });
    expect(JSON.stringify(result)).not.toContain(
      "capability-execution:not-requested",
    );
  });

  it("keeps manifest hash stable under query reordering and excludes provider trace/payload", async () => {
    const a = evidence("a");
    const b = evidence("b");
    const left = await adapterFor([a, b]).adapter.read(request());
    const right = await adapterFor([
      {
        ...b,
        boundedNormalizedPayload: { changed: true },
        provenance: {
          ...b.provenance,
          providerExecutionRef: asProviderExecutionRef(
            "provider-execution:different",
          ),
        },
      },
      a,
    ]).adapter.read(request());
    const builder = new EvidenceManifestBuilder();
    expect(builder.build(left, [capabilityId]).hash).toBe(
      builder.build(right, [capabilityId]).hash,
    );
  });

  it("changes the manifest hash when only capabilityExecutionRef changes, including AVAILABLE + []", async () => {
    const first = await adapterFor(
      [],
      execution("capability-execution:zero:1", []),
    ).adapter.read(request());
    const second = await adapterFor(
      [],
      execution("capability-execution:zero:2", []),
    ).adapter.read(request());
    const builder = new EvidenceManifestBuilder();
    expect(first.capabilityResults[0]).toMatchObject({
      status: "AVAILABLE",
      evidence: [],
    });
    expect(builder.build(first, [capabilityId]).hash).not.toBe(
      builder.build(second, [capabilityId]).hash,
    );
  });
});

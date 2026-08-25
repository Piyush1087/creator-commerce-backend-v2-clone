import { describe, expect, it, vi } from "vitest";

import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asResourceRef,
  asSemanticObservationKey,
  type BrandId,
  type EvidenceRef,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionSemanticObservationRecord,
} from "../domain/evidence-records";
import type {
  CapabilityAvailability,
  EvidenceCapabilityId,
} from "../domain/evidence-vocabulary";
import { DataExtractionEvidenceQueryService } from "./data-extraction-evidence-query.service";

const brandId = asBrandId("brand-query-a");

function execution(
  capabilityId: EvidenceCapabilityId,
  availability: CapabilityAvailability,
  evidenceRefs: readonly EvidenceRef[] = [],
  suffix = availability.toLowerCase(),
): DataExtractionCapabilityExecutionRecord {
  return {
    brandId,
    capabilityExecutionRef: asCapabilityExecutionRef(
      `capability-execution:${capabilityId}:${suffix}`,
    ),
    capabilityId,
    resourceScope: [],
    freshnessIntent: "REUSE_ALLOWED",
    normalizationContractVersion: "1.0",
    availability,
    retryability:
      availability === "UNAVAILABLE" ? "RETRYABLE" : "NOT_APPLICABLE",
    reasonCodes: [`RESULT_${availability}`],
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
      state:
        availability === "UNAVAILABLE"
          ? "UNAVAILABLE"
          : availability === "DEGRADED"
            ? "DEGRADED"
            : availability === "PARTIAL"
              ? "PARTIAL"
              : "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    evidenceRefs,
    createdAt: "2026-08-26T00:00:00.000Z",
    completedAt: "2026-08-26T00:01:00.000Z",
  };
}

function evidence(
  evidenceRef: EvidenceRef,
  semanticKey?: string,
): DataExtractionEvidenceItemRecord {
  const suffix = evidenceRef.split(":").at(-1)!;
  return {
    brandId,
    evidenceRef,
    capabilityId: "owned_website.brand_messaging",
    normalizationContractVersion: "1.0",
    resourceRef: asResourceRef(`resource:${suffix}`),
    captureRef: asCaptureRef(`capture:${suffix}`),
    sourceClass: "OWNED_WEBSITE",
    resourceType: "OWNED_WEB_PAGE",
    capturedAt: "2026-08-26T00:00:00.000Z",
    freshnessAtEmission: {
      state: "POSSIBLY_STALE",
      evaluatedAt: "2026-08-26T00:00:30.000Z",
      basis: "CAPTURE_AGE_UNEVALUATED",
    },
    representativeness: "CONTEXT_SPECIFIC",
    coverageSnapshot: "SINGLE_RESOURCE",
    qualitySnapshot: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: "run:query",
      captureMethodClass: "DIRECT_FETCH",
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
    },
    deduplication: {
      itemFingerprint: `fingerprint:${suffix}`,
      repetitionCount: 1,
      supportingResourceRefs: [asResourceRef(`resource:${suffix}`)],
    },
    contentHash: suffix.repeat(64).slice(0, 64),
    ...(semanticKey
      ? { semanticObservationKey: asSemanticObservationKey(semanticKey) }
      : {}),
    relationshipRefs: [],
  };
}

function observation(
  key: string,
  conflicts: readonly string[],
): DataExtractionSemanticObservationRecord {
  return {
    brandId,
    semanticObservationKey: asSemanticObservationKey(key),
    capabilityId: "owned_website.brand_messaging",
    supportingEvidenceRefs: [],
    repetitionCount: 1,
    equivalentObservationKeys: [],
    conflictingObservationKeys: conflicts.map(asSemanticObservationKey),
    createdAt: "2026-08-26T00:00:00.000Z",
  };
}

function service(input: {
  executions: ReadonlyMap<
    EvidenceCapabilityId,
    DataExtractionCapabilityExecutionRecord | null
  >;
  evidence?: ReadonlyMap<EvidenceRef, DataExtractionEvidenceItemRecord>;
  observations?: readonly DataExtractionSemanticObservationRecord[];
}) {
  const repositories = {
    capabilityExecutions: {
      findLatestCompleted: vi.fn(
        async (_brandId: BrandId, capabilityId: EvidenceCapabilityId) =>
          input.executions.get(capabilityId) ?? null,
      ),
    },
    evidenceItems: {
      findByRef: vi.fn(
        async (_brandId: BrandId, evidenceRef: EvidenceRef) =>
          input.evidence?.get(evidenceRef) ?? null,
      ),
    },
    semanticObservations: {
      findByCapability: vi.fn(async () => input.observations ?? []),
    },
  };
  return {
    query: new DataExtractionEvidenceQueryService({
      repositories: () => repositories,
    } as never),
    repositories,
  };
}

describe("DE-W1.0F durable Evidence query", () => {
  it("returns one completed result with its exact durable semantic fields", async () => {
    const evidenceRef = asEvidenceRef("evidence:one");
    const completed = execution("owned_website.brand_messaging", "AVAILABLE", [
      evidenceRef,
    ]);
    const { query } = service({
      executions: new Map([[completed.capabilityId, completed]]),
      evidence: new Map([[evidenceRef, evidence(evidenceRef)]]),
    });
    const result = await query.readExisting({
      brandId,
      capabilityIds: [completed.capabilityId],
    });
    expect(result.capabilityResults).toEqual([
      expect.objectContaining({
        capabilityExecution: completed,
        evidence: [expect.objectContaining({ evidenceRef })],
      }),
    ]);
  });

  it("preserves request order and AVAILABLE/PARTIAL/DEGRADED/UNAVAILABLE/NOT_REQUESTED", async () => {
    const order: readonly EvidenceCapabilityId[] = [
      "owned_website.offering_context",
      "owned_website.brand_messaging",
      "observed_brand_communication_language_signals",
      "owned_website.brand_company_context",
      "derived_communication_constraint_evidence",
    ];
    const executions = new Map<
      EvidenceCapabilityId,
      DataExtractionCapabilityExecutionRecord | null
    >([
      [order[0], execution(order[0], "DEGRADED")],
      [order[1], execution(order[1], "AVAILABLE")],
      [order[2], execution(order[2], "UNAVAILABLE")],
      [order[3], execution(order[3], "PARTIAL")],
      [order[4], null],
    ]);
    const { query } = service({ executions });
    const result = await query.readExisting({ brandId, capabilityIds: order });
    expect(
      result.capabilityResults.map(
        (entry) => entry.capabilityExecution.capabilityId,
      ),
    ).toEqual(order);
    expect(
      result.capabilityResults.map(
        (entry) => entry.capabilityExecution.availability,
      ),
    ).toEqual([
      "DEGRADED",
      "AVAILABLE",
      "UNAVAILABLE",
      "PARTIAL",
      "NOT_REQUESTED",
    ]);
    expect(result.capabilityResults[4]).toMatchObject({
      capabilityExecution: {
        capabilityExecutionRef: expect.stringMatching(
          /^capability-execution:not-requested:/,
        ),
        reasonCodes: ["NO_COMPLETED_SEMANTIC_EXECUTION"],
      },
      evidence: [],
    });
  });

  it("preserves AVAILABLE + [] without reinterpretation", async () => {
    const completed = execution(
      "derived_communication_constraint_evidence",
      "AVAILABLE",
    );
    const { query } = service({
      executions: new Map([[completed.capabilityId, completed]]),
    });
    const result = await query.readExisting({
      brandId,
      capabilityIds: [completed.capabilityId],
    });
    expect(result.capabilityResults[0]).toMatchObject({
      capabilityExecution: {
        capabilityExecutionRef: completed.capabilityExecutionRef,
        availability: "AVAILABLE",
      },
      evidence: [],
    });
  });

  it("orders Evidence canonically and derives one group for a connected conflict set", async () => {
    const a = asEvidenceRef("evidence:a");
    const b = asEvidenceRef("evidence:b");
    const c = asEvidenceRef("evidence:c");
    const completed = execution("owned_website.brand_messaging", "AVAILABLE", [
      c,
      b,
      a,
    ]);
    const evidenceRows = new Map<EvidenceRef, DataExtractionEvidenceItemRecord>(
      [
        [a, evidence(a, "observation:a")],
        [b, evidence(b, "observation:b")],
        [c, evidence(c, "observation:c")],
      ],
    );
    const { query } = service({
      executions: new Map([[completed.capabilityId, completed]]),
      evidence: evidenceRows,
      observations: [
        observation("observation:a", ["observation:b"]),
        observation("observation:b", ["observation:a", "observation:c"]),
        observation("observation:c", ["observation:b"]),
      ],
    });
    const result = await query.readExisting({
      brandId,
      capabilityIds: [completed.capabilityId],
    });
    const items = result.capabilityResults[0]!.evidence;
    expect(items.map((item) => item.evidenceRef)).toEqual([a, b, c]);
    expect(new Set(items.map((item) => item.conflictGroupRef)).size).toBe(1);
    expect(items[0]?.conflictGroupRef).toMatch(/^conflict-group:/);
    expect(items[0]?.freshnessAtEmission.state).toBe("POSSIBLY_STALE");
  });

  it("does not let consumer context alter DE selection identity", async () => {
    const completed = execution("owned_website.brand_messaging", "AVAILABLE");
    const { query, repositories } = service({
      executions: new Map([[completed.capabilityId, completed]]),
    });
    const first = await query.readExisting({
      brandId,
      capabilityIds: [completed.capabilityId],
      consumerContext: {
        processorId: "brand_communication",
        processorVersion: "1.0",
      },
    });
    const second = await query.readExisting({
      brandId,
      capabilityIds: [completed.capabilityId],
      consumerContext: {
        processorId: "brand_meaning",
        processorVersion: "9.0",
      },
    });
    expect(first).toEqual(second);
    expect(
      repositories.capabilityExecutions.findLatestCompleted,
    ).toHaveBeenNthCalledWith(1, brandId, completed.capabilityId);
  });
});

import { describe, expect, it } from "vitest";

import { InputDependencyError } from "../domain/input-dependency.error";
import { EvidenceManifestBuilder } from "./evidence-manifest";
import type {
  NormalizedEvidenceCapabilityId,
  NormalizedEvidenceCapabilityResult,
  NormalizedEvidenceReference,
  NormalizedEvidenceSet,
} from "./intelligence-evidence.port";
import { MissingDataExtractionEvidenceAdapter } from "./missing-data-extraction-evidence.adapter";

const brandId = "00000000-0000-4000-8000-0000000000e1";
const messaging = "owned_website.brand_messaging" as const;

function item(
  overrides: Partial<NormalizedEvidenceReference> = {},
): NormalizedEvidenceReference {
  return {
    brandId,
    evidenceRef: "evidence:message:1",
    capabilityId: messaging,
    resourceRef: "resource:website:home",
    resourceType: "OWNED_WEB_PAGE",
    captureRef: "capture:home:1",
    captureVersion: "1",
    sourceClass: "OWNED_WEBSITE",
    capturedAt: "2026-08-25T10:00:00.000Z",
    freshness: {
      state: "POSSIBLY_STALE",
      evaluatedAt: "2026-08-25T10:01:00.000Z",
      basis: "CAPTURE_AGE_UNEVALUATED",
    },
    representativeness: "PERSISTENT_BRAND_LEVEL",
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: "run:normalization:1",
      captureMethodClass: "PROVIDER_MEDIATED_FETCH",
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
      providerExecutionRef: "zyte-operational-request-1",
    },
    deduplication: {
      itemFingerprint: "fingerprint:message:1",
      repetitionCount: 1,
      supportingResourceRefs: ["resource:website:home"],
    },
    normalizedContentRef: "normalized:message:1",
    boundedNormalizedPayload: { message: "Transient normalized content" },
    contentHash: "a".repeat(64),
    ...overrides,
  };
}

function capability(
  capabilityId: NormalizedEvidenceCapabilityId,
  evidence: readonly NormalizedEvidenceReference[],
  overrides: Partial<NormalizedEvidenceCapabilityResult> = {},
): NormalizedEvidenceCapabilityResult {
  return {
    capabilityExecutionRef: `capability-execution:${capabilityId}:1`,
    capabilityId,
    normalizationContractVersion: "1.0",
    status: "AVAILABLE",
    retryability: "NOT_APPLICABLE",
    reasonCodes: [],
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    evidence,
    ...overrides,
  };
}

function evidenceSet(
  results: readonly NormalizedEvidenceCapabilityResult[],
): NormalizedEvidenceSet {
  return { brandId, capabilityResults: results };
}

describe("W1.0E normalized Evidence boundary", () => {
  const builder = new EvidenceManifestBuilder();

  it("requires and preserves capability execution lineage", () => {
    const built = builder.build(
      evidenceSet([capability(messaging, [item()])]),
      [messaging],
    );
    expect(built.manifest.capabilities[0]).toMatchObject({
      capabilityExecutionRef:
        "capability-execution:owned_website.brand_messaging:1",
      capabilityId: messaging,
    });
  });

  it("accepts same-Brand references and preserves Gate B freshness", () => {
    const built = builder.build(
      evidenceSet([capability(messaging, [item()])]),
      [messaging],
    );
    expect(built.manifest.capabilities[0].evidence[0]).toMatchObject({
      freshness: expect.objectContaining({ state: "POSSIBLY_STALE" }),
      evidenceRef: "evidence:message:1",
    });
    expect(JSON.stringify(built.manifest)).not.toContain(
      "Transient normalized content",
    );
    expect(JSON.stringify(built.manifest)).not.toContain(
      "zyte-operational-request-1",
    );
  });

  it("rejects cross-Brand references", () => {
    expect(() =>
      builder.build(
        evidenceSet([
          capability(messaging, [item({ brandId: "another-brand" })]),
        ]),
        [messaging],
      ),
    ).toThrowError(expect.objectContaining({ code: "TENANCY_VIOLATION" }));
  });

  it("enforces the exact capability allow-list", () => {
    expect(() =>
      builder.build(evidenceSet([capability(messaging, [])]), [
        messaging,
        "owned_website.brand_company_context",
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "EVIDENCE_CAPABILITY_NOT_ALLOWED" }),
    );
  });

  it("accepts AVAILABLE with zero items and retains capability execution lineage", () => {
    const absence = builder.build(evidenceSet([capability(messaging, [])]), [
      messaging,
    ]);
    const negative = builder.build(
      evidenceSet([
        capability(messaging, [item({ polarity: "EXPLICIT_NEGATIVE" })]),
      ]),
      [messaging],
    );
    expect(absence.manifest.capabilities[0]).toMatchObject({
      capabilityExecutionRef:
        "capability-execution:owned_website.brand_messaging:1",
      status: "AVAILABLE",
      evidence: [],
    });
    expect(negative.manifest.capabilities[0].evidence[0].polarity).toBe(
      "EXPLICIT_NEGATIVE",
    );
    expect(negative.hash).not.toBe(absence.hash);
  });

  it("preserves conflict groups and deterministically ignores Evidence read ordering", () => {
    const first = item({
      evidenceRef: "evidence:message:a",
      conflictGroupRef: "conflict:group:1",
    });
    const second = item({
      evidenceRef: "evidence:message:b",
      captureRef: "capture:home:2",
      contentHash: "b".repeat(64),
      conflictGroupRef: "conflict:group:1",
    });
    const left = builder.build(
      evidenceSet([capability(messaging, [first, second])]),
      [messaging],
    );
    const right = builder.build(
      evidenceSet([capability(messaging, [second, first])]),
      [messaging],
    );
    expect(left.hash).toBe(right.hash);
    expect(left.manifest.capabilities[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conflictGroupRef: "conflict:group:1" }),
      ]),
    );
  });

  it("changes the manifest hash when only capability execution lineage changes", () => {
    const original = builder.build(
      evidenceSet([capability(messaging, [])]),
      [messaging],
    );
    const changed = builder.build(
      evidenceSet([
        capability(messaging, [], {
          capabilityExecutionRef:
            "capability-execution:owned_website.brand_messaging:2",
        }),
      ]),
      [messaging],
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it("changes the manifest for a new capture/version", () => {
    const original = builder.build(
      evidenceSet([capability(messaging, [item()])]),
      [messaging],
    );
    const changed = builder.build(
      evidenceSet([
        capability(messaging, [
          item({ captureRef: "capture:home:2", captureVersion: "2" }),
        ]),
      ]),
      [messaging],
    );
    expect(changed.hash).not.toBe(original.hash);
  });

  it("does not change the manifest hash for transient payload/provider execution changes", () => {
    const original = builder.build(
      evidenceSet([capability(messaging, [item()])]),
      [messaging],
    );
    const reread = builder.build(
      evidenceSet([
        capability(messaging, [
          item({
            boundedNormalizedPayload: { message: "Different transient value" },
            provenance: {
              ...item().provenance,
              providerExecutionRef: "different-operational-request",
            },
          }),
        ]),
      ]),
      [messaging],
    );
    expect(reread.hash).toBe(original.hash);
  });

  it("does not change identity for a freshness re-evaluation with unchanged state and basis", () => {
    const original = builder.build(
      evidenceSet([capability(messaging, [item()])]),
      [messaging],
    );
    const reread = builder.build(
      evidenceSet([
        capability(messaging, [
          item({
            freshness: {
              state: "POSSIBLY_STALE",
              evaluatedAt: "2026-08-25T11:01:00.000Z",
              basis: "CAPTURE_AGE_UNEVALUATED",
            },
          }),
        ]),
      ]),
      [messaging],
    );
    expect(reread.hash).toBe(original.hash);
  });

  it("preserves capability availability independently of readiness", () => {
    const built = builder.build(
      evidenceSet([
        capability(messaging, [item()], {
          status: "DEGRADED",
          retryability: "RETRYABLE",
          reasonCodes: ["CONTENT_EXTRACTION_DEGRADED"],
          acquisitionQuality: {
            state: "DEGRADED",
            failureCategories: ["CONTENT_EXTRACTION_DEGRADED"],
            detailCodes: ["BOUNDED_TEXT_ONLY"],
          },
        }),
      ]),
      [messaging],
    );
    expect(built.manifest.capabilities[0]).toMatchObject({
      status: "DEGRADED",
      retryability: "RETRYABLE",
      reasonCodes: ["CONTENT_EXTRACTION_DEGRADED"],
      acquisitionQuality: { state: "DEGRADED" },
    });
  });

  it("rejects provider request identity as semantic Evidence identity", () => {
    expect(() =>
      builder.build(
        evidenceSet([
          capability(messaging, [item({ evidenceRef: "zyte:request:123" })]),
        ]),
        [messaging],
      ),
    ).toThrowError(
      expect.objectContaining({ code: "EVIDENCE_REFERENCE_INVALID" }),
    );
  });

  it("reports the missing durable DE Evidence store explicitly", async () => {
    const adapter = new MissingDataExtractionEvidenceAdapter();
    await expect(
      adapter.read({
        brandId,
        processorId: "brand_communication",
        processorVersion: "1.0",
        capabilityIds: [messaging],
      }),
    ).rejects.toEqual(
      expect.objectContaining<InputDependencyError>({
        code: "DE_EVIDENCE_STORE_PREREQUISITE_MISSING",
      }),
    );
  });
});

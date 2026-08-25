import { describe, expect, it } from "vitest";

import type { VerifiedContractBundle } from "../../contracts/bundle/contract-bundle.types";
import { assembleCanonicalBrandStateSnapshot } from "../canonical-state/m1-canonical-brand-state.adapter";
import type {
  NormalizedEvidenceCapabilityId,
  NormalizedEvidenceCapabilityResult,
  NormalizedEvidenceReference,
  NormalizedEvidenceSet,
} from "../evidence/intelligence-evidence.port";
import {
  ProcessorDependencyProfileRegistry,
  type ProcessorDependencyProfile,
} from "./processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "./processor-dependency-readiness.evaluator";

const brandId = "00000000-0000-4000-8000-0000000000e1";
const registry = new ProcessorDependencyProfileRegistry();
const evaluator = new ProcessorDependencyReadinessEvaluator();

function profile(processorId: "brand_communication" | "brand_meaning") {
  const communication = processorId === "brand_communication";
  return registry.resolve({
    manifest: {
      processorId,
      processorVersion: "1.0",
      outputContractId: `${processorId}_output_contract`,
      outputContractVersion: "1.0",
      evidenceContractId: `${processorId}_evidence`,
      architectureRepository: "Piyush1087/dummy_tcs",
      architectureCommitSha: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
      bundleId: `brand_intelligence.${processorId}`,
      bundleVersion: "1.0",
      bundleContentHash: communication ? "communication" : "meaning",
    },
  } as VerifiedContractBundle);
}

function canonical(
  currentProfile: ProcessorDependencyProfile,
  overrides: Readonly<Record<string, Partial<Record<string, unknown>>>> = {},
) {
  return assembleCanonicalBrandStateSnapshot(
    brandId,
    new Date("2026-08-25T10:00:00.000Z"),
    currentProfile.requiredCanonicalSemantics.map((semantic) => ({
      semantic,
      fieldPath: `$.${semantic}`,
      value: semantic === "sub_industry" ? null : `value-${semantic}`,
      authority:
        semantic === "sub_industry"
          ? ("PROVISIONAL" as const)
          : ("APPLICATION_CANONICAL" as const),
      ...overrides[semantic],
    })),
  );
}

function evidenceItem(
  capabilityId: NormalizedEvidenceCapabilityId,
  representativeness: NormalizedEvidenceReference["representativeness"] = "PERSISTENT_BRAND_LEVEL",
): NormalizedEvidenceReference {
  return {
    brandId,
    evidenceRef: `evidence:${capabilityId}:1`,
    capabilityId,
    resourceRef: "resource:home",
    resourceType: "OWNED_WEB_PAGE",
    captureRef: "capture:home:1",
    captureVersion: "1",
    sourceClass: "OWNED_WEBSITE",
    capturedAt: "2026-08-25T10:00:00.000Z",
    freshness: {
      state: "CURRENT",
      evaluatedAt: "2026-08-25T10:01:00.000Z",
      basis: "SAME_ACTIVE_RUN",
    },
    representativeness,
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
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
      itemFingerprint: `fingerprint:${capabilityId}:1`,
      repetitionCount: 1,
      supportingResourceRefs: ["resource:home"],
    },
    contentHash: "a".repeat(64),
  };
}

function evidence(
  currentProfile: ProcessorDependencyProfile,
  populated: readonly NormalizedEvidenceCapabilityId[],
): NormalizedEvidenceSet {
  const capabilityResults: NormalizedEvidenceCapabilityResult[] =
    currentProfile.capabilityIds.map((capabilityId) => ({
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
      evidence: populated.includes(capabilityId)
        ? [evidenceItem(capabilityId)]
        : [],
    }));
  return { brandId, capabilityResults };
}

describe("W1.0E processor-specific dependency readiness", () => {
  it("allows brand_communication with representative messaging and no constraint items", () => {
    const currentProfile = profile("brand_communication");
    const assessment = evaluator.evaluate(
      currentProfile,
      canonical(currentProfile),
      evidence(currentProfile, ["owned_website.brand_messaging"]),
    );
    expect(assessment).toEqual({ readiness: "READY_TO_RUN", reasonCodes: [] });
  });

  it("waits brand_communication when core representative Evidence is absent", () => {
    const currentProfile = profile("brand_communication");
    expect(
      evaluator.evaluate(
        currentProfile,
        canonical(currentProfile),
        evidence(currentProfile, ["derived_communication_constraint_evidence"]),
      ).readiness,
    ).toBe("WAITING_FOR_EVIDENCE");
  });

  it("blocks only a conflict explicitly declared blocking by the profile", () => {
    const currentProfile = profile("brand_communication");
    const conflicted = canonical(currentProfile, {
      industry: { conflictDetected: true },
    });
    const available = evidence(currentProfile, [
      "owned_website.brand_messaging",
    ]);
    expect(
      evaluator.evaluate(currentProfile, conflicted, available).readiness,
    ).toBe("READY_TO_RUN");
    expect(
      evaluator.evaluate(
        { ...currentProfile, blockingConflictSemantics: ["industry"] },
        conflicted,
        available,
      ).readiness,
    ).toBe("BLOCKED_BY_CONFLICT");
  });

  it("treats a required nullable canonical entry as present", () => {
    const currentProfile = profile("brand_meaning");
    expect(
      evaluator.evaluate(
        currentProfile,
        canonical(currentProfile),
        evidence(currentProfile, ["owned_website.brand_company_context"]),
      ).readiness,
    ).toBe("READY_TO_RUN");
  });

  it("allows brand_meaning partial capability content but waits without representative Brand-level context", () => {
    const currentProfile = profile("brand_meaning");
    const prepared = canonical(currentProfile);
    expect(
      evaluator.evaluate(
        currentProfile,
        prepared,
        evidence(currentProfile, ["owned_website.brand_company_context"]),
      ).readiness,
    ).toBe("READY_TO_RUN");
    expect(
      evaluator.evaluate(
        currentProfile,
        prepared,
        evidence(currentProfile, ["owned_website.offering_context"]),
      ).readiness,
    ).toBe("WAITING_FOR_EVIDENCE");
  });

  it("waits for missing non-null canonical anchors before Evidence evaluation", () => {
    const currentProfile = profile("brand_meaning");
    const assessment = evaluator.evaluate(
      currentProfile,
      canonical(currentProfile, { website_url: { value: null } }),
      evidence(currentProfile, ["owned_website.brand_messaging"]),
    );
    expect(assessment.readiness).toBe("WAITING_FOR_CANONICAL_INPUT");
    expect(assessment.reasonCodes).toContain("NULL_ANCHOR:website_url");
  });
});

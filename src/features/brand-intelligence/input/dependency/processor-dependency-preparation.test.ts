import { describe, expect, it, vi } from "vitest";

import type { VerifiedContractBundle } from "../../contracts/bundle/contract-bundle.types";
import { CanonicalStateManifestBuilder } from "../canonical-state/canonical-state-manifest";
import { assembleCanonicalBrandStateSnapshot } from "../canonical-state/m1-canonical-brand-state.adapter";
import { EvidenceManifestBuilder } from "../evidence/evidence-manifest";
import type {
  IntelligenceEvidenceReader,
  NormalizedEvidenceCapabilityId,
  NormalizedEvidenceReference,
} from "../evidence/intelligence-evidence.port";
import { ProcessorDependencyPreparationService } from "./processor-dependency-preparation.service";
import { ProcessorDependencyProfileRegistry } from "./processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "./processor-dependency-readiness.evaluator";

const brandId = "00000000-0000-4000-8000-0000000000e1";
const registryKey = {
  processorId: "brand_communication",
  processorVersion: "1.0",
  outputContractId: "brand_communication_output_contract",
  outputContractVersion: "1.0",
};

function evidenceItem(
  capabilityId: NormalizedEvidenceCapabilityId,
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
    representativeness: "PERSISTENT_BRAND_LEVEL",
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
      state: "COMPLETE",
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: "normalization-run:1",
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

describe("W1.0E dependency preparation boundary", () => {
  it("prepares W1.0D identity inputs without invoking a processor", async () => {
    const bundle = {
      manifest: {
        ...registryKey,
        evidenceContractId: "brand_communication_evidence",
        architectureRepository: "Piyush1087/dummy_tcs",
        architectureCommitSha: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
        bundleId: "brand_intelligence.brand_communication",
        bundleVersion: "1.0",
        bundleContentHash: "frozen-hash",
      },
    } as VerifiedContractBundle;
    const contracts = { getVerifiedBundle: vi.fn().mockReturnValue(bundle) };
    const canonicalReader = {
      read: vi.fn().mockResolvedValue(
        assembleCanonicalBrandStateSnapshot(
          brandId,
          new Date("2026-08-25T10:00:00.000Z"),
          [
            {
              semantic: "brand_name",
              fieldPath: "$.name",
              value: "Example",
              authority: "APPLICATION_CANONICAL",
            },
            {
              semantic: "industry",
              fieldPath: "$.industry",
              value: "OTHER",
              authority: "APPLICATION_CANONICAL",
            },
          ],
        ),
      ),
    };
    const evidenceReader: IntelligenceEvidenceReader = {
      read: vi.fn(async (request) => ({
        brandId,
        capabilityResults: request.capabilityIds.map((capabilityId) => ({
          capabilityExecutionRef: `capability-execution:${capabilityId}:1`,
          capabilityId,
          normalizationContractVersion: "1.0",
          status: "AVAILABLE" as const,
          retryability: "NOT_APPLICABLE" as const,
          reasonCodes: [],
          coverage: "SINGLE_RESOURCE" as const,
          acquisitionQuality: {
            state: "COMPLETE" as const,
            failureCategories: [],
            detailCodes: [],
          },
          evidence:
            capabilityId === "owned_website.brand_messaging"
              ? [evidenceItem(capabilityId)]
              : [],
        })),
      })),
    };
    const service = new ProcessorDependencyPreparationService(
      contracts as never,
      new ProcessorDependencyProfileRegistry(),
      canonicalReader,
      evidenceReader,
      new CanonicalStateManifestBuilder(),
      new EvidenceManifestBuilder(),
      new ProcessorDependencyReadinessEvaluator(),
    );
    const result = await service.prepare({
      brandId,
      registryKey,
      activeScope: [
        {
          brandId,
          objectSemanticId: "communication_profile",
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
        },
      ],
    });

    expect(canonicalReader.read).toHaveBeenCalledWith({
      brandId,
      requiredSemantics: ["brand_name", "industry"],
    });
    expect(evidenceReader.read).toHaveBeenCalledWith({
      brandId,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: [
        "owned_website.brand_messaging",
        "owned_website.brand_company_context",
        "observed_brand_communication_language_signals",
        "derived_communication_constraint_evidence",
      ],
    });
    expect(result).toMatchObject({
      dependencyEligible: true,
      readiness: { readiness: "READY_TO_RUN", reasonCodes: [] },
    });
    expect(result.dependencyManifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidenceManifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.wakeUpSignals).toEqual([
      "CANONICAL_STATE_CHANGED",
      "NEW_EVIDENCE_CAPTURE_AVAILABLE",
      "CANONICAL_CONFLICT_RESOLVED",
    ]);
  });
});

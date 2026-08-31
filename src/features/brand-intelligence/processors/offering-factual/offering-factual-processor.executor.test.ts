import { IntelligenceReadiness } from "@prisma/client";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { OfferingFactualModelProvider } from "./offering-factual-model.provider";
import {
  OfferingFactualProcessorExecutor,
  offeringBusinessStateRef,
} from "./offering-factual-processor.executor";

const brandId = "00000000-0000-4000-8000-000000000001";
const subjectId = "00000000-0000-4000-8000-000000000002";
const offeringId = "00000000-0000-4000-8000-000000000003";
const registryKey = {
  processorId: "offering_factual_synthesis",
  processorVersion: "1.0",
  outputContractId: "offering_factual_synthesis_output_contract",
  outputContractVersion: "1.0",
};
const scope = [
  "$",
  "$/f/factual_summary",
  "$/f/key_facts/i/material-steel",
].map((componentSemanticPath) => ({
  brandId,
  subjectId,
  objectSemanticId: "offering_factual_profile",
  pathSchemeVersion: 1,
  componentSemanticPath,
}));
const reference = {
  entityType: "Offering" as const,
  entityId: offeringId,
  semanticFieldPath: "$",
  revisionKind: "SNAPSHOT_FINGERPRINT" as const,
  revisionToken: "offering-revision-1",
  observedAt: "2026-08-28T00:00:00.000Z",
  canonicalSnapshotRef: "canonical:offering-a:1",
};
const evidenceRef = "evidence:offering-a:context";

function contracts() {
  const registry = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  registry.verifyAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return registry;
}

function prepared(dependencyEligible = true): PreparedProcessorDependencies {
  return {
    brandId,
    registryKey,
    activeScope: scope,
    canonicalState: {
      brandId,
      lifecycleMode: "POST_PROFILE",
      observedAt: reference.observedAt,
      canonicalSnapshotRef: reference.canonicalSnapshotRef,
      entries: [],
      offeringFacts: [
        {
          offeringId,
          brandId,
          name: "Steel Bottle",
          type: "PRODUCT",
          canonicalKind: "PRODUCT",
          canonicalSubtype: null,
          canonicalLifecycle: "ACTIVE",
          description: "A reusable steel bottle.",
          customerDestination: "https://example.test/bottle",
          url: "https://example.test/bottle",
          categoryTag: null,
          isActive: true,
          businessStateReference: reference,
        },
      ],
    },
    canonicalStateManifest: {
      schemaVersion: "1.0",
      brandId,
      canonicalSnapshotRef: reference.canonicalSnapshotRef,
      entries: [],
      offeringReferences: [
        {
          entityType: "Offering",
          entityId: offeringId,
          semanticFieldPath: "$",
          revisionKind: "SNAPSHOT_FINGERPRINT",
          revisionToken: reference.revisionToken,
          canonicalSnapshotRef: reference.canonicalSnapshotRef,
        },
      ],
    },
    dependencyManifest: {
      schemaVersion: "1.0",
      brandId,
      canonicalSnapshotRef: reference.canonicalSnapshotRef,
      entries: [],
    },
    dependencyManifestHash: "d".repeat(64),
    evidence: {
      brandId,
      canonicalOfferingRef: offeringId,
      capabilityResults: [
        {
          capabilityExecutionRef: "capability:context:1",
          capabilityExecutionRefs: ["capability:context:1"],
          capabilityId: "owned_website.offering_context",
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
          evidence: [
            {
              brandId,
              evidenceRef,
              capabilityId: "owned_website.offering_context",
              resourceRef: "resource:offering-a",
              resourceType: "OWNED_WEB_PAGE",
              captureRef: "capture:offering-a:1",
              captureVersion: "capture:offering-a:1",
              sourceClass: "OWNED_WEBSITE",
              capturedAt: reference.observedAt,
              freshness: {
                state: "CURRENT",
                evaluatedAt: reference.observedAt,
                basis: "LATEST_CAPTURE",
              },
              representativeness: "OFFERING_SPECIFIC",
              coverage: "SINGLE_RESOURCE",
              acquisitionQuality: {
                state: "COMPLETE",
                failureCategories: [],
                detailCodes: [],
              },
              provenance: {
                acquisitionOrNormalizationRunRef: "capability:context:1",
                captureMethodClass: "DIRECT_FETCH",
                normalizationContractVersion: "1.0",
                parentEvidenceRefs: [],
                parentCaptureRefs: [],
              },
              deduplication: {
                itemFingerprint: "steel-bottle",
                repetitionCount: 1,
                supportingResourceRefs: ["resource:offering-a"],
              },
              boundedNormalizedPayload: {
                generalization_scope: "SINGLE_OFFERING",
                canonical_offering_ref: offeringId,
                observed_context: "Reusable stainless-steel bottle.",
              },
              contentHash: "c".repeat(64),
              capabilityExecutionRefs: ["capability:context:1"],
            },
          ],
        },
        {
          capabilityExecutionRef: null,
          capabilityId: "explicit_factual_proof_or_claim_evidence",
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
        },
      ],
    },
    evidenceManifest: {
      schemaVersion: "1.0",
      brandId,
      requestedCapabilities: [
        "explicit_factual_proof_or_claim_evidence",
        "owned_website.offering_context",
      ],
      capabilities: [],
    },
    evidenceManifestHash: "e".repeat(64),
    readiness: dependencyEligible
      ? { readiness: "READY_TO_RUN", reasonCodes: [] }
      : {
          readiness: "WAITING_FOR_EVIDENCE",
          reasonCodes: ["EXACT_OFFERING_CONTEXT_NOT_AVAILABLE"],
        },
    dependencyEligible,
    wakeUpSignals: [
      "CANONICAL_STATE_CHANGED",
      "NEW_EVIDENCE_CAPTURE_AVAILABLE",
      "CANONICAL_CONFLICT_RESOLVED",
    ],
  };
}

function output() {
  const businessRef = offeringBusinessStateRef(offeringId, reference);
  const meta = {
    authority: "OBSERVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT",
    evidence_refs: [evidenceRef],
    business_state_refs: [businessRef],
  };
  return {
    offering_factual_profile: {
      factual_summary: "A reusable steel bottle.",
      key_facts: [
        { semantic_id: "material-steel", fact: "Made from stainless steel." },
      ],
      key_benefits: null,
      proof_points: null,
      usage_context: null,
      customer_context: null,
    },
    output_metadata: {
      factual_summary: meta,
      key_facts: [{ semantic_id: "material-steel", ...meta }],
      key_benefits: null,
      proof_points: null,
      usage_context: null,
      customer_context: null,
    },
  };
}

function fixture(state = prepared()) {
  const dependencies = { prepare: vi.fn().mockResolvedValue(state) };
  const model: OfferingFactualModelProvider = {
    generate: vi.fn().mockResolvedValue({
      output: output(),
      providerAttemptCount: 1,
    }),
  };
  const executor = new OfferingFactualProcessorExecutor(
    {
      intelligenceSubject: {
        findUnique: vi.fn().mockResolvedValue({
          id: subjectId,
          brandId,
          subjectType: "OFFERING",
          subjectRef: offeringId,
          offeringId,
        }),
      },
    } as never,
    dependencies as never,
    contracts(),
    new StructuralValidator(),
    new SemanticValidator(),
    model,
  );
  const context = {
    processorExecution: {
      id: "processor-execution-1",
      executionId: "execution-1",
      brandId,
      subjectId,
      processorId: registryKey.processorId,
      processorVersion: registryKey.processorVersion,
      outputContractId: registryKey.outputContractId,
      outputContractVersion: registryKey.outputContractVersion,
      activeScope: scope,
      activeScopeHash: "scope-hash",
      dependencyManifestHash: state.dependencyManifestHash,
      evidenceManifestHash: state.evidenceManifestHash,
    } as never,
    attempt: {} as never,
    heartbeat: vi.fn().mockResolvedValue(undefined),
  };
  return { executor, dependencies, model, context };
}

describe("offering factual executor boundary", () => {
  it("suppresses the provider and waits durably when exact Evidence is absent", async () => {
    const f = fixture(prepared(false));
    await expect(f.executor.execute(f.context)).rejects.toMatchObject({
      failure: {
        category: "DEPENDENCY_UNAVAILABLE",
        code: "WAITING_FOR_EVIDENCE",
      },
    });
    expect(f.model.generate).not.toHaveBeenCalled();
  });

  it("passes only exact Offering context through the external provider boundary", async () => {
    const f = fixture();
    const result = await f.executor.execute(f.context);
    expect(result.readiness).toBe(IntelligenceReadiness.PARTIAL);
    expect(f.model.generate).toHaveBeenCalledTimes(1);
    const request = vi.mocked(f.model.generate).mock.calls[0][0];
    expect(request.evidenceRefs).toEqual([evidenceRef]);
    expect(JSON.stringify(request.approvedContext)).toContain(offeringId);
    expect(JSON.stringify(request.approvedContext)).not.toContain("offering-b");
    expect(f.dependencies.prepare).toHaveBeenCalledTimes(2);
  });

  it("rejects a changed exact Offering basis after provider completion", async () => {
    const f = fixture();
    f.dependencies.prepare
      .mockResolvedValueOnce(prepared())
      .mockResolvedValueOnce({
        ...prepared(),
        evidenceManifestHash: "f".repeat(64),
      });
    await expect(f.executor.execute(f.context)).rejects.toEqual(
      expect.objectContaining<Partial<ProcessorExecutorFailure>>({
        failure: expect.objectContaining({
          category: "RETRYABLE_TECHNICAL",
          code: "OFFERING_INPUT_BASIS_CHANGED",
        }),
      }),
    );
  });
});

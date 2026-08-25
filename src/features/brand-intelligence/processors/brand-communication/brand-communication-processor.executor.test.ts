import { resolve } from "node:path";

import type {
  IntelligenceProcessorAttempt,
  IntelligenceProcessorExecution,
} from "@prisma/client";
import { IntelligenceReadiness } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import type { ProcessorExecutorContext } from "../../execution/executor/processor-executor";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import type {
  BrandCommunicationModelProvider,
  BrandCommunicationModelRequest,
} from "./brand-communication-model.provider";
import { BrandCommunicationProviderError } from "./brand-communication-model.provider";
import { BrandCommunicationProcessorExecutor } from "./brand-communication-processor.executor";

const registryKey = {
  processorId: "brand_communication",
  processorVersion: "1.0",
  outputContractId: "brand_communication_output_contract",
  outputContractVersion: "1.0",
} as const;

function registry(): ContractRuntimeRegistry {
  const semantic = new SemanticValidator();
  const runtime = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    semantic,
  );
  runtime.initializeAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return runtime;
}

function metadata(semanticId: string | null, evidenceRef: string) {
  return {
    semantic_id: semanticId,
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT",
    evidence_refs: [evidenceRef],
  };
}

const validOutput = {
  communication_profile: {
    tone_traits: [{ semantic_id: "warm-direct", trait: "Warm and direct" }],
    free_text_guidance: "Use concise, conversational explanations.",
    communication_constraints: null,
    primary_language: "en",
  },
  output_metadata: {
    tone_traits: [metadata("warm-direct", "ev:message:1")],
    free_text_guidance: metadata(null, "ev:message:1"),
    communication_constraints: null,
    primary_language: metadata(null, "ev:language:1"),
  },
};

function prepared(readiness = "READY_TO_RUN"): PreparedProcessorDependencies {
  const reference = (
    capabilityId:
      | "owned_website.brand_messaging"
      | "observed_brand_communication_language_signals",
    evidenceRef: string,
  ) => ({
    brandId: "brand-1",
    evidenceRef,
    capabilityId,
    resourceRef: "resource:1",
    resourceType: "OWNED_WEB_PAGE" as const,
    captureRef: "capture:1",
    captureVersion: "1",
    sourceClass: "OWNED_WEBSITE" as const,
    capturedAt: "2026-08-26T00:00:00.000Z",
    freshness: {
      state: "CURRENT" as const,
      evaluatedAt: "2026-08-26T00:00:00.000Z",
      basis: "LATEST_CAPTURE",
    },
    representativeness: "PERSISTENT_BRAND_LEVEL" as const,
    coverage: "SINGLE_RESOURCE" as const,
    acquisitionQuality: {
      state: "COMPLETE" as const,
      failureCategories: [],
      detailCodes: [],
    },
    provenance: {
      acquisitionOrNormalizationRunRef: "capability-execution:1",
      captureMethodClass: "DIRECT_FETCH" as const,
      normalizationContractVersion: "1.0",
      parentEvidenceRefs: [],
      parentCaptureRefs: [],
    },
    deduplication: {
      itemFingerprint: evidenceRef,
      repetitionCount: 1,
      supportingResourceRefs: ["resource:1"],
    },
    boundedNormalizedPayload: { text: "Warm, direct English messaging" },
    contentHash: "a".repeat(64),
  });
  const capability = (
    capabilityId:
      | "owned_website.brand_messaging"
      | "owned_website.brand_company_context"
      | "observed_brand_communication_language_signals"
      | "derived_communication_constraint_evidence",
    evidence: readonly ReturnType<typeof reference>[],
  ) => ({
    capabilityExecutionRef: `capability:${capabilityId}`,
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
    evidence,
  });
  const canonicalState = {
    brandId: "brand-1",
    lifecycleMode: "POST_PROFILE" as const,
    observedAt: "2026-08-26T00:00:00.000Z",
    canonicalSnapshotRef: "canonical:1",
    entries: (["brand_name", "industry"] as const).map((semantic) => ({
      semantic,
      value: semantic === "brand_name" ? "Acme" : "Retail",
      source: "BRAND_PROFILE" as const,
      authority: "APPLICATION_CANONICAL" as const,
      fallbackUsed: false,
      conflictDetected: false,
      businessStateReference: {
        entityType: "BrandProfile" as const,
        entityId: "brand-1",
        semanticFieldPath: semantic,
        revisionKind: "UPDATED_AT" as const,
        revisionToken: "2026-08-26T00:00:00.000Z",
        observedAt: "2026-08-26T00:00:00.000Z",
        canonicalSnapshotRef: "canonical:1",
      },
    })),
  };
  const evidence = {
    brandId: "brand-1",
    capabilityResults: [
      capability("owned_website.brand_messaging", [
        reference("owned_website.brand_messaging", "ev:message:1"),
      ]),
      capability("owned_website.brand_company_context", []),
      capability("observed_brand_communication_language_signals", [
        reference(
          "observed_brand_communication_language_signals",
          "ev:language:1",
        ),
      ]),
      capability("derived_communication_constraint_evidence", []),
    ],
  };
  return {
    brandId: "brand-1",
    registryKey,
    activeScope: [
      {
        brandId: "brand-1",
        objectSemanticId: "communication_profile",
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
      },
    ],
    canonicalState,
    canonicalStateManifest: {
      schemaVersion: "1.0",
      brandId: "brand-1",
      canonicalSnapshotRef: "canonical:1",
      entries: [],
    },
    dependencyManifest: {
      schemaVersion: "1.0",
      brandId: "brand-1",
      canonicalSnapshotRef: "canonical:1",
      entries: [],
    },
    dependencyManifestHash: "dependency-hash",
    evidence,
    evidenceManifest: {
      schemaVersion: "1.0",
      brandId: "brand-1",
      requestedCapabilities: evidence.capabilityResults.map(
        (result) => result.capabilityId,
      ),
      capabilities: [],
    },
    evidenceManifestHash: "evidence-hash",
    readiness: {
      readiness:
        readiness as PreparedProcessorDependencies["readiness"]["readiness"],
      reasonCodes: readiness === "READY_TO_RUN" ? [] : ["MISSING_EVIDENCE"],
    },
    dependencyEligible: readiness === "READY_TO_RUN",
    wakeUpSignals: ["NEW_EVIDENCE_CAPTURE_AVAILABLE"],
  };
}

function context(): ProcessorExecutorContext {
  return {
    processorExecution: {
      id: "processor-execution-1",
      executionId: "execution-1",
      brandId: "brand-1",
      ...registryKey,
      bundleId: "brand_intelligence.brand_communication",
      bundleVersion: "1.0",
      bundleHash: "b".repeat(64),
      activeScope: prepared().activeScope,
      activeScopeHash: "active-scope-hash",
      dependencyManifest: {},
      dependencyManifestHash: "dependency-hash",
      evidenceManifest: {},
      evidenceManifestHash: "evidence-hash",
    } as unknown as IntelligenceProcessorExecution,
    attempt: { id: "attempt-1" } as unknown as IntelligenceProcessorAttempt,
    heartbeat: vi.fn(async () => undefined),
  };
}

function executor(
  preparedInput: PreparedProcessorDependencies,
  generate: BrandCommunicationModelProvider["generate"],
) {
  const dependencyService = {
    prepare: vi.fn(async () => preparedInput),
  } as unknown as ProcessorDependencyPreparationService;
  return new BrandCommunicationProcessorExecutor(
    dependencyService,
    registry(),
    new StructuralValidator(),
    new SemanticValidator(),
    { generate },
  );
}

describe("BrandCommunicationProcessorExecutor", () => {
  it("uses the verified schema and returns validated persistence material", async () => {
    const generate = vi.fn(async (request: BrandCommunicationModelRequest) => ({
      output: request.outputSchema.parse(validOutput),
      providerAttemptCount: 1,
    }));
    const result = await executor(prepared(), generate).execute(context());
    expect(result.readiness).toBe(IntelligenceReadiness.PARTIAL);
    expect(result.persistencePayload).toMatchObject({
      kind: "BRAND_COMMUNICATION_V1",
      output: validOutput,
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("does not call the model unless dependency preparation is READY_TO_RUN", async () => {
    const generate = vi.fn(async () => ({
      output: validOutput,
      providerAttemptCount: 1,
    }));
    await expect(
      executor(prepared("WAITING_FOR_EVIDENCE"), generate).execute(context()),
    ).rejects.toMatchObject({
      failure: {
        category: "DEPENDENCY_UNAVAILABLE",
        code: "WAITING_FOR_EVIDENCE",
      },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("classifies transient provider errors as W1.0D retryable", async () => {
    const generate = vi.fn(async () => {
      throw new BrandCommunicationProviderError("REQUEST_TIMEOUT", true);
    });
    await expect(
      executor(prepared(), generate).execute(context()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProcessorExecutorFailure>>({
        failure: { category: "RETRYABLE_TECHNICAL", code: "REQUEST_TIMEOUT" },
      }),
    );
  });

  it("rejects malformed or semantically forbidden output before persistence", async () => {
    const malformed = executor(prepared(), async () => ({
      output: { communication_profile: null },
      providerAttemptCount: 1,
    }));
    await expect(malformed.execute(context())).rejects.toMatchObject({
      failure: { category: "VALIDATION_FAILURE" },
    });

    const forbidden = structuredClone(validOutput);
    forbidden.output_metadata.free_text_guidance!.authority = "BRAND_CONFIRMED";
    const semantic = executor(prepared(), async () => ({
      output: forbidden,
      providerAttemptCount: 1,
    }));
    await expect(semantic.execute(context())).rejects.toMatchObject({
      failure: {
        category: "VALIDATION_FAILURE",
        code: "STRUCTURAL_INVALID_ENUM",
      },
    });
  });
});

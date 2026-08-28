import { IntelligenceReadiness } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { ContractRuntimeRegistry } from "../contracts/registry/contract-runtime.registry";
import { ComponentPathCodec } from "../semantic-path/component-path.codec";
import {
  SYNTHETIC_OUTPUT_CONTRACT_ID,
  SYNTHETIC_OUTPUT_CONTRACT_VERSION,
  SYNTHETIC_PROCESSOR_ID,
  SYNTHETIC_PROCESSOR_VERSION,
  type ProcessorExecutionRequest,
} from "./domain/intelligence-execution.types";
import {
  canonicalActiveScope,
  processorLogicalKey,
  sha256CanonicalExecution,
} from "./domain/execution-hash";
import { ProcessorExecutorRegistry } from "./executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "./executor/synthetic-processor.executor";
import { ExecutionContractGate } from "./registry/execution-contract.gate";

const brandId = "00000000-0000-4000-8000-000000000001";
const registryKey = {
  processorId: SYNTHETIC_PROCESSOR_ID,
  processorVersion: SYNTHETIC_PROCESSOR_VERSION,
  outputContractId: SYNTHETIC_OUTPUT_CONTRACT_ID,
  outputContractVersion: SYNTHETIC_OUTPUT_CONTRACT_VERSION,
};

function syntheticRequest(): ProcessorExecutionRequest {
  return {
    registryKey,
    activeScope: [
      {
        brandId,
        objectSemanticId: "synthetic_test_object",
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
      },
    ],
    dependencyManifest: { revision: 1 },
    evidenceManifest: { evidence: ["one"] },
    executionIntentKey: "unit-test",
    maxAttempts: 2,
    dependencyEligible: true,
    syntheticHarness: { explicit: true, scenario: "SUCCEED_READY" },
  };
}

describe("W1.0D execution identity", () => {
  it("canonicalizes active scope independently of request order", () => {
    const left = {
      brandId,
      objectSemanticId: "object-b",
      pathSchemeVersion: 1,
      componentSemanticPath: "$/f/b",
    };
    const right = {
      brandId,
      objectSemanticId: "object-a",
      pathSchemeVersion: 1,
      componentSemanticPath: "$/f/a",
    };
    expect(canonicalActiveScope([left, right])).toEqual(
      canonicalActiveScope([right, left]),
    );
  });

  it("changes the logical key for bundle, dependency, Evidence, or intent drift", () => {
    const request = syntheticRequest();
    const base = {
      brandId,
      manifest: {
        processorId: registryKey.processorId,
        processorVersion: registryKey.processorVersion,
        bundleId: "bundle",
        bundleVersion: "1",
        bundleContentHash: "a".repeat(64),
      },
      activeScope: request.activeScope,
      dependencyManifestHash: sha256CanonicalExecution({ revision: 1 }),
      evidenceManifestHash: sha256CanonicalExecution({ evidence: ["one"] }),
      executionIntentKey: "intent-one",
    };
    const original = processorLogicalKey(base);
    expect(
      new Set([
        original,
        processorLogicalKey({
          ...base,
          manifest: { ...base.manifest, bundleContentHash: "b".repeat(64) },
        }),
        processorLogicalKey({
          ...base,
          dependencyManifestHash: sha256CanonicalExecution({ revision: 2 }),
        }),
        processorLogicalKey({
          ...base,
          evidenceManifestHash: sha256CanonicalExecution({ evidence: ["two"] }),
        }),
        processorLogicalKey({
          ...base,
          manifest: { ...base.manifest, bundleVersion: "2" },
        }),
        processorLogicalKey({
          ...base,
          activeScope: [
            {
              brandId,
              objectSemanticId: "different-object",
              pathSchemeVersion: 1,
              componentSemanticPath: "$",
            },
          ],
        }),
        processorLogicalKey({ ...base, executionIntentKey: "intent-two" }),
      ]).size,
    ).toBe(7);
  });
});

describe("W1.0D compiled execution gate and synthetic executor", () => {
  const executor = new SyntheticProcessorExecutor();
  const executors = new ProcessorExecutorRegistry(executor);
  const contracts = {
    isReady: () => true,
    registrations: () => [
      {
        processorId: "brand_communication",
        processorVersion: "1.0",
        outputContractId: "brand_communication",
        outputContractVersion: "1.0",
        executionEnabled: false,
      },
    ],
    getVerifiedBundle: () => ({ manifest: {} }),
  } as unknown as ContractRuntimeRegistry;
  const gate = new ExecutionContractGate(contracts, executors);

  it("admits only the exact explicit synthetic registration", () => {
    expect(gate.resolve(syntheticRequest()).processorId).toBe(
      SYNTHETIC_PROCESSOR_ID,
    );
    expect(() =>
      gate.resolve({
        ...syntheticRequest(),
        registryKey: { ...registryKey, processorVersion: "wrong" },
      }),
    ).toThrowError(/exact compiled harness registration/u);
  });

  it("keeps semantic bundles non-executable without both enablement and code", () => {
    expect(() =>
      gate.resolve({
        ...syntheticRequest(),
        registryKey: {
          processorId: "brand_communication",
          processorVersion: "1.0",
          outputContractId: "brand_communication",
          outputContractVersion: "1.0",
        },
        syntheticHarness: undefined,
      }),
    ).toThrowError(/does not imply executable availability/u);
  });

  it("models internal provider retries inside one executor invocation", async () => {
    const result = await executor.execute({
      processorExecution: {
        triggerIntentKey: "synthetic:INTERNAL_RETRY_THEN_SUCCESS:test",
      } as never,
      attempt: {} as never,
      heartbeat: async () => undefined,
    });
    expect(result).toEqual({
      readiness: IntelligenceReadiness.READY,
      telemetry: { internalSubcallCount: 2, internalRetries: 1 },
    });
  });

  it("classifies all synthetic failure scenarios deterministically", async () => {
    for (const [scenario, category] of [
      ["FAIL_RETRYABLE", "RETRYABLE_TECHNICAL"],
      ["FAIL_TERMINAL", "VALIDATION_FAILURE"],
      ["WAIT_DEPENDENCY", "DEPENDENCY_UNAVAILABLE"],
    ] as const) {
      await expect(
        executor.execute({
          processorExecution: {
            triggerIntentKey: `synthetic:${scenario}:test`,
          } as never,
          attempt: {} as never,
          heartbeat: async () => undefined,
        }),
      ).rejects.toMatchObject({ failure: { category } });
    }
  });

  it("retains canonical semantic path validation", () => {
    const codec = new ComponentPathCodec();
    expect(codec.normalize("$/f/tone/i/warm-direct")).toBe(
      "$/f/tone/i/warm-direct",
    );
    expect(() => codec.normalize("$/f/items/i/0")).toThrowError(
      /Array positions/u,
    );
  });
});

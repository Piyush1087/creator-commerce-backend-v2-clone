import { Injectable } from "@nestjs/common";

import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import type { ContractBundleManifest } from "../../contracts/bundle/contract-bundle.types";
import { IntelligenceExecutionError } from "../domain/intelligence-execution.error";
import {
  SYNTHETIC_BUNDLE_ID,
  SYNTHETIC_BUNDLE_VERSION,
  SYNTHETIC_OUTPUT_CONTRACT_ID,
  SYNTHETIC_OUTPUT_CONTRACT_VERSION,
  SYNTHETIC_PROCESSOR_ID,
  SYNTHETIC_PROCESSOR_VERSION,
  type ProcessorExecutionRequest,
} from "../domain/intelligence-execution.types";
import { sha256CanonicalExecution } from "../domain/execution-hash";
import { ProcessorExecutorRegistry } from "../executor/processor-executor.registry";

const SYNTHETIC_BUNDLE_HASH = sha256CanonicalExecution(
  "brand-intelligence-w1.0d-synthetic-bundle-v1",
);

@Injectable()
export class ExecutionContractGate {
  constructor(
    private readonly contracts: ContractRuntimeRegistry,
    private readonly executors: ProcessorExecutorRegistry,
  ) {}

  resolve(request: ProcessorExecutionRequest): ContractBundleManifest {
    if (!this.contracts.isReady()) {
      throw new IntelligenceExecutionError(
        "CONFIGURATION_DRIFT",
        "The verified Intelligence contract registry is not ready",
      );
    }
    if (request.syntheticHarness?.explicit) {
      if (
        request.registryKey.processorId !== SYNTHETIC_PROCESSOR_ID ||
        request.registryKey.processorVersion !== SYNTHETIC_PROCESSOR_VERSION ||
        request.registryKey.outputContractId !== SYNTHETIC_OUTPUT_CONTRACT_ID ||
        request.registryKey.outputContractVersion !==
          SYNTHETIC_OUTPUT_CONTRACT_VERSION ||
        !this.executors.has(SYNTHETIC_PROCESSOR_ID)
      ) {
        throw new IntelligenceExecutionError(
          "CONFIGURATION_DRIFT",
          "Synthetic execution requires the exact compiled harness registration",
        );
      }
      return this.syntheticManifest();
    }

    let bundle;
    try {
      bundle = this.contracts.getVerifiedBundle(request.registryKey);
    } catch {
      throw new IntelligenceExecutionError(
        "CONFIGURATION_DRIFT",
        "Processor contract is not present in the verified allow-list",
      );
    }
    const registration = this.contracts
      .registrations()
      .find(
        (entry) =>
          entry.processorId === request.registryKey.processorId &&
          entry.processorVersion === request.registryKey.processorVersion &&
          entry.outputContractId === request.registryKey.outputContractId &&
          entry.outputContractVersion ===
            request.registryKey.outputContractVersion,
      );
    if (
      !registration ||
      !registration.executionEnabled ||
      !this.executors.has(registration.processorId)
    ) {
      throw new IntelligenceExecutionError(
        "CONFIGURATION_DRIFT",
        "Semantic bundle registration does not imply executable availability",
      );
    }
    return bundle.manifest;
  }

  private syntheticManifest(): ContractBundleManifest {
    return {
      manifestSchemaVersion: 1,
      bundleId: SYNTHETIC_BUNDLE_ID,
      bundleVersion: SYNTHETIC_BUNDLE_VERSION,
      ownerEngine: "brand_intelligence",
      owningBranch: "synthetic_test",
      architectureRepository: "compiled-backend-test-harness",
      architectureCommitSha: "0".repeat(40),
      processorId: SYNTHETIC_PROCESSOR_ID,
      processorVersion: SYNTHETIC_PROCESSOR_VERSION,
      outputContractId: SYNTHETIC_OUTPUT_CONTRACT_ID,
      outputContractVersion: SYNTHETIC_OUTPUT_CONTRACT_VERSION,
      evidenceContractId: "synthetic_test_evidence_contract",
      evidenceContractVersion: "1.0",
      ownedObjectSemanticIds: ["synthetic_test_object"],
      ownedPathPatterns: [
        {
          objectSemanticId: "synthetic_test_object",
          componentPathPattern: "$",
        },
      ],
      generatedNotice: "GENERATED — DO NOT EDIT",
      generatorVersion: "1.0.0",
      artifacts: [],
      bundleContentHash: SYNTHETIC_BUNDLE_HASH,
    };
  }
}

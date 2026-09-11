import { Injectable, type OnModuleInit } from "@nestjs/common";
import { join } from "node:path";

import {
  ContractBundleIntegrityVerifier,
  type GeneratedContractRegistration,
  type VerifiedContractRuntime,
} from "../bundle/contract-bundle.integrity";
import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../bundle/contract-bundle.types";
import { ContractRuntimeError } from "../bundle/contract-runtime.error";
import { SemanticValidator } from "../validation/semantic.validator";

function keyOf(key: ContractRegistryKey): string {
  return [
    key.processorId,
    key.processorVersion,
    key.outputContractId,
    key.outputContractVersion,
  ].join("\u0000");
}

@Injectable()
export class ContractRuntimeRegistry implements OnModuleInit {
  private runtime?: VerifiedContractRuntime;
  private startupFailure?: ContractRuntimeError;

  constructor(
    private readonly integrity: ContractBundleIntegrityVerifier,
    private readonly semanticValidator: SemanticValidator,
  ) {}

  onModuleInit(): void {
    this.initializeAtRoot(
      join(__dirname, "..", "..", "generated", "contract-bundles"),
    );
  }

  /**
   * Integrity failure is isolated to this module: readiness becomes false and
   * every bundle lookup fails closed, while unrelated Nest domains may start.
   */
  initializeAtRoot(root: string): void {
    try {
      this.verifyAtRoot(root);
    } catch (error) {
      this.runtime = undefined;
      this.startupFailure =
        error instanceof ContractRuntimeError
          ? error
          : new ContractRuntimeError(
              "CONTRACT_RUNTIME_STARTUP_FAILURE",
              "Brand Intelligence contract runtime failed startup verification",
            );
    }
  }

  verifyAtRoot(root: string): void {
    const validatorIds = new Set([
      "contract_output_schema_v1",
      "intelligence_persistence_transition_v1",
      ...this.semanticValidator.registeredValidatorIds(),
    ]);
    this.runtime = this.integrity.verifyRoot(root, validatorIds);
    this.startupFailure = undefined;
  }

  isReady(): boolean {
    return this.runtime !== undefined;
  }

  readinessFailure(): Readonly<{ code: string; message: string }> | undefined {
    return this.startupFailure
      ? { code: this.startupFailure.code, message: this.startupFailure.message }
      : undefined;
  }

  getVerifiedBundle(key: ContractRegistryKey): VerifiedContractBundle {
    if (!this.runtime) {
      throw new ContractRuntimeError(
        this.startupFailure?.code ?? "CONTRACT_RUNTIME_NOT_READY",
        "Brand Intelligence contract runtime is NOT_READY",
      );
    }
    const bundle = this.runtime.bundles.get(keyOf(key));
    if (!bundle) {
      throw new ContractRuntimeError(
        "UNKNOWN_CONTRACT_REGISTRY_KEY",
        "Processor/output-contract key is not allow-listed",
      );
    }
    return bundle;
  }

  registrations(): readonly GeneratedContractRegistration[] {
    if (!this.runtime) return [];
    return this.runtime.registry.registrations;
  }
}

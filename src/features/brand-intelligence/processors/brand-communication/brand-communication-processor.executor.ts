import { Inject, Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";

import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import type {
  BusinessStateManifestEntry,
  EvidenceManifestEntry,
} from "../../contracts/validation/validation.types";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../../execution/executor/processor-executor";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import {
  BRAND_COMMUNICATION_MODEL_PROVIDER,
  BrandCommunicationProviderError,
  type BrandCommunicationModelProvider,
} from "./brand-communication-model.provider";
import {
  BRAND_COMMUNICATION_PROMPT_VERSION,
  BRAND_COMMUNICATION_SYSTEM_INSTRUCTION,
} from "./brand-communication-prompt";
import { verifiedOutputZodSchema } from "./verified-output-zod-schema";

export const BRAND_COMMUNICATION_PROCESSOR_ID = "brand_communication" as const;
export const BRAND_COMMUNICATION_PROCESSOR_VERSION = "1.0" as const;

export interface BrandCommunicationPersistencePayload {
  readonly kind: "BRAND_COMMUNICATION_V1";
  readonly output: Readonly<Record<string, unknown>>;
  readonly prepared: PreparedProcessorDependencies;
}

function activeScope(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value)) throw new Error("INVALID_ACTIVE_SCOPE");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object")
      throw new Error("INVALID_ACTIVE_SCOPE");
    const address = entry as Record<string, unknown>;
    if (
      typeof address.objectSemanticId !== "string" ||
      typeof address.pathSchemeVersion !== "number" ||
      typeof address.componentSemanticPath !== "string"
    ) {
      throw new Error("INVALID_ACTIVE_SCOPE");
    }
    return {
      brandId,
      objectSemanticId: address.objectSemanticId,
      pathSchemeVersion: address.pathSchemeVersion,
      componentSemanticPath: address.componentSemanticPath,
    } as ComponentSemanticAddress;
  });
}

function semanticManifests(prepared: PreparedProcessorDependencies): Readonly<{
  evidence: readonly EvidenceManifestEntry[];
  business: readonly BusinessStateManifestEntry[];
}> {
  return {
    evidence: prepared.evidence.capabilityResults.flatMap((capability) =>
      capability.evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        // DE's durable Wave-1 execution vocabulary names the deterministic
        // capability `derived_...`; the frozen BI evidence contract names the
        // same processor-facing semantic `communication_constraint_evidence`.
        capabilityId:
          capability.capabilityId ===
          "derived_communication_constraint_evidence"
            ? "communication_constraint_evidence"
            : capability.capabilityId,
        semanticId: item.evidenceRef,
        revisionIdentity: item.captureVersion,
      })),
    ),
    business: prepared.canonicalState.entries.map((entry) => ({
      businessStateRef: sha256CanonicalExecution({
        semantic: entry.semantic,
        reference: entry.businessStateReference,
      }),
      semanticId: entry.semantic,
      revisionIdentity: entry.businessStateReference.revisionToken,
    })),
  };
}

function readiness(
  output: Readonly<Record<string, unknown>>,
): IntelligenceReadiness {
  const profile = output.communication_profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return IntelligenceReadiness.NOT_READY;
  }
  const values = Object.values(profile as Record<string, unknown>);
  if (
    values.length === 4 &&
    values.every((value) => value !== null && value !== undefined)
  ) {
    return IntelligenceReadiness.READY;
  }
  return values.some((value) => value !== null && value !== undefined)
    ? IntelligenceReadiness.PARTIAL
    : IntelligenceReadiness.NOT_READY;
}

@Injectable()
export class BrandCommunicationProcessorExecutor implements ProcessorExecutor {
  readonly processorId = BRAND_COMMUNICATION_PROCESSOR_ID;

  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structuralValidator: StructuralValidator,
    private readonly semanticValidator: SemanticValidator,
    @Inject(BRAND_COMMUNICATION_MODEL_PROVIDER)
    private readonly model: BrandCommunicationModelProvider,
  ) {}

  async execute(context: ProcessorExecutorContext) {
    const execution = context.processorExecution;
    try {
      const scope = activeScope(execution.activeScope, execution.brandId);
      const registryKey = {
        processorId: execution.processorId,
        processorVersion: execution.processorVersion,
        outputContractId: execution.outputContractId,
        outputContractVersion: execution.outputContractVersion,
      };
      const bundle = this.contracts.getVerifiedBundle(registryKey);
      const prepared = await this.dependencies.prepare({
        brandId: execution.brandId,
        registryKey,
        activeScope: scope,
      });
      if (!prepared.dependencyEligible) {
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: prepared.readiness.readiness,
        });
      }
      if (
        prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
        prepared.evidenceManifestHash !== execution.evidenceManifestHash
      ) {
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: "DEPENDENCY_SNAPSHOT_CHANGED",
        });
      }

      await context.heartbeat();
      const modelResult = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: BRAND_COMMUNICATION_SYSTEM_INSTRUCTION,
        approvedContext: this.approvedContext(prepared),
        evidenceRefs: prepared.evidence.capabilityResults.flatMap(
          (capability) => capability.evidence.map((item) => item.evidenceRef),
        ),
        outputSchema: verifiedOutputZodSchema(bundle),
      });
      await context.heartbeat();

      const structural = this.structuralValidator.validate(
        bundle,
        modelResult.output,
      );
      if (!structural.valid) {
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: `STRUCTURAL_${structural.issues[0]?.code ?? "INVALID_OUTPUT"}`,
        });
      }
      const manifests = semanticManifests(prepared);
      const semantic = this.semanticValidator.validate(structural.value, {
        bundle,
        evidenceManifest: manifests.evidence,
        businessStateManifest: manifests.business,
      });
      if (!semantic.valid) {
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: `SEMANTIC_${semantic.issues[0]?.code ?? "INVALID_OUTPUT"}`,
        });
      }
      const output = semantic.value as Readonly<Record<string, unknown>>;
      return {
        readiness: readiness(output),
        telemetry: {
          promptVersion: BRAND_COMMUNICATION_PROMPT_VERSION,
          providerAttemptCount: modelResult.providerAttemptCount,
          evidenceReferenceCount: manifests.evidence.length,
        },
        persistencePayload: {
          kind: "BRAND_COMMUNICATION_V1",
          output,
          prepared,
        } satisfies BrandCommunicationPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof BrandCommunicationProviderError) {
        if (error.code === "STRUCTURED_OUTPUT_INVALID") {
          throw new ProcessorExecutorFailure({
            category: "VALIDATION_FAILURE",
            code: error.code,
          });
        }
        throw new ProcessorExecutorFailure({
          category: error.retryable
            ? "RETRYABLE_TECHNICAL"
            : "CONFIGURATION_DRIFT",
          code: error.code,
        });
      }
      throw new ProcessorExecutorFailure({
        category: "CONFIGURATION_DRIFT",
        code: "BRAND_COMMUNICATION_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }

  private approvedContext(prepared: PreparedProcessorDependencies): unknown {
    return {
      canonicalState: prepared.canonicalState.entries.map((entry) => ({
        semantic: entry.semantic,
        value: entry.value,
        authority: entry.authority,
        conflictDetected: entry.conflictDetected,
        businessStateRevision: entry.businessStateReference.revisionToken,
      })),
      evidence: prepared.evidence.capabilityResults.map((capability) => ({
        capabilityId: capability.capabilityId,
        status: capability.status,
        coverage: capability.coverage,
        reasonCodes: capability.reasonCodes,
        items: capability.evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          sourceClass: item.sourceClass,
          freshness: item.freshness.state,
          representativeness: item.representativeness,
          polarity: item.polarity,
          conflictGroupRef: item.conflictGroupRef,
          boundedNormalizedPayload: item.boundedNormalizedPayload,
        })),
      })),
    };
  }
}

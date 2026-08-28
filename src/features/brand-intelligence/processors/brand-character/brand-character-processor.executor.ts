import { Inject, Injectable } from "@nestjs/common";
import { IntelligenceReadiness } from "@prisma/client";

import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../../execution/executor/processor-executor";
import {
  ProcessorDependencyPreparationService,
  type PreparedProcessorDependencies,
} from "../../input/dependency/processor-dependency-preparation.service";
import {
  BRAND_CHARACTER_MODEL_PROVIDER,
  BrandCharacterProviderError,
  type BrandCharacterModelProvider,
} from "./brand-character-model.provider";
import {
  BRAND_CHARACTER_PROMPT_VERSION,
  BRAND_CHARACTER_SYSTEM_INSTRUCTION,
} from "./brand-character-prompt";

import {
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterObject,
  type BrandCharacterOutput,
  type BrandCharacterPersistencePayload,
} from "./brand-character.types";
import {
  characterScope,
  validateCharacterIdentity,
} from "./brand-character-identity";
import { BrandCharacterStateRepository } from "./brand-character-state.repository";

function businessManifest(prepared: PreparedProcessorDependencies) {
  return prepared.canonicalState.entries.map((entry) => ({
    businessStateRef: sha256CanonicalExecution({
      semantic: entry.semantic,
      reference: entry.businessStateReference,
    }),
    semanticId: entry.semantic,
    revisionIdentity: entry.businessStateReference.revisionToken,
  }));
}

@Injectable()
export class BrandCharacterProcessorExecutor implements ProcessorExecutor {
  readonly processorId = "brand_character";
  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly state: BrandCharacterStateRepository,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(BRAND_CHARACTER_MODEL_PROVIDER)
    private readonly model: BrandCharacterModelProvider,
  ) {}

  async execute(context: ProcessorExecutorContext) {
    try {
      const execution = context.processorExecution;
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
        activeScope: characterScope(execution.activeScope, execution.brandId),
      });
      if (!prepared.dependencyEligible)
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: prepared.readiness.readiness,
        });
      if (
        prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
        prepared.evidenceManifestHash !== execution.evidenceManifestHash
      )
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: "DEPENDENCY_SNAPSHOT_CHANGED",
        });
      const objects = [
        ...new Set(
          prepared.activeScope.map(
            (address) => address.objectSemanticId as BrandCharacterObject,
          ),
        ),
      ];
      const current = await this.state.read(execution.brandId, objects);
      const business = businessManifest(prepared);
      const evidence = prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          capabilityId: cap.capabilityId,
          semanticId: item.evidenceRef,
          revisionIdentity: item.captureVersion,
          representativeness: item.representativeness,
          normalizedPayload: item.boundedNormalizedPayload,
          polarity: item.polarity,
        })),
      );
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: BRAND_CHARACTER_SYSTEM_INSTRUCTION,
        outputSchema: verifiedOutputZodSchema(bundle),
        evidenceRefs: evidence.map((item) => item.evidenceRef),
        approvedContext: {
          activeScope: prepared.activeScope,
          identityAndProtection: current
            .filter((row) => row.componentSemanticPath !== "$")
            .map((row) => ({
              objectId: row.objectSemanticId,
              path: row.componentSemanticPath,
              value: row.currentComponentGeneration.valuePayload,
              protection: row.protectionState,
              comparisonOnly: true,
            })),
          canonicalState: prepared.canonicalState.entries.map(
            (entry, index) => ({
              semantic: entry.semantic,
              value: entry.value,
              authority: entry.authority,
              provenanceStatus: entry.provenanceStatus,
              resolutionStatus: entry.resolutionStatus,
              conflictDetected: entry.conflictDetected,
              businessStateRef: business[index].businessStateRef,
            }),
          ),
          evidence: prepared.evidence.capabilityResults.map((cap) => ({
            capabilityId: cap.capabilityId,
            status: cap.status,
            coverage: cap.coverage,
            items: cap.evidence.map((item) => ({
              evidenceRef: item.evidenceRef,
              sourceClass: item.sourceClass,
              freshness: item.freshness.state,
              representativeness: item.representativeness,
              polarity: item.polarity,
              conflictGroupRef: item.conflictGroupRef,
              boundedNormalizedPayload: item.boundedNormalizedPayload,
            })),
          })),
        },
      });
      await context.heartbeat();
      const structural = this.structural.validate(bundle, generated.output);
      if (!structural.valid)
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: `STRUCTURAL_${structural.issues[0]?.code ?? "INVALID_OUTPUT"}`,
        });
      const semantic = this.semantic.validate(structural.value, {
        bundle,
        evidenceManifest: evidence,
        businessStateManifest: business,
      });
      if (!semantic.valid)
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: `SEMANTIC_${semantic.issues[0]?.code ?? "INVALID_OUTPUT"}`,
        });
      // Narrow only after both verified-contract validation stages have passed.
      const output = semantic.value as BrandCharacterOutput;
      validateCharacterIdentity(output, current, prepared.activeScope);
      const count = BRAND_CHARACTER_OBJECTS.filter(
        (id) => (output[id]?.length ?? 0) > 0,
      ).length;
      return {
        readiness:
          count === 2
            ? IntelligenceReadiness.READY
            : count
              ? IntelligenceReadiness.PARTIAL
              : IntelligenceReadiness.NOT_READY,
        telemetry: {
          promptVersion: BRAND_CHARACTER_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
        },
        persistencePayload: {
          kind: "BRAND_CHARACTER_V1",
          current,
          output,
          prepared,
        } satisfies BrandCharacterPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof BrandCharacterProviderError)
        throw new ProcessorExecutorFailure({
          category:
            error.code === "STRUCTURED_OUTPUT_INVALID"
              ? "VALIDATION_FAILURE"
              : error.retryable
                ? "RETRYABLE_TECHNICAL"
                : "CONFIGURATION_DRIFT",
          code: error.code,
        });
      throw new ProcessorExecutorFailure({
        category: "CONFIGURATION_DRIFT",
        code: "BRAND_CHARACTER_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

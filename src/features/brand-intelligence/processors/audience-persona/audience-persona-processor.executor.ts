import { Inject, Injectable } from "@nestjs/common";
import { audienceOutputReadiness } from "./audience-persona-plan";
import { supportsAudience } from "./audience-persona-evidence";

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
  AUDIENCE_PERSONA_MODEL_PROVIDER,
  AudiencePersonaProviderError,
  type AudiencePersonaModelProvider,
} from "./audience-persona-model.provider";
import {
  AUDIENCE_PERSONA_PROMPT_VERSION,
  AUDIENCE_PERSONA_SYSTEM_INSTRUCTION,
} from "./audience-persona-prompt";

import {
  type AudienceOutput,
  type AudiencePersistencePayload,
} from "./audience-persona.types";
import {
  audienceScope,
  validateAudienceIdentity,
} from "./audience-persona-identity";
import { AudiencePersonaStateRepository } from "./audience-persona-state.repository";

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
export class AudiencePersonaProcessorExecutor implements ProcessorExecutor {
  readonly processorId = "audience_persona_synthesis";
  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly state: AudiencePersonaStateRepository,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(AUDIENCE_PERSONA_MODEL_PROVIDER)
    private readonly model: AudiencePersonaModelProvider,
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
        activeScope: audienceScope(execution.activeScope, execution.brandId),
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
      const current = await this.state.read(execution.brandId);
      const business = businessManifest(prepared);
      const evidence = prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          capabilityId: cap.capabilityId,
          semanticId: item.evidenceRef,
          revisionIdentity: item.captureVersion,
          representativeness: item.representativeness,
          // Non-current observations remain comparison context for the prompt,
          // but cannot establish a new current Persona or field lineage.
          normalizedPayload:
            item.freshness.state === "CURRENT" &&
            item.acquisitionQuality.state !== "UNAVAILABLE" &&
            cap.status !== "UNAVAILABLE" &&
            cap.status !== "NOT_REQUESTED"
              ? item.boundedNormalizedPayload
              : undefined,
          polarity: item.polarity,
        })),
      );
      if (!evidence.some(supportsAudience))
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code: "WAITING_FOR_EVIDENCE",
        });
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: AUDIENCE_PERSONA_SYSTEM_INSTRUCTION,
        outputSchema: verifiedOutputZodSchema(bundle),
        evidenceRefs: evidence.map((item) => item.evidenceRef),
        approvedContext: {
          activeScope: prepared.activeScope,
          frozenReasoning: bundle.artifacts.reasoningContract,
          frozenEvidence: bundle.artifacts.evidenceContract,
          identityAndProtection: current
            .filter((row) => row.componentSemanticPath !== "$")
            .map((row) => ({
              objectId: row.objectSemanticId,
              path: row.componentSemanticPath,
              value: row.currentComponentGeneration.valuePayload,
              protection: row.protectionState,
              metadata: row.currentComponentGeneration.metadataPayload,
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
      const output = semantic.value as AudienceOutput;
      validateAudienceIdentity(output, current);
      return {
        readiness: audienceOutputReadiness(output),
        telemetry: {
          promptVersion: AUDIENCE_PERSONA_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
        },
        persistencePayload: {
          kind: "AUDIENCE_PERSONA_V1",
          current,
          output,
          prepared,
        } satisfies AudiencePersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof AudiencePersonaProviderError)
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
        code: "AUDIENCE_PERSONA_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

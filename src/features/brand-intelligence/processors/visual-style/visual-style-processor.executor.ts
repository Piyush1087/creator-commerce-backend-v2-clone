import { Inject, Injectable } from "@nestjs/common";
import { visualStyleOutputReadiness } from "./visual-style-plan";

import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";
import {
  visualStyleBusinessRef,
  visualStyleBusinessEntries,
  validateVisualCanonicalBoundary,
} from "./visual-style-business-refs";
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
  VISUAL_STYLE_MODEL_PROVIDER,
  VisualStyleProviderError,
  type VisualStyleModelProvider,
} from "./visual-style-model.provider";
import {
  VISUAL_STYLE_PROMPT_VERSION,
  VISUAL_STYLE_SYSTEM_INSTRUCTION,
} from "./visual-style-prompt";

import {
  type VisualStyleOutput,
  type VisualStylePersistencePayload,
} from "./visual-style.types";
import {
  visualStyleScope,
  validateVisualStyleIdentity,
} from "./visual-style-identity";
import { VisualStyleStateRepository } from "./visual-style-state.repository";

function businessManifest(prepared: PreparedProcessorDependencies) {
  return visualStyleBusinessEntries(prepared.canonicalState).map((entry) => ({
    businessStateRef: visualStyleBusinessRef(
      entry.semantic,
      entry.businessStateReference,
    ),
    semanticId: entry.semantic,
    revisionIdentity: entry.businessStateReference.revisionToken,
  }));
}

@Injectable()
export class VisualStyleProcessorExecutor implements ProcessorExecutor {
  readonly processorId = "visual_style_synthesis";
  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly state: VisualStyleStateRepository,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(VISUAL_STYLE_MODEL_PROVIDER)
    private readonly model: VisualStyleModelProvider,
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
        activeScope: visualStyleScope(execution.activeScope, execution.brandId),
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
      if (
        prepared.brandId !== execution.brandId ||
        prepared.canonicalState.brandId !== execution.brandId ||
        prepared.evidence.brandId !== execution.brandId ||
        prepared.evidence.capabilityResults.some((cap) =>
          cap.evidence.some((e) => e.brandId !== execution.brandId),
        )
      )
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: "VISUAL_STYLE_CROSS_BRAND_INPUT",
        });
      validateVisualCanonicalBoundary(
        prepared.canonicalState,
        execution.brandId,
      );
      const current = await this.state.read(execution.brandId);
      const business = businessManifest(prepared);
      const evidence = prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          capabilityId: cap.capabilityId,
          semanticId: item.evidenceRef,
          revisionIdentity: item.captureVersion,
          representativeness: item.representativeness,
          normalizedPayload:
            item.acquisitionQuality.state !== "UNAVAILABLE" &&
            cap.status !== "UNAVAILABLE" &&
            cap.status !== "NOT_REQUESTED"
              ? item.boundedNormalizedPayload
              : undefined,
          polarity: item.polarity,
          conflictGroupRef: item.conflictGroupRef,
          freshness: item.freshness.state,
          sourceClass: item.sourceClass,
        })),
      );
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: VISUAL_STYLE_SYSTEM_INSTRUCTION,
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
          canonicalVisualReferences: (
            prepared.canonicalState.visualState?.items ?? []
          ).map((item) => ({
            ...item,
            businessStateRef: business.find(
              (b) => b.semanticId === "visual:" + item.itemId,
            )!.businessStateRef,
            referenceOnly: true,
          })),
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
      const output = semantic.value as VisualStyleOutput;
      validateVisualStyleIdentity(output, current);
      validateVisualCanonicalBoundary(
        prepared.canonicalState,
        execution.brandId,
        output,
      );
      return {
        readiness: visualStyleOutputReadiness(output),
        telemetry: {
          promptVersion: VISUAL_STYLE_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
        },
        persistencePayload: {
          kind: "VISUAL_STYLE_V1",
          current,
          output,
          prepared,
        } satisfies VisualStylePersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof VisualStyleProviderError)
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
        code: "VISUAL_STYLE_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

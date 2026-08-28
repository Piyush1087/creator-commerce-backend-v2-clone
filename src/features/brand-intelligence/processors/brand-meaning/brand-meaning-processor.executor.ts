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
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import {
  BRAND_MEANING_MODEL_PROVIDER,
  BrandMeaningProviderError,
  type BrandMeaningModelProvider,
} from "./brand-meaning-model.provider";
import {
  BRAND_MEANING_PROMPT_VERSION,
  BRAND_MEANING_SYSTEM_INSTRUCTION,
} from "./brand-meaning-prompt";

export const BRAND_MEANING_OBJECTS = [
  "brand_description",
  "positioning",
  "value_proposition",
] as const;
export type BrandMeaningObject = (typeof BRAND_MEANING_OBJECTS)[number];
export interface BrandMeaningMetadata {
  readonly authority: string;
  readonly source_class: string;
  readonly freshness: "CURRENT" | "STALE" | "UNKNOWN";
  readonly evidence_refs: readonly string[];
  readonly business_state_refs?: readonly string[];
}
export type BrandMeaningOutput = Readonly<
  Record<BrandMeaningObject, string | null>
> & {
  readonly output_metadata: Readonly<
    Record<BrandMeaningObject, BrandMeaningMetadata | null>
  >;
};
export interface BrandMeaningPersistencePayload {
  readonly kind: "BRAND_MEANING_V1";
  readonly output: BrandMeaningOutput;
  readonly prepared: PreparedProcessorDependencies;
}

function scopeOf(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("INVALID_ACTIVE_SCOPE");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      throw new Error("INVALID_ACTIVE_SCOPE");
    const row = entry as Record<string, unknown>;
    if (
      !BRAND_MEANING_OBJECTS.some((id) => id === row.objectSemanticId) ||
      row.componentSemanticPath !== "$" ||
      row.pathSchemeVersion !== 1 ||
      (row.brandId !== undefined && row.brandId !== brandId)
    )
      throw new Error("INVALID_ACTIVE_SCOPE");
    return {
      brandId,
      objectSemanticId: row.objectSemanticId as BrandMeaningObject,
      componentSemanticPath: "$",
      pathSchemeVersion: 1,
    };
  });
}

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

function generalizationScope(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return undefined;
  const value = (payload as Record<string, unknown>).generalization_scope;
  return typeof value === "string" ? value : undefined;
}

@Injectable()
export class BrandMeaningProcessorExecutor implements ProcessorExecutor {
  readonly processorId = "brand_meaning";
  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(BRAND_MEANING_MODEL_PROVIDER)
    private readonly model: BrandMeaningModelProvider,
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
        activeScope: scopeOf(execution.activeScope, execution.brandId),
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
      const business = businessManifest(prepared);
      const evidence = prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => ({
          evidenceRef: item.evidenceRef,
          capabilityId: cap.capabilityId,
          semanticId: item.evidenceRef,
          revisionIdentity: item.captureVersion,
          representativeness: item.representativeness,
          generalizationScope: generalizationScope(
            item.boundedNormalizedPayload,
          ),
        })),
      );
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: BRAND_MEANING_SYSTEM_INSTRUCTION,
        outputSchema: verifiedOutputZodSchema(bundle),
        evidenceRefs: evidence.map((item) => item.evidenceRef),
        approvedContext: {
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
      const output = semantic.value as BrandMeaningOutput;
      const count = BRAND_MEANING_OBJECTS.filter(
        (id) => output[id] !== null,
      ).length;
      return {
        readiness:
          count === 3
            ? IntelligenceReadiness.READY
            : count
              ? IntelligenceReadiness.PARTIAL
              : IntelligenceReadiness.NOT_READY,
        telemetry: {
          promptVersion: BRAND_MEANING_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
        },
        persistencePayload: {
          kind: "BRAND_MEANING_V1",
          output,
          prepared,
        } satisfies BrandMeaningPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof BrandMeaningProviderError)
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
        code: "BRAND_MEANING_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

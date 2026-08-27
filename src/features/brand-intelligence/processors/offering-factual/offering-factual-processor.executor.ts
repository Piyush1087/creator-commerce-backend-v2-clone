import { Inject, Injectable } from "@nestjs/common";
import { IntelligenceReadiness, IntelligenceSubjectType } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import type {
  BusinessStateManifestEntry,
  EvidenceManifestEntry,
} from "../../contracts/validation/validation.types";
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
  OFFERING_FACTUAL_MODEL_PROVIDER,
  OfferingFactualProviderError,
  type OfferingFactualModelProvider,
} from "./offering-factual-model.provider";
import {
  OFFERING_FACTUAL_PROMPT_VERSION,
  OFFERING_FACTUAL_SYSTEM_INSTRUCTION,
} from "./offering-factual-prompt";
import {
  OFFERING_FACTUAL_FAMILIES,
  OFFERING_FACTUAL_OBJECT,
  OFFERING_FACTUAL_PROCESSOR_ID,
  type OfferingFactualPersistencePayload,
} from "./offering-factual.types";

function activeScope(
  value: unknown,
  brandId: string,
  subjectId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("INVALID_ACTIVE_SCOPE");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object")
      throw new Error("INVALID_ACTIVE_SCOPE");
    const address = entry as Record<string, unknown>;
    if (
      address.objectSemanticId !== OFFERING_FACTUAL_OBJECT ||
      address.pathSchemeVersion !== 1 ||
      typeof address.componentSemanticPath !== "string" ||
      (address.brandId !== undefined && address.brandId !== brandId) ||
      (address.subjectId !== undefined && address.subjectId !== subjectId)
    ) {
      throw new Error("INVALID_ACTIVE_SCOPE");
    }
    return {
      brandId,
      subjectId,
      objectSemanticId: OFFERING_FACTUAL_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: address.componentSemanticPath,
    };
  });
}

export function offeringBusinessStateRef(
  semanticId: string,
  reference: unknown,
): string {
  return sha256CanonicalExecution({ semantic: semanticId, reference });
}

function manifests(prepared: PreparedProcessorDependencies): Readonly<{
  evidence: readonly EvidenceManifestEntry[];
  business: readonly BusinessStateManifestEntry[];
}> {
  return {
    evidence: prepared.evidence.capabilityResults.flatMap((capability) =>
      capability.evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        capabilityId: capability.capabilityId,
        semanticId: item.evidenceRef,
        revisionIdentity: item.captureVersion,
        representativeness: item.representativeness,
        generalizationScope:
          item.boundedNormalizedPayload &&
          typeof item.boundedNormalizedPayload === "object" &&
          !Array.isArray(item.boundedNormalizedPayload)
            ? String(
                (item.boundedNormalizedPayload as Record<string, unknown>)
                  .generalization_scope ?? "",
              )
            : undefined,
        normalizedPayload: item.boundedNormalizedPayload,
        polarity: item.polarity,
        conflictGroupRef: item.conflictGroupRef,
        freshness: item.freshness.state,
        sourceClass: item.sourceClass,
      })),
    ),
    business: (prepared.canonicalState.offeringFacts ?? []).map((fact) => ({
      businessStateRef: offeringBusinessStateRef(
        fact.offeringId,
        fact.businessStateReference,
      ),
      semanticId: fact.offeringId,
      revisionIdentity: fact.businessStateReference.revisionToken,
    })),
  };
}

function readiness(output: Readonly<Record<string, unknown>>) {
  const profile =
    output.offering_factual_profile &&
    typeof output.offering_factual_profile === "object" &&
    !Array.isArray(output.offering_factual_profile)
      ? (output.offering_factual_profile as Readonly<Record<string, unknown>>)
      : undefined;
  if (!profile) return IntelligenceReadiness.NOT_READY;
  const count = OFFERING_FACTUAL_FAMILIES.filter(
    (family) => profile[family] !== null && profile[family] !== undefined,
  ).length;
  return count === OFFERING_FACTUAL_FAMILIES.length
    ? IntelligenceReadiness.READY
    : count > 0
      ? IntelligenceReadiness.PARTIAL
      : IntelligenceReadiness.NOT_READY;
}

@Injectable()
export class OfferingFactualProcessorExecutor implements ProcessorExecutor {
  readonly processorId = OFFERING_FACTUAL_PROCESSOR_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(OFFERING_FACTUAL_MODEL_PROVIDER)
    private readonly model: OfferingFactualModelProvider,
  ) {}

  async execute(context: ProcessorExecutorContext) {
    const execution = context.processorExecution;
    try {
      const subject = await this.prisma.intelligenceSubject.findUnique({
        where: { id: execution.subjectId },
      });
      if (
        !subject ||
        subject.brandId !== execution.brandId ||
        subject.subjectType !== IntelligenceSubjectType.OFFERING ||
        !subject.offeringId ||
        subject.subjectRef !== subject.offeringId
      ) {
        throw new ProcessorExecutorFailure({
          category: "CONFIGURATION_DRIFT",
          code: "EXACT_OFFERING_SUBJECT_REQUIRED",
        });
      }
      const scope = activeScope(
        execution.activeScope,
        execution.brandId,
        execution.subjectId,
      );
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
        subject: { type: "OFFERING", ref: subject.offeringId },
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
      const semanticManifests = manifests(prepared);
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: OFFERING_FACTUAL_SYSTEM_INSTRUCTION,
        outputSchema: verifiedOutputZodSchema(bundle),
        evidenceRefs: semanticManifests.evidence.map(
          (item) => item.evidenceRef,
        ),
        approvedContext: {
          subject: {
            brandRef: execution.brandId,
            offeringRef: subject.offeringId,
          },
          canonicalOffering: prepared.canonicalState.offeringFacts?.map(
            (fact) => ({
              offeringRef: fact.offeringId,
              name: fact.name,
              kind: fact.canonicalKind,
              subtype: fact.canonicalSubtype,
              lifecycle: fact.canonicalLifecycle,
              description: fact.description,
              customerDestination: fact.customerDestination,
              mediaRefs: fact.mediaRefs,
              bundleRelationships: fact.bundleRelationships,
              brandConfirmedValues: fact.brandConfirmedValues,
              businessStateRef: offeringBusinessStateRef(
                fact.offeringId,
                fact.businessStateReference,
              ),
            }),
          ),
          evidence: prepared.evidence.capabilityResults.map((capability) => ({
            capabilityId: capability.capabilityId,
            capabilityExecutionRefs:
              capability.capabilityExecutionRefs ??
              (capability.capabilityExecutionRef
                ? [capability.capabilityExecutionRef]
                : []),
            status: capability.status,
            items: capability.evidence.map((item) => ({
              evidenceRef: item.evidenceRef,
              capabilityExecutionRefs: item.capabilityExecutionRefs,
              sourceClass: item.sourceClass,
              freshness: item.freshness.state,
              polarity: item.polarity,
              conflictGroupRef: item.conflictGroupRef,
              boundedNormalizedPayload: item.boundedNormalizedPayload,
            })),
          })),
        },
      });
      await context.heartbeat();
      const liveBasis = await this.dependencies.prepare({
        brandId: execution.brandId,
        registryKey,
        activeScope: scope,
        subject: { type: "OFFERING", ref: subject.offeringId },
      });
      if (
        liveBasis.dependencyManifestHash !== execution.dependencyManifestHash ||
        liveBasis.evidenceManifestHash !== execution.evidenceManifestHash
      ) {
        throw new ProcessorExecutorFailure({
          category: "RETRYABLE_TECHNICAL",
          code: "OFFERING_INPUT_BASIS_CHANGED",
        });
      }
      const structural = this.structural.validate(bundle, generated.output);
      if (!structural.valid) {
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: `STRUCTURAL_${structural.issues[0]?.code ?? "INVALID_OUTPUT"}`,
        });
      }
      const semantic = this.semantic.validate(structural.value, {
        bundle,
        evidenceManifest: semanticManifests.evidence,
        businessStateManifest: semanticManifests.business,
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
          promptVersion: OFFERING_FACTUAL_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
          evidenceReferenceCount: semanticManifests.evidence.length,
        },
        persistencePayload: {
          kind: "OFFERING_FACTUAL_V1",
          output,
          prepared,
          offeringRef: subject.offeringId,
        } satisfies OfferingFactualPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof OfferingFactualProviderError) {
        throw new ProcessorExecutorFailure({
          category:
            error.code === "STRUCTURED_OUTPUT_INVALID"
              ? "VALIDATION_FAILURE"
              : error.retryable
                ? "RETRYABLE_TECHNICAL"
                : "CONFIGURATION_DRIFT",
          code: error.code,
        });
      }
      throw new ProcessorExecutorFailure({
        category: "CONFIGURATION_DRIFT",
        code: "OFFERING_FACTUAL_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

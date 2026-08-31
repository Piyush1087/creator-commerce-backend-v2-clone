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
import { offeringBusinessStateRef } from "../offering-factual/offering-factual-processor.executor";
import {
  OFFERING_ACTIONABILITY_MODEL_PROVIDER,
  OFFERING_CREATOR_MODEL_PROVIDER,
  OfferingDerivedProviderError,
  type OfferingDerivedModelProvider,
} from "./offering-derived-model.provider";
import {
  OFFERING_ACTIONABILITY_CONFIG,
  OFFERING_CREATOR_CONFIG,
  type OfferingDerivedPersistencePayload,
  type OfferingDerivedProcessorConfig,
} from "./offering-derived.types";

function scope(
  value: unknown,
  brandId: string,
  subjectId: string,
  config: OfferingDerivedProcessorConfig,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error("INVALID_ACTIVE_SCOPE");
  return value.map((entry) => {
    const address = entry as Record<string, unknown>;
    if (
      !entry ||
      typeof entry !== "object" ||
      address.objectSemanticId !== config.objectSemanticId ||
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
      objectSemanticId: config.objectSemanticId,
      pathSchemeVersion: 1 as const,
      componentSemanticPath: address.componentSemanticPath,
    };
  });
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
        normalizedPayload: item.boundedNormalizedPayload,
        polarity: item.polarity,
        conflictGroupRef: item.conflictGroupRef,
        freshness: item.freshness.state,
        sourceClass: item.sourceClass,
      })),
    ),
    business: [
      ...(prepared.canonicalState.offeringFacts ?? []).map((fact) => ({
        businessStateRef: offeringBusinessStateRef(
          fact.offeringId,
          fact.businessStateReference,
        ),
        semanticId: fact.offeringId,
        revisionIdentity: fact.businessStateReference.revisionToken,
      })),
      ...(prepared.intelligenceObjectDependencies ?? []).map((dependency) => ({
        businessStateRef: offeringBusinessStateRef(
          dependency.businessStateReference.entityId,
          dependency.businessStateReference,
        ),
        semanticId: dependency.objectSemanticId,
        revisionIdentity: dependency.businessStateReference.revisionToken,
      })),
    ],
  };
}

function outputReadiness(
  output: Readonly<Record<string, unknown>>,
  config: OfferingDerivedProcessorConfig,
): IntelligenceReadiness {
  const profile =
    output[config.profileField] &&
    typeof output[config.profileField] === "object" &&
    !Array.isArray(output[config.profileField])
      ? (output[config.profileField] as Readonly<Record<string, unknown>>)
      : undefined;
  if (!profile) return IntelligenceReadiness.NOT_READY;
  const count = config.families.filter(
    (family) => profile[family] !== null && profile[family] !== undefined,
  ).length;
  return count === config.families.length
    ? IntelligenceReadiness.READY
    : count > 0
      ? IntelligenceReadiness.PARTIAL
      : IntelligenceReadiness.NOT_READY;
}

abstract class OfferingDerivedProcessorExecutorBase implements ProcessorExecutor {
  abstract readonly processorId: string;
  constructor(
    private readonly config: OfferingDerivedProcessorConfig,
    private readonly prisma: PrismaService,
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    private readonly model: OfferingDerivedModelProvider,
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
      const activeScope = scope(
        execution.activeScope,
        execution.brandId,
        execution.subjectId,
        this.config,
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
        activeScope,
        subject: { type: "OFFERING", ref: subject.offeringId },
      });
      if (!prepared.dependencyEligible) {
        throw new ProcessorExecutorFailure({
          category: "DEPENDENCY_UNAVAILABLE",
          code:
            prepared.readiness.reasonCodes[0] ?? prepared.readiness.readiness,
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
      const offering = prepared.canonicalState.offeringFacts?.[0];
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        processorId: this.config.processorId,
        instruction: this.config.instruction,
        outputSchema: verifiedOutputZodSchema(bundle),
        evidenceRefs: semanticManifests.evidence.map(
          (item) => item.evidenceRef,
        ),
        approvedContext: {
          subject: {
            brandRef: execution.brandId,
            offeringRef: subject.offeringId,
          },
          canonicalOffering: offering
            ? {
                offeringRef: offering.offeringId,
                name: offering.name,
                kind: offering.canonicalKind,
                subtype: offering.canonicalSubtype,
                lifecycle: offering.canonicalLifecycle,
                customerDestination: offering.customerDestination,
                brandConfirmedValues: offering.brandConfirmedValues,
                canonicalPrice: offering.canonicalPrice,
                canonicalOffers: offering.canonicalOffers,
                availableAtLocations: offering.availableAtLocations,
                businessStateRef: offeringBusinessStateRef(
                  offering.offeringId,
                  offering.businessStateReference,
                ),
              }
            : null,
          currentIntelligence: (
            prepared.intelligenceObjectDependencies ?? []
          ).map((dependency) => ({
            objectSemanticId: dependency.objectSemanticId,
            subjectId: dependency.subjectId,
            readiness: dependency.consumerReadiness,
            value: dependency.assembledValue,
            businessStateRef: offeringBusinessStateRef(
              dependency.businessStateReference.entityId,
              dependency.businessStateReference,
            ),
          })),
          evidence: prepared.evidence.capabilityResults,
        },
      });
      await context.heartbeat();
      const live = await this.dependencies.prepare({
        brandId: execution.brandId,
        registryKey,
        activeScope,
        subject: { type: "OFFERING", ref: subject.offeringId },
      });
      if (
        live.dependencyManifestHash !== execution.dependencyManifestHash ||
        live.evidenceManifestHash !== execution.evidenceManifestHash
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
        readiness: outputReadiness(output, this.config),
        telemetry: {
          promptVersion: this.config.promptVersion,
          providerAttemptCount: generated.providerAttemptCount,
          evidenceReferenceCount: semanticManifests.evidence.length,
        },
        persistencePayload: {
          kind: this.config.payloadKind,
          output,
          prepared,
          offeringRef: subject.offeringId,
        } satisfies OfferingDerivedPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof OfferingDerivedProviderError) {
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
        code: `${this.config.processorId.toUpperCase()}_CONFIGURATION_INVALID`,
      });
    }
  }
}

@Injectable()
export class OfferingCreatorCommunicationProcessorExecutor extends OfferingDerivedProcessorExecutorBase {
  readonly processorId = OFFERING_CREATOR_CONFIG.processorId;
  constructor(
    prisma: PrismaService,
    dependencies: ProcessorDependencyPreparationService,
    contracts: ContractRuntimeRegistry,
    structural: StructuralValidator,
    semantic: SemanticValidator,
    @Inject(OFFERING_CREATOR_MODEL_PROVIDER)
    model: OfferingDerivedModelProvider,
  ) {
    super(
      OFFERING_CREATOR_CONFIG,
      prisma,
      dependencies,
      contracts,
      structural,
      semantic,
      model,
    );
  }
}

@Injectable()
export class OfferingActionabilityProcessorExecutor extends OfferingDerivedProcessorExecutorBase {
  readonly processorId = OFFERING_ACTIONABILITY_CONFIG.processorId;
  constructor(
    prisma: PrismaService,
    dependencies: ProcessorDependencyPreparationService,
    contracts: ContractRuntimeRegistry,
    structural: StructuralValidator,
    semantic: SemanticValidator,
    @Inject(OFFERING_ACTIONABILITY_MODEL_PROVIDER)
    model: OfferingDerivedModelProvider,
  ) {
    super(
      OFFERING_ACTIONABILITY_CONFIG,
      prisma,
      dependencies,
      contracts,
      structural,
      semantic,
      model,
    );
  }
}

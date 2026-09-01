import { Inject, Injectable } from "@nestjs/common";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
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
import {
  serviceabilityBusinessEntries,
  serviceabilityBusinessRef,
  validateServiceabilityCanonicalBoundary,
} from "./serviceability-business-refs";
import {
  serviceabilityScope,
  validateServiceabilityIdentity,
} from "./serviceability-identity";
import {
  SERVICEABILITY_MODEL_PROVIDER,
  ServiceabilityProviderError,
  type ServiceabilityModelProvider,
} from "./serviceability-model.provider";
import { serviceabilityOutputReadiness } from "./serviceability-plan";
import {
  SERVICEABILITY_PROMPT_VERSION,
  SERVICEABILITY_SYSTEM_INSTRUCTION,
} from "./serviceability-prompt";
import { ServiceabilityStateRepository } from "./serviceability-state.repository";
import type {
  ServiceabilityOutput,
  ServiceabilityPersistencePayload,
} from "./serviceability.types";

function businessManifest(prepared: PreparedProcessorDependencies) {
  return serviceabilityBusinessEntries(prepared.canonicalState).map(
    (entry) => ({
      businessStateRef: serviceabilityBusinessRef(
        entry.semantic,
        entry.businessStateReference,
      ),
      semanticId: entry.semantic,
      revisionIdentity: entry.businessStateReference.revisionToken,
    }),
  );
}
@Injectable()
export class ServiceabilityProcessorExecutor implements ProcessorExecutor {
  readonly processorId = "serviceability_synthesis";
  constructor(
    private readonly dependencies: ProcessorDependencyPreparationService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly state: ServiceabilityStateRepository,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
    @Inject(SERVICEABILITY_MODEL_PROVIDER)
    private readonly model: ServiceabilityModelProvider,
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
        activeScope: serviceabilityScope(
          execution.activeScope,
          execution.brandId,
        ),
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
        prepared.evidence.capabilityResults.some((capability) =>
          capability.evidence.some(
            (item) => item.brandId !== execution.brandId,
          ),
        )
      )
        throw new ProcessorExecutorFailure({
          category: "VALIDATION_FAILURE",
          code: "SERVICEABILITY_CROSS_BRAND_INPUT",
        });
      validateServiceabilityCanonicalBoundary(
        prepared.canonicalState,
        execution.brandId,
      );
      const current = await this.state.read(execution.brandId);
      const business = businessManifest(prepared);
      const evidence = prepared.evidence.capabilityResults.flatMap(
        (capability) =>
          capability.evidence.map((item) => ({
            evidenceRef: item.evidenceRef,
            capabilityId: capability.capabilityId,
            semanticId: item.evidenceRef,
            revisionIdentity: item.captureVersion,
            representativeness: item.representativeness,
            normalizedPayload:
              item.acquisitionQuality.state !== "UNAVAILABLE" &&
              !["UNAVAILABLE", "NOT_REQUESTED"].includes(capability.status)
                ? item.boundedNormalizedPayload
                : undefined,
            polarity: item.polarity,
            conflictGroupRef: item.conflictGroupRef,
            freshness: item.freshness.state,
            sourceClass: item.sourceClass,
          })),
      );
      const state = prepared.canonicalState.serviceabilityState!;
      const refFor = (semantic: string) =>
        business.find((entry) => entry.semanticId === semantic)!
          .businessStateRef;
      await context.heartbeat();
      const generated = await this.model.generate({
        processorExecutionId: execution.id,
        instruction: SERVICEABILITY_SYSTEM_INSTRUCTION,
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
          canonicalBrandContext: prepared.canonicalState.entries.map(
            (entry) => ({
              semantic: entry.semantic,
              value: entry.value,
              authority: entry.authority,
              businessStateRef: refFor(entry.semantic),
            }),
          ),
          canonicalLocations: state.locations.map((item) => ({
            locationId: item.locationId,
            name: item.name,
            city: item.city,
            authority: item.authority,
            businessStateRef: refFor(`location:${item.locationId}`),
            referenceOnly: true,
            establishesAvailabilityAlone: false,
          })),
          canonicalOfferingIdentities: state.offeringIdentities.map((item) => ({
            offeringId: item.offeringId,
            name: item.name,
            type: item.type,
            businessStateRef: refFor(`offering:${item.offeringId}:identity`),
            referenceOnly: true,
            availabilityAvailable: false,
          })),
          canonicalOfferingAvailability: [],
          authoritativeOfferingLocationRelationships: [],
          evidence: prepared.evidence.capabilityResults.map((capability) => ({
            capabilityId: capability.capabilityId,
            status: capability.status,
            coverage: capability.coverage,
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
      const output = semantic.value as ServiceabilityOutput;
      validateServiceabilityIdentity(output, current);
      return {
        readiness: serviceabilityOutputReadiness(output),
        telemetry: {
          promptVersion: SERVICEABILITY_PROMPT_VERSION,
          providerAttemptCount: generated.providerAttemptCount,
        },
        persistencePayload: {
          kind: "SERVICEABILITY_V1",
          current,
          output,
          prepared,
        } satisfies ServiceabilityPersistencePayload,
      };
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof ServiceabilityProviderError)
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
        code: "SERVICEABILITY_EXECUTOR_CONFIGURATION_INVALID",
      });
    }
  }
}

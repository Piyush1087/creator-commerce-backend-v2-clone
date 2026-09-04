import { forwardRef, Module } from "@nestjs/common";
import { ServiceabilityProcessorExecutor } from "./processors/serviceability/serviceability-processor.executor";
import { ServiceabilityPersistenceHook } from "./processors/serviceability/serviceability-persistence.hook";
import { ServiceabilityStateRepository } from "./processors/serviceability/serviceability-state.repository";
import {
  SERVICEABILITY_MODEL_PROVIDER,
  StructuredServiceabilityModelProvider,
} from "./processors/serviceability/serviceability-model.provider";
import { BrandCanonicalStateModule } from "../brand-canonical-state/brand-canonical-state.module";
import { VisualStyleProcessorExecutor } from "./processors/visual-style/visual-style-processor.executor";
import { VisualStylePersistenceHook } from "./processors/visual-style/visual-style-persistence.hook";
import { VisualStyleStateRepository } from "./processors/visual-style/visual-style-state.repository";
import {
  VISUAL_STYLE_MODEL_PROVIDER,
  StructuredVisualStyleModelProvider,
} from "./processors/visual-style/visual-style-model.provider";
import { BrandDifferentiationProcessorExecutor } from "./processors/brand-differentiation/brand-differentiation-processor.executor";
import { BrandDifferentiationPersistenceHook } from "./processors/brand-differentiation/brand-differentiation-persistence.hook";
import { BrandDifferentiationStateRepository } from "./processors/brand-differentiation/brand-differentiation-state.repository";
import {
  BRAND_DIFFERENTIATION_MODEL_PROVIDER,
  StructuredBrandDifferentiationModelProvider,
} from "./processors/brand-differentiation/brand-differentiation-model.provider";
import { AudiencePersonaProcessorExecutor } from "./processors/audience-persona/audience-persona-processor.executor";
import { AudiencePersonaPersistenceHook } from "./processors/audience-persona/audience-persona-persistence.hook";
import { AudiencePersonaStateRepository } from "./processors/audience-persona/audience-persona-state.repository";
import {
  AUDIENCE_PERSONA_MODEL_PROVIDER,
  StructuredAudiencePersonaModelProvider,
} from "./processors/audience-persona/audience-persona-model.provider";

import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DataExtractionIntelligenceEvidenceAdapter } from "../data-extraction/evidence/intelligence/data-extraction-intelligence-evidence.adapter";
import { ContractBundleIntegrityVerifier } from "./contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "./contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "./contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "./contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "./contracts/validation/semantic.validator";
import { StructuralValidator } from "./contracts/validation/structural.validator";
import { ExecutionAggregationService } from "./execution/execution-aggregation.service";
import { IntelligenceExecutionService } from "./execution/intelligence-execution.service";
import { ProcessorExecutionRepository } from "./execution/processor-execution.repository";
import { ProcessorFinalizationService } from "./execution/processor-finalization.service";
import { PROCESSOR_SUCCESS_PERSISTENCE_HOOK } from "./execution/processor-persistence.hook";
import { ProcessorWorkerService } from "./execution/processor-worker.service";
import { ProcessorExecutorRegistry } from "./execution/executor/processor-executor.registry";
import { SyntheticProcessorExecutor } from "./execution/executor/synthetic-processor.executor";
import { RetryBackoffPolicy } from "./execution/policy/retry-backoff.policy";
import { ExecutionContractGate } from "./execution/registry/execution-contract.gate";
import { CANONICAL_BRAND_STATE_READER } from "./input/canonical-state/canonical-brand-state.port";
import { CanonicalStateManifestBuilder } from "./input/canonical-state/canonical-state-manifest";
import { M1CanonicalBrandStateAdapter } from "./input/canonical-state/m1-canonical-brand-state.adapter";
import { ProcessorDependencyPreparationService } from "./input/dependency/processor-dependency-preparation.service";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "./input/dependency/processor-dependency-readiness.evaluator";
import { EvidenceManifestBuilder } from "./input/evidence/evidence-manifest";
import { INTELLIGENCE_EVIDENCE_READER } from "./input/evidence/intelligence-evidence.port";
import { MissingDataExtractionEvidenceAdapter } from "./input/evidence/missing-data-extraction-evidence.adapter";
import { IntelligenceActionRepository } from "./persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "./persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "./persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "./persistence/intelligence-generation.repository";
import { IntelligenceCurrentContractScopeService } from "./projection/intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionRepository } from "./projection/intelligence-current-projection.repository";
import { IntelligenceCurrentProjectionService } from "./projection/intelligence-current-projection.service";
import { IntelligenceObjectAssembler } from "./projection/intelligence-object-assembler";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "./transitions/intelligence-transition.service";
import {
  BRAND_COMMUNICATION_MODEL_PROVIDER,
  StructuredBrandCommunicationModelProvider,
} from "./processors/brand-communication/brand-communication-model.provider";
import { BrandCommunicationPersistenceHook } from "./processors/brand-communication/brand-communication-persistence.hook";
import { BrandCommunicationProcessorExecutor } from "./processors/brand-communication/brand-communication-processor.executor";
import { BrandMeaningProcessorExecutor } from "./processors/brand-meaning/brand-meaning-processor.executor";
import { BrandMeaningPersistenceHook } from "./processors/brand-meaning/brand-meaning-persistence.hook";
import {
  BRAND_MEANING_MODEL_PROVIDER,
  StructuredBrandMeaningModelProvider,
} from "./processors/brand-meaning/brand-meaning-model.provider";
import { ProcessorPersistenceRouter } from "./execution/processor-persistence.router";
import { BrandCharacterProcessorExecutor } from "./processors/brand-character/brand-character-processor.executor";
import { BrandCharacterPersistenceHook } from "./processors/brand-character/brand-character-persistence.hook";
import { BrandCharacterStateRepository } from "./processors/brand-character/brand-character-state.repository";
import {
  BRAND_CHARACTER_MODEL_PROVIDER,
  StructuredBrandCharacterModelProvider,
} from "./processors/brand-character/brand-character-model.provider";
import { OfferingFactualProcessorExecutor } from "./processors/offering-factual/offering-factual-processor.executor";
import { OfferingFactualPersistenceHook } from "./processors/offering-factual/offering-factual-persistence.hook";
import {
  OFFERING_FACTUAL_MODEL_PROVIDER,
  StructuredOfferingFactualModelProvider,
} from "./processors/offering-factual/offering-factual-model.provider";
import {
  OfferingActionabilityProcessorExecutor,
  OfferingCreatorCommunicationProcessorExecutor,
} from "./processors/offering-derived/offering-derived-processor.executor";
import {
  OFFERING_ACTIONABILITY_MODEL_PROVIDER,
  OFFERING_CREATOR_MODEL_PROVIDER,
  StructuredOfferingActionabilityModelProvider,
  StructuredOfferingCreatorModelProvider,
} from "./processors/offering-derived/offering-derived-model.provider";

const internalProviders = [
  ServiceabilityProcessorExecutor,
  ServiceabilityPersistenceHook,
  ServiceabilityStateRepository,
  {
    provide: SERVICEABILITY_MODEL_PROVIDER,
    useClass: StructuredServiceabilityModelProvider,
  },
  VisualStyleProcessorExecutor,
  VisualStylePersistenceHook,
  VisualStyleStateRepository,
  {
    provide: VISUAL_STYLE_MODEL_PROVIDER,
    useClass: StructuredVisualStyleModelProvider,
  },
  BrandDifferentiationProcessorExecutor,
  BrandDifferentiationPersistenceHook,
  BrandDifferentiationStateRepository,
  {
    provide: BRAND_DIFFERENTIATION_MODEL_PROVIDER,
    useClass: StructuredBrandDifferentiationModelProvider,
  },
  AudiencePersonaProcessorExecutor,
  AudiencePersonaPersistenceHook,
  AudiencePersonaStateRepository,
  {
    provide: AUDIENCE_PERSONA_MODEL_PROVIDER,
    useClass: StructuredAudiencePersonaModelProvider,
  },
  ComponentPathCodec,
  ContractBundleIntegrityVerifier,
  StructuralValidator,
  SemanticValidator,
  ContractRuntimeRegistry,
  BundlePathOwnershipRegistry,
  PersistenceTransitionValidator,
  RetryBackoffPolicy,
  ExecutionAggregationService,
  SyntheticProcessorExecutor,
  BrandCommunicationProcessorExecutor,
  BrandMeaningProcessorExecutor,
  BrandCharacterProcessorExecutor,
  BrandCharacterPersistenceHook,
  BrandCharacterStateRepository,
  OfferingFactualProcessorExecutor,
  OfferingFactualPersistenceHook,
  OfferingCreatorCommunicationProcessorExecutor,
  OfferingActionabilityProcessorExecutor,
  {
    provide: OFFERING_FACTUAL_MODEL_PROVIDER,
    useClass: StructuredOfferingFactualModelProvider,
  },
  {
    provide: OFFERING_CREATOR_MODEL_PROVIDER,
    useClass: StructuredOfferingCreatorModelProvider,
  },
  {
    provide: OFFERING_ACTIONABILITY_MODEL_PROVIDER,
    useClass: StructuredOfferingActionabilityModelProvider,
  },
  BrandCommunicationPersistenceHook,
  BrandMeaningPersistenceHook,
  ProcessorExecutorRegistry,
  ExecutionContractGate,
  IntelligenceExecutionService,
  ProcessorExecutionRepository,
  ProcessorFinalizationService,
  ProcessorWorkerService,
  CanonicalStateManifestBuilder,
  EvidenceManifestBuilder,
  ProcessorDependencyProfileRegistry,
  ProcessorDependencyReadinessEvaluator,
  ProcessorDependencyPreparationService,
  MissingDataExtractionEvidenceAdapter,
  {
    provide: CANONICAL_BRAND_STATE_READER,
    useClass: M1CanonicalBrandStateAdapter,
  },
  {
    provide: INTELLIGENCE_EVIDENCE_READER,
    useExisting: DataExtractionIntelligenceEvidenceAdapter,
  },
  {
    provide: PROCESSOR_SUCCESS_PERSISTENCE_HOOK,
    useClass: ProcessorPersistenceRouter,
  },
  {
    provide: BRAND_COMMUNICATION_MODEL_PROVIDER,
    useClass: StructuredBrandCommunicationModelProvider,
  },
  {
    provide: BRAND_MEANING_MODEL_PROVIDER,
    useClass: StructuredBrandMeaningModelProvider,
  },
  IntelligenceGenerationRepository,
  {
    provide: BRAND_CHARACTER_MODEL_PROVIDER,
    useClass: StructuredBrandCharacterModelProvider,
  },
  IntelligenceCurrentStateRepository,
  IntelligenceCandidateRepository,
  IntelligenceActionRepository,
  IntelligenceTransitionService,
  IntelligenceCurrentProjectionRepository,
  IntelligenceCurrentContractScopeService,
  IntelligenceObjectAssembler,
  IntelligenceCurrentProjectionService,
];

@Module({
  imports: [
    DataExtractionModule,
    BrandCanonicalStateModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: internalProviders,
  exports: internalProviders,
})
export class BrandIntelligenceModule {}

import { Module } from "@nestjs/common";

import { DataExtractionModule } from "../data-extraction/data-extraction.module";
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

const internalProviders = [
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
  imports: [DataExtractionModule],
  providers: internalProviders,
  exports: internalProviders,
})
export class BrandIntelligenceModule {}

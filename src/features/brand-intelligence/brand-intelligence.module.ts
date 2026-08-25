import { Module } from "@nestjs/common";

import { ContractBundleIntegrityVerifier } from "./contracts/bundle/contract-bundle.integrity";
import { BundlePathOwnershipRegistry } from "./contracts/registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "./contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "./contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "./contracts/validation/semantic.validator";
import { StructuralValidator } from "./contracts/validation/structural.validator";
import { IntelligenceActionRepository } from "./persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "./persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "./persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "./persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "./transitions/intelligence-transition.service";

const internalProviders = [
  ComponentPathCodec,
  ContractBundleIntegrityVerifier,
  StructuralValidator,
  SemanticValidator,
  ContractRuntimeRegistry,
  BundlePathOwnershipRegistry,
  PersistenceTransitionValidator,
  IntelligenceGenerationRepository,
  IntelligenceCurrentStateRepository,
  IntelligenceCandidateRepository,
  IntelligenceActionRepository,
  IntelligenceTransitionService,
];

@Module({
  providers: internalProviders,
  exports: internalProviders,
})
export class BrandIntelligenceModule {}

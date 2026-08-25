import { Module } from "@nestjs/common";

import { IntelligenceActionRepository } from "./persistence/intelligence-action.repository";
import { IntelligenceCandidateRepository } from "./persistence/intelligence-candidate.repository";
import { IntelligenceCurrentStateRepository } from "./persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "./persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { IntelligenceTransitionService } from "./transitions/intelligence-transition.service";

const internalProviders = [
  ComponentPathCodec,
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

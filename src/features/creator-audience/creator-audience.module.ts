import { Module } from "@nestjs/common";

import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { InstagramIntelligenceProviderModule } from "../instagram/instagram-intelligence-provider.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { CreatorAudienceController } from "./creator-audience.controller";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import { CreatorAudiencePipelineService } from "./creator-audience-pipeline.service";
import { CreatorAudienceRepository } from "./creator-audience.repository";
import { CreatorAudienceService } from "./creator-audience.service";
import { AudienceV1ConsumerService } from "../creator-audience-v1/creator-audience-v1.consumer.service";

@Module({
  imports: [
    CreatorTeamModule,
    InstagramIntelligenceProviderModule,
    BrandIntelligenceModule,
  ],
  controllers: [CreatorAudienceController],
  providers: [
    IntelligenceOwnerScopeRepository,
    CreatorAudienceCredentialFenceService,
    CreatorAudienceRepository,
    CreatorAudiencePipelineService,
    CreatorAudienceService,
    AudienceV1ConsumerService,
  ],
  exports: [
    CreatorAudienceCredentialFenceService,
    CreatorAudiencePipelineService,
    CreatorAudienceRepository,
    AudienceV1ConsumerService,
  ],
})
export class CreatorAudienceModule {}

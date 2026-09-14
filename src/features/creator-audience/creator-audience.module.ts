import { Module } from "@nestjs/common";

import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { CreatorAudienceController } from "./creator-audience.controller";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";
import { CreatorAudiencePipelineService } from "./creator-audience-pipeline.service";
import { CreatorAudienceRepository } from "./creator-audience.repository";
import { CreatorAudienceService } from "./creator-audience.service";

@Module({
  imports: [
    CreatorTeamModule,
    InstagramProviderClientModule,
    BrandIntelligenceModule,
  ],
  controllers: [CreatorAudienceController],
  providers: [
    IntelligenceOwnerScopeRepository,
    CreatorAudienceCredentialFenceService,
    CreatorAudienceRepository,
    CreatorAudiencePipelineService,
    CreatorAudienceService,
  ],
  exports: [
    CreatorAudienceCredentialFenceService,
    CreatorAudiencePipelineService,
    CreatorAudienceRepository,
  ],
})
export class CreatorAudienceModule {}

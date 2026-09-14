import { Module } from "@nestjs/common";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { CreatorAudienceModule } from "../creator-audience/creator-audience.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { CreatorContentController } from "./creator-content.controller";
import { CreatorContentPipelineService } from "./creator-content-pipeline.service";
import { CreatorContentRepository } from "./creator-content.repository";
import {
  CREATOR_CONTENT_SEMANTIC_ANALYZER,
  MissingCreatorContentSemanticAnalyzer,
} from "./creator-content-semantic.port";
import { CreatorContentService } from "./creator-content.service";

@Module({
  imports: [
    CreatorTeamModule,
    CreatorAudienceModule,
    InstagramProviderClientModule,
    BrandIntelligenceModule,
  ],
  controllers: [CreatorContentController],
  providers: [
    IntelligenceOwnerScopeRepository,
    CreatorContentRepository,
    CreatorContentPipelineService,
    CreatorContentService,
    {
      provide: CREATOR_CONTENT_SEMANTIC_ANALYZER,
      useClass: MissingCreatorContentSemanticAnalyzer,
    },
  ],
  exports: [CreatorContentPipelineService, CreatorContentRepository],
})
export class CreatorContentModule {}

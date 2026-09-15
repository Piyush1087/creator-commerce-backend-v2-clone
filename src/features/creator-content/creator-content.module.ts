import { Module } from "@nestjs/common";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { CreatorAudienceModule } from "../creator-audience/creator-audience.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { IntelligenceOwnerScopeRepository } from "../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { CreatorContentController } from "./creator-content.controller";
import { CreatorContentPipelineService } from "./creator-content-pipeline.service";
import { CreatorContentRepository } from "./creator-content.repository";
import { CREATOR_CONTENT_SEMANTIC_ANALYZER } from "./creator-content-semantic.port";
import {
  CreatorContentMultimodalService,
  CreatorContentGroundedModelPort,
  UnavailableCreatorContentGroundedModel,
} from "./creator-content-multimodal.service";
import {
  InstagramB3aVisualModelPort,
  UnavailableInstagramB3aVisualModelAdapter,
} from "../instagram-intelligence/media/instagram-b3a-visual-observation";
import {
  InstagramW1VideoFrameModelPort,
  UnavailableInstagramW1VideoFrameModelAdapter,
} from "../instagram-intelligence/media/instagram-w1-video-frame-observation";
import {
  InstagramVisualTextModelPort,
  UnavailableInstagramVisualTextModelAdapter,
} from "../instagram/media/instagram-visual-text";
import {
  InstagramSpeechTranscriptionPort,
  UnavailableInstagramSpeechTranscriptionAdapter,
} from "../instagram/media/video/instagram-speech";
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
    CreatorContentMultimodalService,
    {
      provide: InstagramB3aVisualModelPort,
      useClass: UnavailableInstagramB3aVisualModelAdapter,
    },
    {
      provide: InstagramW1VideoFrameModelPort,
      useClass: UnavailableInstagramW1VideoFrameModelAdapter,
    },
    {
      provide: InstagramVisualTextModelPort,
      useClass: UnavailableInstagramVisualTextModelAdapter,
    },
    {
      provide: InstagramSpeechTranscriptionPort,
      useClass: UnavailableInstagramSpeechTranscriptionAdapter,
    },
    {
      provide: CreatorContentGroundedModelPort,
      useClass: UnavailableCreatorContentGroundedModel,
    },
    {
      provide: CREATOR_CONTENT_SEMANTIC_ANALYZER,
      useExisting: CreatorContentMultimodalService,
    },
  ],
  exports: [CreatorContentPipelineService, CreatorContentRepository],
})
export class CreatorContentModule {}

import { Module } from "@nestjs/common";

import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { InstagramB3aImagePipelineService } from "./media/instagram-b3a-image-pipeline.service";
import { InstagramB3bMediaCompletionService } from "./media/instagram-b3b-media-completion.service";
import {
  InstagramB3aVisualModelPort,
  UnavailableInstagramB3aVisualModelAdapter,
} from "./media/instagram-b3a-visual-observation";
import { InstagramB4ConsumerController } from "./consumer/instagram-b4-consumer.controller";
import { InstagramB4ConsumerService } from "./consumer/instagram-b4-consumer.service";
import { InstagramContentBehaviorRuntimeService } from "./runtime/instagram-content-behavior.runtime.service";
import { InstagramC4RuntimeService } from "./runtime/instagram-c4.runtime.service";
import { InstagramC2FoundationsService } from "./foundations/instagram-c2-foundations.service";
import {
  InstagramC3SemanticModelPort,
  StructuredInstagramC3SemanticModelAdapter,
} from "./semantics/instagram-c3-semantic-model";
import { InstagramC3SemanticsService } from "./semantics/instagram-c3-semantics.service";
import { InstagramSyncController } from "./sync/instagram-sync.controller";
import { InstagramSyncDispatcherService } from "./sync/instagram-sync-dispatcher.service";
import { InstagramSyncPipelineAdapter } from "./sync/instagram-sync-pipeline.adapter";
import { InstagramSyncPipelinePort } from "./sync/instagram-sync-pipeline.port";
import { InstagramHiddenBrandRuntime } from "./hidden-brand/instagram-hidden-brand.runtime";
import { InstagramHiddenBrandReader } from "./hidden-brand/instagram-hidden-brand.reader";
import { InstagramW1VideoPipelineService } from "./media/instagram-w1-video-pipeline.service";
import {
  InstagramW1VideoFrameModelPort,
  UnavailableInstagramW1VideoFrameModelAdapter,
} from "./media/instagram-w1-video-frame-observation";

@Module({
  imports: [
    BrandSettingsConsumerModule,
    BrandCentreModule,
    BrandIntelligenceModule,
    DataExtractionModule,
    InstagramProviderClientModule,
  ],
  controllers: [InstagramB4ConsumerController, InstagramSyncController],
  providers: [
    InstagramB3aImagePipelineService,
    InstagramB3bMediaCompletionService,
    InstagramW1VideoPipelineService,
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
    InstagramC4RuntimeService,
    InstagramC2FoundationsService,
    InstagramC3SemanticsService,
    InstagramSyncDispatcherService,
    InstagramHiddenBrandRuntime,
    InstagramHiddenBrandReader,
    {
      provide: InstagramSyncPipelinePort,
      useClass: InstagramSyncPipelineAdapter,
    },
    {
      provide: InstagramB3aVisualModelPort,
      useClass: UnavailableInstagramB3aVisualModelAdapter,
    },
    {
      provide: InstagramC3SemanticModelPort,
      useClass: StructuredInstagramC3SemanticModelAdapter,
    },
    {
      provide: InstagramW1VideoFrameModelPort,
      useClass: UnavailableInstagramW1VideoFrameModelAdapter,
    },
  ],
  exports: [
    InstagramB3aImagePipelineService,
    InstagramB3bMediaCompletionService,
    InstagramW1VideoPipelineService,
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
    InstagramC4RuntimeService,
    InstagramC2FoundationsService,
    InstagramC3SemanticsService,
    InstagramHiddenBrandReader,
  ],
})
export class InstagramIntelligenceModule {}

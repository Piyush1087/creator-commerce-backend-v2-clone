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

@Module({
  imports: [
    BrandSettingsConsumerModule,
    BrandCentreModule,
    BrandIntelligenceModule,
    DataExtractionModule,
    InstagramProviderClientModule,
  ],
  controllers: [InstagramB4ConsumerController],
  providers: [
    InstagramB3aImagePipelineService,
    InstagramB3bMediaCompletionService,
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
    InstagramC4RuntimeService,
    InstagramC2FoundationsService,
    InstagramC3SemanticsService,
    {
      provide: InstagramB3aVisualModelPort,
      useClass: UnavailableInstagramB3aVisualModelAdapter,
    },
    {
      provide: InstagramC3SemanticModelPort,
      useClass: StructuredInstagramC3SemanticModelAdapter,
    },
  ],
  exports: [
    InstagramB3aImagePipelineService,
    InstagramB3bMediaCompletionService,
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
    InstagramC4RuntimeService,
    InstagramC2FoundationsService,
    InstagramC3SemanticsService,
  ],
})
export class InstagramIntelligenceModule {}

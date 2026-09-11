import { Module } from "@nestjs/common";

import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { InstagramB3aImagePipelineService } from "./media/instagram-b3a-image-pipeline.service";
import {
  InstagramB3aVisualModelPort,
  UnavailableInstagramB3aVisualModelAdapter,
} from "./media/instagram-b3a-visual-observation";
import { InstagramB4ConsumerController } from "./consumer/instagram-b4-consumer.controller";
import { InstagramB4ConsumerService } from "./consumer/instagram-b4-consumer.service";
import { InstagramContentBehaviorRuntimeService } from "./runtime/instagram-content-behavior.runtime.service";

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
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
    {
      provide: InstagramB3aVisualModelPort,
      useClass: UnavailableInstagramB3aVisualModelAdapter,
    },
  ],
  exports: [
    InstagramB3aImagePipelineService,
    InstagramB4ConsumerService,
    InstagramContentBehaviorRuntimeService,
  ],
})
export class InstagramIntelligenceModule {}

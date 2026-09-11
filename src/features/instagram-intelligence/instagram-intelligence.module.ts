import { Module } from "@nestjs/common";

import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { DataExtractionModule } from "../data-extraction/data-extraction.module";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { InstagramB3aImagePipelineService } from "./media/instagram-b3a-image-pipeline.service";
import {
  InstagramB3aVisualModelPort,
  UnavailableInstagramB3aVisualModelAdapter,
} from "./media/instagram-b3a-visual-observation";

@Module({
  imports: [
    BrandSettingsConsumerModule,
    DataExtractionModule,
    InstagramProviderClientModule,
  ],
  providers: [
    InstagramB3aImagePipelineService,
    {
      provide: InstagramB3aVisualModelPort,
      useClass: UnavailableInstagramB3aVisualModelAdapter,
    },
  ],
  exports: [InstagramB3aImagePipelineService],
})
export class InstagramIntelligenceModule {}

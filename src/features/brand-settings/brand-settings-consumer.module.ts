import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import {
  InstagramIntelligenceAuthorizedReadService,
  InstagramIntelligenceConnectionReadService,
} from "./services/instagram-intelligence-provider-read.service";
import { BrandProviderReadinessService } from "./services/brand-provider-readiness.service";
import { BrandSettingsAccessService } from "./services/brand-settings-access.service";
import { InstagramIntelligenceAuthorizedImageAcquisitionService } from "./services/instagram-intelligence-image-acquisition.service";

@Module({
  imports: [PrismaModule, BrandCentreModule, InstagramProviderClientModule],
  providers: [
    BrandSettingsAccessService,
    BrandProviderReadinessService,
    InstagramIntelligenceConnectionReadService,
    InstagramIntelligenceAuthorizedReadService,
    InstagramIntelligenceAuthorizedImageAcquisitionService,
  ],
  exports: [
    BrandProviderReadinessService,
    InstagramIntelligenceConnectionReadService,
    InstagramIntelligenceAuthorizedReadService,
    InstagramIntelligenceAuthorizedImageAcquisitionService,
  ],
})
export class BrandSettingsConsumerModule {}

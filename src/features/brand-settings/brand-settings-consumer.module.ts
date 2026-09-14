import { forwardRef, Module } from "@nestjs/common";

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
import { InstagramSyncCoordinatorModule } from "../instagram-intelligence/sync/instagram-sync-coordinator.module";
import { InstagramIntelligenceAuthorizedVideoAcquisitionService } from "./services/instagram-intelligence-video-acquisition.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BrandCentreModule),
    InstagramProviderClientModule,
    InstagramSyncCoordinatorModule,
  ],
  providers: [
    BrandSettingsAccessService,
    BrandProviderReadinessService,
    InstagramIntelligenceConnectionReadService,
    InstagramIntelligenceAuthorizedReadService,
    InstagramIntelligenceAuthorizedImageAcquisitionService,
    InstagramIntelligenceAuthorizedVideoAcquisitionService,
  ],
  exports: [
    BrandProviderReadinessService,
    InstagramIntelligenceConnectionReadService,
    InstagramIntelligenceAuthorizedReadService,
    InstagramIntelligenceAuthorizedImageAcquisitionService,
    InstagramIntelligenceAuthorizedVideoAcquisitionService,
    InstagramSyncCoordinatorModule,
    BrandSettingsAccessService,
  ],
})
export class BrandSettingsConsumerModule {}

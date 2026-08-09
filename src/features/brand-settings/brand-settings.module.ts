import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { InstagramModule } from "../instagram/instagram.module";
import { BrandSettingsController } from "./brand-settings.controller";
import { BrandIntegrationTokenExpiryScheduler } from "./schedulers/brand-integration-token-expiry.scheduler";
import { BrandSettingsAccessService } from "./services/brand-settings-access.service";
import { BrandSettingsIntegrationsService } from "./services/brand-settings-integrations.service";
import { BrandSettingsService } from "./services/brand-settings.service";

@Module({
  imports: [BrandCentreModule, InstagramModule],
  controllers: [BrandSettingsController],
  providers: [
    BrandSettingsAccessService,
    BrandSettingsService,
    BrandSettingsIntegrationsService,
    BrandIntegrationTokenExpiryScheduler,
  ],
  exports: [
    BrandSettingsService,
    BrandSettingsAccessService,
    BrandSettingsIntegrationsService,
  ],
})
export class BrandSettingsModule {}

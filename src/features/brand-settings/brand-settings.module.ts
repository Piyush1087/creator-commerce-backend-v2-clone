import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandSettingsController } from "./brand-settings.controller";
import { BrandSettingsAccessService } from "./services/brand-settings-access.service";
import { BrandSettingsService } from "./services/brand-settings.service";

@Module({
  imports: [BrandCentreModule],
  controllers: [BrandSettingsController],
  providers: [BrandSettingsAccessService, BrandSettingsService],
  exports: [BrandSettingsService, BrandSettingsAccessService],
})
export class BrandSettingsModule {}

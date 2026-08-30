import { Module } from "@nestjs/common";

import { CreatorSettingsController } from "./creator-settings.controller";
import { CreatorSettingsAccessService } from "./services/creator-settings-access.service";
import { CreatorSettingsService } from "./services/creator-settings.service";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";

@Module({
  imports: [BrandEscrowModule],
  controllers: [CreatorSettingsController],
  providers: [CreatorSettingsAccessService, CreatorSettingsService],
  exports: [CreatorSettingsService, CreatorSettingsAccessService],
})
export class CreatorSettingsModule {}

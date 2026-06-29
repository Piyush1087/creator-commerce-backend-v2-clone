import { Module } from "@nestjs/common";

import { CreatorSettingsController } from "./creator-settings.controller";
import { CreatorSettingsAccessService } from "./services/creator-settings-access.service";
import { CreatorSettingsService } from "./services/creator-settings.service";

@Module({
  controllers: [CreatorSettingsController],
  providers: [CreatorSettingsAccessService, CreatorSettingsService],
  exports: [CreatorSettingsService, CreatorSettingsAccessService],
})
export class CreatorSettingsModule {}

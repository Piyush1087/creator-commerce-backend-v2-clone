import { Module } from "@nestjs/common";

import { CreatorSettingsController } from "./creator-settings.controller";
import { CreatorSettingsAccessService } from "./services/creator-settings-access.service";
import { CreatorSettingsService } from "./services/creator-settings.service";
import { CreatorPayoutProfileModule } from "../brand-escrow/creator-payout-profile.module";

@Module({
  imports: [CreatorPayoutProfileModule],
  controllers: [CreatorSettingsController],
  providers: [CreatorSettingsAccessService, CreatorSettingsService],
  exports: [CreatorSettingsService, CreatorSettingsAccessService],
})
export class CreatorSettingsModule {}

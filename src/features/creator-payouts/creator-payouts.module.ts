import { Module } from "@nestjs/common";

import { CreatorPayoutsController } from "./creator-payouts.controller";
import { CreatorPayoutsService } from "./services/creator-payouts.service";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";

@Module({
  imports: [CreatorEntryModule],
  controllers: [CreatorPayoutsController],
  providers: [CreatorPayoutsService],
})
export class CreatorPayoutsModule {}

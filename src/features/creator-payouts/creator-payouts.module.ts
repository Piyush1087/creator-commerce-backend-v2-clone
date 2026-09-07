import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";
import { CreatorPayoutsController } from "./creator-payouts.controller";
import { CreatorPayoutsService } from "./services/creator-payouts.service";

@Module({
  imports: [AuthModule, CreatorEntryModule],
  controllers: [CreatorPayoutsController],
  providers: [CreatorPayoutsService],
})
export class CreatorPayoutsModule {}

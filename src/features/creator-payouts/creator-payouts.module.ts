import { Module } from "@nestjs/common";

import { CreatorPayoutsController } from "./creator-payouts.controller";
import { CreatorPayoutsService } from "./services/creator-payouts.service";

@Module({
  controllers: [CreatorPayoutsController],
  providers: [CreatorPayoutsService],
})
export class CreatorPayoutsModule {}

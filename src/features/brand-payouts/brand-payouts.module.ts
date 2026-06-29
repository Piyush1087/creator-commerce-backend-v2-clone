import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandPayoutsController } from "./brand-payouts.controller";
import { BrandPayoutsService } from "./services/brand-payouts.service";

@Module({
  imports: [BrandCentreModule],
  controllers: [BrandPayoutsController],
  providers: [BrandPayoutsService],
})
export class BrandPayoutsModule {}

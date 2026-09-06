import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandPayoutsController } from "./brand-payouts.controller";
import { BRAND_PAYOUTS_QUERY_PORT_V2 } from "./ports/brand-payouts-read.port";
import { BrandPayoutsAuthorizationService } from "./services/brand-payouts-authorization.service";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";
import { BrandPayoutsReadEnvironmentService } from "./services/brand-payouts-read-environment.service";
import { BrandPayoutsService } from "./services/brand-payouts.service";
import { FinancialActivityProjectionService } from "./services/financial-activity-projection.service";
import { PayoutObligationProjectionService } from "./services/payout-obligation-projection.service";
import { BrandPayoutsCursorCodec } from "./utils/brand-payouts-cursor";

@Module({
  imports: [BrandCentreModule],
  controllers: [BrandPayoutsController],
  providers: [
    BrandPayoutsService,
    BrandPayoutsAuthorizationService,
    BrandPayoutsCursorCodec,
    BrandPayoutsReadEnvironmentService,
    FinancialActivityProjectionService,
    PayoutObligationProjectionService,
    BrandPayoutsQueryService,
    {
      provide: BRAND_PAYOUTS_QUERY_PORT_V2,
      useExisting: BrandPayoutsQueryService,
    },
  ],
})
export class BrandPayoutsModule {}

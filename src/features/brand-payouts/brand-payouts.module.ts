import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { BrandPayoutsController } from "./brand-payouts.controller";
import { BRAND_PAYOUTS_QUERY_PORT_V2 } from "./ports/brand-payouts-read.port";
import { COLLABORATION_PAYOUT_INSTRUCTION_INTAKE_PORT_V1 } from "./ports/collaboration-payout-instruction.port";
import { CREATOR_PAYOUT_PROVIDER_PORT } from "./ports/creator-payout-provider.port";
import { CREATOR_PAYOUT_READINESS_PORT } from "./ports/creator-payout-readiness.port";
import { BrandPayoutsAuthorizationService } from "./services/brand-payouts-authorization.service";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";
import { BrandPayoutsReadEnvironmentService } from "./services/brand-payouts-read-environment.service";
import { BrandPayoutsService } from "./services/brand-payouts.service";
import { FinancialActivityProjectionService } from "./services/financial-activity-projection.service";
import { PayoutObligationProjectionService } from "./services/payout-obligation-projection.service";
import { FailClosedCreatorPayoutProviderService } from "./services/fail-closed-creator-payout-provider.service";
import { FinancialReserveService } from "./services/financial-reserve.service";
import { PayoutObligationIntakeService } from "./services/payout-obligation-intake.service";
import { PrismaCreatorPayoutReadinessService } from "./services/prisma-creator-payout-readiness.service";
import { ProviderNeutralPayoutService } from "./services/provider-neutral-payout.service";
import { BrandPayoutsCursorCodec } from "./utils/brand-payouts-cursor";

@Module({
  imports: [BrandCentreModule, BrandEscrowModule, CollaborationModule],
  controllers: [BrandPayoutsController],
  providers: [
    BrandPayoutsService,
    BrandPayoutsAuthorizationService,
    BrandPayoutsCursorCodec,
    BrandPayoutsReadEnvironmentService,
    FinancialActivityProjectionService,
    PayoutObligationProjectionService,
    BrandPayoutsQueryService,
    FinancialReserveService,
    PayoutObligationIntakeService,
    PrismaCreatorPayoutReadinessService,
    FailClosedCreatorPayoutProviderService,
    ProviderNeutralPayoutService,
    {
      provide: BRAND_PAYOUTS_QUERY_PORT_V2,
      useExisting: BrandPayoutsQueryService,
    },
    {
      provide: COLLABORATION_PAYOUT_INSTRUCTION_INTAKE_PORT_V1,
      useExisting: PayoutObligationIntakeService,
    },
    {
      provide: CREATOR_PAYOUT_READINESS_PORT,
      useExisting: PrismaCreatorPayoutReadinessService,
    },
    {
      provide: CREATOR_PAYOUT_PROVIDER_PORT,
      useExisting: FailClosedCreatorPayoutProviderService,
    },
  ],
  exports: [
    FinancialReserveService,
    PayoutObligationIntakeService,
    ProviderNeutralPayoutService,
    COLLABORATION_PAYOUT_INSTRUCTION_INTAKE_PORT_V1,
  ],
})
export class BrandPayoutsModule {}

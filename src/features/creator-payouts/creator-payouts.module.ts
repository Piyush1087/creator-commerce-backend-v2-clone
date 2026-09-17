import { Module } from "@nestjs/common";

import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CreatorPayoutMethodSummaryModule } from "../creator-settings/payouts/creator-payout-method-summary.module";
import { CreatorPayoutsController } from "./creator-payouts.controller";
import { CreatorPayoutsAuthorizationService } from "./services/creator-payouts-authorization.service";
import { CreatorPayoutsObligationProjectionService } from "./services/creator-payouts-obligation-projection.service";
import { CreatorPayoutsHistoryProjectionService } from "./services/creator-payouts-history-projection.service";
import { CreatorPayoutsQueryService } from "./services/creator-payouts-query.service";
import { CreatorPayoutsReadEnvironmentService } from "./services/creator-payouts-read-environment.service";
import { CreatorPayoutsCursorCodec } from "./utils/creator-payouts-cursor";

@Module({
  imports: [CreatorTeamModule, CreatorPayoutMethodSummaryModule],
  controllers: [CreatorPayoutsController],
  providers: [
    CreatorPayoutsAuthorizationService,
    CreatorPayoutsObligationProjectionService,
    CreatorPayoutsHistoryProjectionService,
    CreatorPayoutsQueryService,
    CreatorPayoutsReadEnvironmentService,
    CreatorPayoutsCursorCodec,
  ],
})
export class CreatorPayoutsModule {}

import { Module } from "@nestjs/common";

import { CreatorEntryModule } from "../creator-entry/creator-entry.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CreatorPayoutsController } from "./creator-payouts.controller";
import { CreatorPayoutsAuthorizationService } from "./services/creator-payouts-authorization.service";
import { CreatorPayoutsObligationProjectionService } from "./services/creator-payouts-obligation-projection.service";
import { CreatorPayoutsQueryService } from "./services/creator-payouts-query.service";
import { CreatorPayoutsReadEnvironmentService } from "./services/creator-payouts-read-environment.service";
import { CreatorPayoutsCursorCodec } from "./utils/creator-payouts-cursor";

@Module({
  imports: [CreatorEntryModule, CreatorTeamModule],
  controllers: [CreatorPayoutsController],
  providers: [
    CreatorPayoutsAuthorizationService,
    CreatorPayoutsObligationProjectionService,
    CreatorPayoutsQueryService,
    CreatorPayoutsReadEnvironmentService,
    CreatorPayoutsCursorCodec,
  ],
})
export class CreatorPayoutsModule {}

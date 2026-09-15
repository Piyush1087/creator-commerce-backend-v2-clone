import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../../creator-settings/team/creator-team.module";
import { CreatorOperationalReadModule } from "../../creator-settings/creator-operational-read.module";
import { WORK_PREFERENCES_RATE_CARD_PORT } from "../work-preferences/work-preferences-rate-card.port";
import { RateCardPersistence } from "./rate-card.persistence";
@Module({
  imports: [CreatorTeamModule, CreatorOperationalReadModule],
  providers: [
    RateCardPersistence,
    {
      provide: WORK_PREFERENCES_RATE_CARD_PORT,
      useExisting: RateCardPersistence,
    },
  ],
  exports: [RateCardPersistence, WORK_PREFERENCES_RATE_CARD_PORT],
})
export class RateCardPersistenceModule {}

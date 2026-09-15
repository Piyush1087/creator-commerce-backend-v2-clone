import { Module } from "@nestjs/common";
import { CreatorTeamModule } from "../../creator-settings/team/creator-team.module";
import { CreatorOperationalReadModule } from "../../creator-settings/creator-operational-read.module";
import { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesRepository } from "./work-preferences.repository";
import { WorkPreferencesService } from "./work-preferences.service";
import { WorkPreferencesController } from "./work-preferences.controller";
@Module({
  imports: [CreatorTeamModule, CreatorOperationalReadModule],
  providers: [
    WorkPreferencesRepository,
    WorkPreferencesService,
    PrismaCreatorPayoutReadinessService,
  ],
  controllers: [WorkPreferencesController],
  exports: [WorkPreferencesRepository, WorkPreferencesService],
})
export class WorkPreferencesModule {}

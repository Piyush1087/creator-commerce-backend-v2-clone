import { Module } from "@nestjs/common";

import { CampaignApplicationsModule } from "../campaign-applications/campaign-applications.module";
import { CampaignOpportunityModule } from "../campaign-opportunities/campaign-opportunity.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CreatorHomeAggregationService } from "./creator-home-aggregation.service";
import { CreatorHomeController } from "./creator-home.controller";

@Module({
  imports: [
    CreatorTeamModule,
    CreatorSettingsModule,
    CampaignOpportunityModule,
    CampaignApplicationsModule,
    CollaborationModule,
    NotificationsModule,
  ],
  controllers: [CreatorHomeController],
  providers: [CreatorHomeAggregationService],
  exports: [CreatorHomeAggregationService],
})
export class CreatorHomeModule {}

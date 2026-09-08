import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { CAMPAIGN_CONTINUATION_CONTEXT } from "../creator-entry/campaign-continuation-context.port";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CampaignContinuationContextService } from "./campaign-continuation-context.service";
import { CampaignInvitationService } from "./campaign-invitation.service";

@Module({
  imports: [PrismaModule, CreatorTeamModule],
  providers: [
    CampaignInvitationService,
    CampaignContinuationContextService,
    {
      provide: CAMPAIGN_CONTINUATION_CONTEXT,
      useExisting: CampaignContinuationContextService,
    },
  ],
  exports: [CampaignInvitationService, CAMPAIGN_CONTINUATION_CONTEXT],
})
export class CampaignOpportunityContextModule {}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CampaignOpportunityContextModule } from "./campaign-opportunity-context.module";
import {
  CampaignOpportunityController,
  CreatorOpportunitiesController,
} from "./campaign-opportunity.controller";
import { CampaignOpportunityService } from "./campaign-opportunity.service";
import { CampaignOpportunityPolicyService } from "./campaign-opportunity-policy.service";
import {
  CampaignOpportunityEligibilityPort,
  CanonicalCampaignOpportunityEligibility,
} from "./campaign-opportunity-eligibility";
import { CampaignIngressService } from "./campaign-ingress.service";

@Module({
  imports: [
    PrismaModule,
    CreatorEntryModule,
    CreatorTeamModule,
    CampaignOpportunityContextModule,
  ],
  controllers: [CampaignOpportunityController, CreatorOpportunitiesController],
  providers: [
    CampaignOpportunityService,
    CampaignOpportunityPolicyService,
    CanonicalCampaignApplicationReadService,
    CampaignIngressService,
    {
      provide: CampaignOpportunityEligibilityPort,
      useClass: CanonicalCampaignOpportunityEligibility,
    },
  ],
})
export class CampaignOpportunityModule {}

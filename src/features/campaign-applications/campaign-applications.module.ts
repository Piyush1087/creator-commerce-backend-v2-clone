import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CreatorTeamModule } from "../creator-settings/team/creator-team.module";
import { CampaignOpportunityContextModule } from "../campaign-opportunities/campaign-opportunity-context.module";
import { CampaignOpportunityPolicyService } from "../campaign-opportunities/campaign-opportunity-policy.service";
import {
  CampaignOpportunityEligibilityPort,
  CanonicalCampaignOpportunityEligibility,
} from "../campaign-opportunities/campaign-opportunity-eligibility";
import { CanonicalCampaignApplicationReadService } from "../brand-uce/services/canonical-campaign-application-read.service";
import { ApplicationSubmitContextService } from "./application-submit-context.service";
import { ApplicationSubmitService } from "./application-submit.service";
import { ApplicationTerminalService } from "./application-terminal.service";
import { ApplicationHistoryService } from "./application-history.service";
import { CampaignApplicationsController } from "./campaign-applications.controller";
import { ApplicationHandoffModule } from "../collaboration/application-handoff.module";
import { NotificationsModule } from "../notifications/notifications.module";

export function privateApplicationResponse(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("Cookie");
  next();
}

@Module({
  imports: [
    PrismaModule,
    ApplicationHandoffModule,
    NotificationsModule,
    AuthModule,
    BrandCentreModule,
    CreatorTeamModule,
    CampaignOpportunityContextModule,
  ],
  controllers: [CampaignApplicationsController],
  providers: [
    ApplicationSubmitContextService,
    ApplicationSubmitService,
    ApplicationTerminalService,
    ApplicationHistoryService,
    CampaignOpportunityPolicyService,
    CanonicalCampaignApplicationReadService,
    {
      provide: CampaignOpportunityEligibilityPort,
      useClass: CanonicalCampaignOpportunityEligibility,
    },
  ],
  exports: [ApplicationTerminalService],
})
export class CampaignApplicationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(privateApplicationResponse)
      .forRoutes(
        ...[
          "api/v1/creator/campaigns/:campaignId/applications",
          "api/v1/creator/applications",
          "api/v1/creator/applications/:applicationId",
          "api/v1/creator/applications/:applicationId/withdraw",
          "api/v1/brand-uce/campaigns/:campaignId/applications",
          "api/v1/brand-uce/campaigns/:campaignId/applications/:applicationId/approve",
          "api/v1/brand-uce/campaigns/:campaignId/applications/:applicationId/reject",
          "api/v1/creator-uce/campaigns/:campaignId/apply",
        ].map((path) => ({ path, method: RequestMethod.ALL })),
      );
  }
}

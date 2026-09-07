import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

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
export class CampaignOpportunityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        // Successful handler @Header metadata must not replace CORS variance.
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) => {
          if (name.toLowerCase() === "vary") {
            const tokens = `${res.getHeader("Vary") ?? ""},${value}`
              .split(",")
              .map((token) => token.trim())
              .filter(Boolean);
            value = tokens
              .filter(
                (token, index) =>
                  tokens.findIndex(
                    (other) => other.toLowerCase() === token.toLowerCase(),
                  ) === index,
              )
              .join(", ");
          }
          return setHeader(name, value);
        };
        res.setHeader("Cache-Control", "private, no-store");
        res.vary("Authorization");
        res.vary("Cookie");
        next();
      })
      .forRoutes(
        ...[
          "api/v1/campaign-opportunities/:campaignId",
          "api/v1/campaign-opportunities/:campaignId/apply-continuation",
          "api/v1/creator/campaigns/opportunities",
        ].map((path) => ({ path, method: RequestMethod.ALL })),
      );
  }
}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { BrandUceController } from "./brand-uce.controller";
import { CanonicalCampaignCreateController } from "./canonical-campaign-create.controller";
import { BrandUceAccessService } from "./services/brand-uce-access.service";
import { BrandUceBriefService } from "./services/brand-uce-brief.service";
import { BrandUceCampaignAssetService } from "./services/brand-uce-campaign-asset.service";
import { BrandUceCampaignService } from "./services/brand-uce-campaign.service";
import { BrandUcePipelineService } from "./services/brand-uce-pipeline.service";
import { BrandUceProductService } from "./services/brand-uce-product.service";
import { BrandUceReportingService } from "./services/brand-uce-reporting.service";
import { CampaignApplicationService } from "./services/campaign-application.service";
import { CampaignCommandService } from "./services/campaign-command.service";
import { CampaignQueryService } from "./services/campaign-query.service";
import { CanonicalCampaignCreateService } from "./services/canonical-campaign-create.service";
import { CanonicalCampaignDraftReadService } from "./services/canonical-campaign-draft-read.service";
import { CanonicalCampaignReadinessService } from "./services/canonical-campaign-readiness.service";
import { CanonicalCampaignBriefService } from "./services/canonical-campaign-brief.service";

@Module({
  imports: [PrismaModule, AuthModule, BrandCentreModule, CollaborationModule],
  controllers: [BrandUceController, CanonicalCampaignCreateController],
  providers: [
    BrandUceAccessService,
    BrandUceCampaignAssetService,
    BrandUceCampaignService,
    BrandUceProductService,
    BrandUceBriefService,
    CanonicalCampaignBriefService,
    BrandUcePipelineService,
    BrandUceReportingService,
    CampaignApplicationService,
    CampaignQueryService,
    CampaignCommandService,
    CanonicalCampaignCreateService,
    CanonicalCampaignDraftReadService,
    CanonicalCampaignReadinessService,
  ],
  exports: [
    BrandUceCampaignService,
    BrandUceReportingService,
    BrandUcePipelineService,
    CampaignApplicationService,
    CampaignQueryService,
    CampaignCommandService,
    CanonicalCampaignCreateService,
  ],
})
export class BrandUceModule {}

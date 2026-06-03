import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandUceController } from "./brand-uce.controller";
import { BrandUceAccessService } from "./services/brand-uce-access.service";
import { BrandUceBriefService } from "./services/brand-uce-brief.service";
import { BrandUceCampaignService } from "./services/brand-uce-campaign.service";
import { BrandUcePipelineService } from "./services/brand-uce-pipeline.service";
import { BrandUceProductService } from "./services/brand-uce-product.service";
import { BrandUceReportingService } from "./services/brand-uce-reporting.service";

@Module({
  imports: [PrismaModule, AuthModule, BrandCentreModule],
  controllers: [BrandUceController],
  providers: [
    BrandUceAccessService,
    BrandUceCampaignService,
    BrandUceProductService,
    BrandUceBriefService,
    BrandUcePipelineService,
    BrandUceReportingService,
  ],
  exports: [BrandUceCampaignService],
})
export class BrandUceModule {}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CreatorAudienceModule } from "../creator-audience/creator-audience.module";
import { CreatorBrandModule } from "../creator-brand/creator-brand.module";
import { RateCardModule } from "../creator-commercial-setup/rate-card/rate-card.module";
import { WorkPreferencesModule } from "../creator-commercial-setup/work-preferences/work-preferences.module";
import { CreatorContentModule } from "../creator-content/creator-content.module";
import { PortfolioModule } from "../creator-portfolio/portfolio.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import {
  CreatorMediaKitBrandController,
  CreatorMediaKitCreatorController,
  CreatorMediaKitPublicController,
} from "./creator-media-kit.controller";
import { CreatorMediaKitService } from "./creator-media-kit.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCentreModule,
    CreatorAudienceModule,
    CreatorBrandModule,
    CreatorContentModule,
    PortfolioModule,
    WorkPreferencesModule,
    RateCardModule,
    CreatorSettingsModule,
  ],
  controllers: [
    CreatorMediaKitCreatorController,
    CreatorMediaKitPublicController,
    CreatorMediaKitBrandController,
  ],
  providers: [CreatorMediaKitService],
  exports: [CreatorMediaKitService],
})
export class CreatorMediaKitModule {}

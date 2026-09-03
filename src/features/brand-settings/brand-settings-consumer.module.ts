import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandProviderReadinessService } from "./services/brand-provider-readiness.service";
import { BrandSettingsAccessService } from "./services/brand-settings-access.service";

@Module({
  imports: [PrismaModule, BrandCentreModule],
  providers: [BrandSettingsAccessService, BrandProviderReadinessService],
  exports: [BrandProviderReadinessService],
})
export class BrandSettingsConsumerModule {}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandCentreUceBridgeController } from "./brand-centre-uce-bridge.controller";
import { BrandCentreUceBridgeService } from "./services/brand-centre-uce-bridge.service";

@Module({
  imports: [PrismaModule, AuthModule, BrandCentreModule],
  controllers: [BrandCentreUceBridgeController],
  providers: [BrandCentreUceBridgeService],
  exports: [BrandCentreUceBridgeService],
})
export class BrandCentreUceBridgeModule {}


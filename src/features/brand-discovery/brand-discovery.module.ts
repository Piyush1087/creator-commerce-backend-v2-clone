import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { BrandDiscoveryController } from "./brand-discovery.controller";
import { BrandDiscoveryService } from "./brand-discovery.service";

@Module({
  imports: [PrismaModule],
  controllers: [BrandDiscoveryController],
  providers: [BrandDiscoveryService],
})
export class BrandDiscoveryModule {}

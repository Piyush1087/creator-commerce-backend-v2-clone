import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { PublicBrandController } from "./public-brand.controller";
import { PublicBrandService } from "./public-brand.service";

@Module({
  imports: [PrismaModule],
  controllers: [PublicBrandController],
  providers: [PublicBrandService],
  exports: [PublicBrandService],
})
export class PublicBrandModule {}

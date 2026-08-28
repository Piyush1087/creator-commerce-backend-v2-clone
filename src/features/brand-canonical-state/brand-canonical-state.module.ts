import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { BrandVisualStateService } from "./brand-visual-state.service";
import { BrandLocationService } from "./brand-location.service";

@Module({
  imports: [PrismaModule],
  providers: [BrandVisualStateService, BrandLocationService],
  exports: [BrandVisualStateService, BrandLocationService],
})
export class BrandCanonicalStateModule {}

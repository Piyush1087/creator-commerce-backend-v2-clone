import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { PublicBrandService } from "./public-brand.service";

@Controller("api/v1/public/brands")
@UseGuards(ThrottlerGuard)
export class PublicBrandController {
  constructor(private readonly publicBrand: PublicBrandService) {}

  @Get(":slug")
  getBrandLanding(@Param("slug") slug: string) {
    return this.publicBrand.getPublicBrandLanding(slug);
  }
}

import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandHomeAggregationService } from "./brand-home-aggregation.service";

@Controller("api/v1/brand/home")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandHomeController {
  constructor(private readonly home: BrandHomeAggregationService) {}

  @Get()
  read(@Req() request: RequestWithAuthUser) {
    return this.home.read(request.user);
  }
}

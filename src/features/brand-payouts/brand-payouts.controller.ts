import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandPayoutsService } from "./services/brand-payouts.service";

@Controller("api/v1/brand/payouts")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandPayoutsController {
  constructor(private readonly payouts: BrandPayoutsService) {}

  @Get()
  getPayoutsHub(@Req() req: RequestWithAuthUser) {
    return this.payouts.getPayoutsHub(req.user);
  }
}

import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorPayoutsService } from "./services/creator-payouts.service";

@Controller("api/v1/creator/payouts")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorPayoutsController {
  constructor(private readonly payouts: CreatorPayoutsService) {}

  @Get()
  getPayoutsHub(@Req() req: RequestWithAuthUser) {
    return this.payouts.getPayoutsHub(req.user);
  }
}

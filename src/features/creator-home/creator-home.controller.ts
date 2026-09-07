import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorHomeAggregationService } from "./creator-home-aggregation.service";

@Controller("api/v1/creator/home")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorHomeController {
  constructor(private readonly home: CreatorHomeAggregationService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.home.read(request.user);
  }
}

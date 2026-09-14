import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorAudienceService } from "./creator-audience.service";

@Controller("api/v1/creator/insights/audience")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorAudienceController {
  constructor(private readonly audience: CreatorAudienceService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.audience.read(request.user);
  }
}

import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AudienceV1ConsumerService } from "../creator-audience-v1/creator-audience-v1.consumer.service";

@Controller("api/v1/creator/insights/audience")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorAudienceController {
  constructor(private readonly audience: AudienceV1ConsumerService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(
    @Req() request: RequestWithAuthUser,
    @Query() query: Record<string, unknown> = {},
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException(
        "Creator Audience query overrides are not supported",
      );
    return this.audience.read(request.user);
  }
}

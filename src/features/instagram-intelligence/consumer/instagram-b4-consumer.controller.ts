import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { InstagramB4ConsumerService } from "./instagram-b4-consumer.service";

@Controller("api/v1/brand-centre/instagram")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class InstagramB4ConsumerController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly consumer: InstagramB4ConsumerService,
  ) {}

  @Get()
  async read(@Req() request: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(request.user);
    return this.consumer.read(brandProfileId, request.user.id);
  }

  @Get("media/:mediaId")
  async readMedia(
    @Req() request: RequestWithAuthUser,
    @Param("mediaId") mediaId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(request.user);
    return this.consumer.readMedia(brandProfileId, mediaId);
  }
}

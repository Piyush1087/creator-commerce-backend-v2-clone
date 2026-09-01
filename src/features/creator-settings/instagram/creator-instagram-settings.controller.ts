import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreatorInstagramCompleteDto } from "../../creator-entry/dto/creator-entry.dto";
import { CreatorInstagramSettingsService } from "./creator-instagram-settings.service";

/** Feature-local controller. P2 owns registration in CreatorSettingsModule. */
@Controller("api/v1/creator/settings/instagram")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorInstagramSettingsController {
  constructor(private readonly instagram: CreatorInstagramSettingsService) {}

  @Get()
  read(@Req() request: RequestWithAuthUser) {
    return this.instagram.read(request.user);
  }

  @Post("revalidate")
  @HttpCode(200)
  revalidate(@Req() request: RequestWithAuthUser) {
    return this.instagram.revalidate(request.user);
  }

  @Post("reconnect/authorize")
  @HttpCode(200)
  authorizeReconnect(@Req() request: RequestWithAuthUser) {
    return this.instagram.authorizeReconnect(request.user);
  }

  @Post("reconnect/complete")
  @HttpCode(200)
  completeReconnect(
    @Req() request: RequestWithAuthUser,
    @Body() body: CreatorInstagramCompleteDto,
  ) {
    return this.instagram.completeReconnect(request.user, body);
  }

  @Delete()
  disconnect(@Req() request: RequestWithAuthUser) {
    return this.instagram.disconnect(request.user);
  }
}

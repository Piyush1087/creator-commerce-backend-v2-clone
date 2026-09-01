import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { setRefreshCookie } from "../auth/auth-cookie.util";
import type { SessionIssueResult } from "../auth/auth-session.service";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorEntryRegistrationService } from "./creator-entry-registration.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorInstagramConnectionService } from "./creator-instagram-connection.service";
import { CreatorInstagramContinuityService } from "./creator-instagram-continuity.service";
import {
  CreatorGoogleRegistrationDto,
  CreatorInstagramCompleteDto,
  CreatorPasswordRegistrationDto,
  CreatorRegistrationEmailDto,
  CreatorRegistrationOtpDto,
} from "./dto/creator-entry.dto";

@Controller("api/v1/creator-entry")
@UseGuards(ThrottlerGuard)
export class CreatorEntryController {
  constructor(
    private readonly registration: CreatorEntryRegistrationService,
    private readonly state: CreatorEntryStateService,
    private readonly instagram: CreatorInstagramConnectionService,
    private readonly continuity: CreatorInstagramContinuityService,
  ) {}

  @Public()
  @Post("register/password")
  @HttpCode(202)
  registerPassword(@Body() dto: CreatorPasswordRegistrationDto) {
    return this.registration.registerPassword(dto);
  }

  @Public()
  @Post("register/email/otp/request")
  @HttpCode(202)
  requestEmailOtp(@Body() dto: CreatorRegistrationEmailDto) {
    return this.registration.requestVerificationOtp(dto.email);
  }

  @Public()
  @Post("register/email/otp/verify")
  @HttpCode(200)
  async verifyEmailOtp(
    @Body() dto: CreatorRegistrationOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      response,
      await this.registration.verifyEmailOtp(dto.email, dto.code),
    );
  }

  @Public()
  @Post("register/google")
  @HttpCode(200)
  async registerGoogle(
    @Body() dto: CreatorGoogleRegistrationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      response,
      await this.registration.registerGoogle(dto.idToken),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("state")
  stateFor(@Req() request: RequestWithAuthUser) {
    return this.state.read(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("instagram/authorize")
  @HttpCode(200)
  authorizeInstagram(@Req() request: RequestWithAuthUser) {
    return this.instagram.authorize(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("instagram/complete")
  @HttpCode(200)
  completeInstagram(
    @Req() request: RequestWithAuthUser,
    @Body() dto: CreatorInstagramCompleteDto,
  ) {
    return this.instagram.complete(request.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("instagram/revalidate")
  @HttpCode(200)
  revalidateInstagram(@Req() request: RequestWithAuthUser) {
    return this.continuity.revalidate(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("instagram/reconnect/authorize")
  @HttpCode(200)
  authorizeInstagramReconnect(@Req() request: RequestWithAuthUser) {
    return this.continuity.authorizeReconnect(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("instagram/reconnect/complete")
  @HttpCode(200)
  completeInstagramReconnect(
    @Req() request: RequestWithAuthUser,
    @Body() dto: CreatorInstagramCompleteDto,
  ) {
    return this.continuity.completeReconnect(request.user, dto);
  }

  private withRefreshCookie(response: Response, result: SessionIssueResult) {
    setRefreshCookie(response, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }
}

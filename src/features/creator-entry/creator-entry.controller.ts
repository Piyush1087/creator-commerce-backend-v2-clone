import {
  Body,
  Controller,
  Get,
  GoneException,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { setRefreshCookie } from "../auth/auth-cookie.util";
import type { SessionIssueResult } from "../auth/auth-session.service";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  clearCreatorCampaignApplyContinuationCookie,
  readCreatorCampaignApplyContinuationCookie,
  shortenCreatorCampaignApplyContinuationCookie,
} from "./creator-campaign-apply-continuation-cookie.util";
import { CreatorCampaignApplyContinuationService } from "./creator-campaign-apply-continuation.service";
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
    private readonly campaignContinuations: CreatorCampaignApplyContinuationService,
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

  @UseGuards(JwtAuthGuard)
  @Post("campaign-apply/continuation/resolve")
  @HttpCode(200)
  async resolveCampaignApplyContinuation(
    @Req() request: RequestWithAuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const continuationToken =
      readCreatorCampaignApplyContinuationCookie(request);
    try {
      const result = await this.campaignContinuations.resolve(
        request.user,
        continuationToken ?? "",
      );
      const { continuationExpiresAt, ...publicResult } = result;
      if (publicResult.status === "READY_TO_RETURN" && continuationToken) {
        shortenCreatorCampaignApplyContinuationCookie(
          response,
          continuationToken,
          continuationExpiresAt,
        );
      }
      return publicResult;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof GoneException
      ) {
        clearCreatorCampaignApplyContinuationCookie(response);
      }
      throw error;
    }
  }

  @Public()
  @Get("campaign-apply/continuation/status")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async campaignApplyContinuationStatus(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const continuationToken =
      readCreatorCampaignApplyContinuationCookie(request);
    if (continuationToken === undefined) return { present: false };
    const present =
      await this.campaignContinuations.isPresent(continuationToken);
    if (!present) clearCreatorCampaignApplyContinuationCookie(response);
    return { present };
  }

  @Public()
  @Post("campaign-apply/continuation/discard")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  discardCampaignApplyContinuation(
    @Res({ passthrough: true }) response: Response,
  ) {
    clearCreatorCampaignApplyContinuationCookie(response);
    return { present: false };
  }

  private withRefreshCookie(response: Response, result: SessionIssueResult) {
    setRefreshCookie(response, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }
}

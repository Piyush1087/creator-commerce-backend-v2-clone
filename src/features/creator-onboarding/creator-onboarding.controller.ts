import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { setRefreshCookie } from "../auth/auth-cookie.util";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorOnboardingService } from "./creator-onboarding.service";
import { ZodValidationPipe } from "./pipes/zod-validation.pipe";
import {
  AccountSignupSchema,
  AiActivationTriggerSchema,
  EmailOtpVerificationSchema,
  FeatureStagingSchema,
  HandleCheckSchema,
  JoinCreatorWaitlistSchema,
  MetaConnectSchema,
} from "./schemas/creator-onboarding.schema";

@Controller("api/v1/creator-onboarding")
@UseGuards(ThrottlerGuard)
export class CreatorOnboardingController {
  constructor(private readonly onboarding: CreatorOnboardingService) {}

  @Public()
  @Post("handle-check")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  handleCheck(
    @Body(new ZodValidationPipe(HandleCheckSchema))
    body: {
      instagramHandle: string;
    },
    @Ip() clientIp: string,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.onboarding.handleCheck({
      instagramHandle: body.instagramHandle,
      clientIp,
      userAgent,
    });
  }

  @Public()
  @Post("stage-features")
  @HttpCode(200)
  stageFeatures(
    @Body(new ZodValidationPipe(FeatureStagingSchema))
    body: {
      onboardingTrackId: string;
      stagedModules: import("@prisma/client").ActivatedModule[];
    },
  ) {
    return this.onboarding.stageFeatures(
      body.onboardingTrackId,
      body.stagedModules,
    );
  }

  @Public()
  @Post("signup")
  @HttpCode(201)
  signup(
    @Body(new ZodValidationPipe(AccountSignupSchema))
    body: {
      onboardingTrackId: string;
      email: string;
      password: string;
    },
  ) {
    return this.onboarding.signup(body);
  }

  @Public()
  @Post("verify-otp")
  @HttpCode(200)
  async verifyOtp(
    @Body(new ZodValidationPipe(EmailOtpVerificationSchema))
    body: {
      email: string;
      otpCode: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.onboarding.verifyOtp(body.email, body.otpCode);
    setRefreshCookie(response, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }

  @UseGuards(JwtAuthGuard)
  @Post("meta-connect")
  @HttpCode(200)
  metaConnect(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(MetaConnectSchema))
    body: {
      onboardingTrackId: string;
      code: string;
      redirectUri: string;
    },
  ) {
    return this.onboarding.metaConnect(req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post("activate-sync")
  @HttpCode(202)
  activateSync(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(AiActivationTriggerSchema))
    body: {
      onboardingTrackId: string;
      userConfirmedSync: true;
      skipInstagramConnect?: boolean;
    },
  ) {
    return this.onboarding.activateSync(req.user, body);
  }

  @Public()
  @Get("track/:trackId")
  getTrack(@Param("trackId") trackId: string) {
    return this.onboarding.getTrack(trackId);
  }

  @Public()
  @Post("waitlist")
  @HttpCode(201)
  joinWaitlist(
    @Body(new ZodValidationPipe(JoinCreatorWaitlistSchema))
    body: {
      onboardingTrackId: string;
      email: string;
    },
  ) {
    return this.onboarding.joinWaitlist(body);
  }
}

import {
  Body,
  Controller,
  Get,
  GoneException,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorOnboardingService } from "./creator-onboarding.service";
import { ZodValidationPipe } from "./pipes/zod-validation.pipe";
import {
  AiActivationTriggerSchema,
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
  signup(): never {
    throw this.accountCreationRetired();
  }

  @Public()
  @Post("verify-otp")
  verifyOtp(): never {
    throw this.accountCreationRetired();
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

  private accountCreationRetired(): GoneException {
    return new GoneException({
      code: "CREATOR_ONBOARDING_ACCOUNT_CREATION_RETIRED",
      message:
        "Use the Creator Entry registration routes under /api/v1/creator-entry/register.",
    });
  }
}

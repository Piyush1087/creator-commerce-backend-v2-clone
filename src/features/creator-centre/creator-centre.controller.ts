import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../creator-onboarding/pipes/zod-validation.pipe";
import { CreatorCentreService } from "./creator-centre.service";
import {
  AnalyticsFilterQuerySchema,
  MediaKitSaveSchema,
} from "./schemas/creator-centre.schema";

@Controller("api/v1/creator-centre")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorCentreController {
  constructor(private readonly centre: CreatorCentreService) {}

  @Get("media-kit")
  getMediaKit(@Req() req: RequestWithAuthUser) {
    return this.centre.getMediaKit(req.user);
  }

  @Get("media-kit/public-link")
  getPublicLink(@Req() req: RequestWithAuthUser) {
    return this.centre.getPublicLink(req.user);
  }

  @Patch("media-kit")
  saveMediaKit(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(MediaKitSaveSchema)) body: unknown,
  ) {
    return this.centre.saveMediaKit(
      req.user,
      body as ReturnType<typeof MediaKitSaveSchema.parse>,
    );
  }

  @Get("analytics/pulse")
  getAnalyticsPulse(
    @Req() req: RequestWithAuthUser,
    @Query(new ZodValidationPipe(AnalyticsFilterQuerySchema))
    query: { limitCount: number },
  ) {
    return this.centre.getAnalyticsPulse(req.user, query.limitCount);
  }
}

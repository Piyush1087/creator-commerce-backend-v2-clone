import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { randomBytes } from "crypto";
import { z } from "zod";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../creator-onboarding/pipes/zod-validation.pipe";
import { InstagramConnectService } from "./instagram-connect.service";
import { InstagramOAuthClient } from "./instagram-oauth.client";

const ConnectSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

const OAuthUrlQuerySchema = z.object({
  redirectUri: z.string().url(),
});

@Controller("api/v1/instagram")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class InstagramConnectController {
  constructor(
    private readonly instagram: InstagramConnectService,
    private readonly oauth: InstagramOAuthClient,
  ) {}

  @Public()
  @Get("oauth-url")
  oauthUrl(
    @Query(new ZodValidationPipe(OAuthUrlQuerySchema))
    query: z.infer<typeof OAuthUrlQuerySchema>,
  ) {
    const state = randomBytes(16).toString("hex");
    return {
      url: this.oauth.buildAuthorizeUrl(query.redirectUri, state),
      state,
    };
  }

  @Post("connect")
  @HttpCode(200)
  connect(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(ConnectSchema))
    body: z.infer<typeof ConnectSchema>,
  ) {
    return this.instagram.connectForUser(req.user, body);
  }
}

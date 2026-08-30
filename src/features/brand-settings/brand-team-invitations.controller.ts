import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ZodValidationPipe } from "../co-pilot/pipes/zod-validation.pipe";
import {
  AcceptTeamInvitationSchema,
  InspectTeamInvitationSchema,
  type AcceptTeamInvitationInput,
} from "./schemas/team-invitation.schema";
import { BrandTeamInvitationsService } from "./services/brand-team-invitations.service";
import { setRefreshCookie } from "../auth/auth-cookie.util";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user";

@Controller("api/v1/brand/team-invitations")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class BrandTeamInvitationsController {
  constructor(private readonly invitations: BrandTeamInvitationsService) {}

  @Post("inspect")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  inspect(
    @Body(new ZodValidationPipe(InspectTeamInvitationSchema))
    body: {
      token: string;
    },
  ) {
    return this.invitations.inspect(body.token);
  }

  @Post("request-otp")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  requestOtp(
    @Body(new ZodValidationPipe(InspectTeamInvitationSchema))
    body: {
      token: string;
    },
  ) {
    return this.invitations.requestAcceptanceOtp(body.token);
  }

  @Post("accept")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(OptionalJwtAuthGuard)
  async accept(
    @Body(new ZodValidationPipe(AcceptTeamInvitationSchema))
    body: AcceptTeamInvitationInput,
    @Req() request: Request & { user?: AuthUser },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.invitations.accept(body, request.user);
    setRefreshCookie(response, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }
}

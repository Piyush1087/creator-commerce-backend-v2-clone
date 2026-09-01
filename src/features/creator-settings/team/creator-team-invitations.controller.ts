import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../co-pilot/pipes/zod-validation.pipe";
import {
  AcceptCreatorTeamInvitationSchema,
  InspectCreatorTeamInvitationSchema,
} from "./creator-team.schema";
import { CreatorTeamInvitationsService } from "./creator-team-invitations.service";

@Controller("api/v1/creator/team-invitations")
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class CreatorTeamInvitationsController {
  constructor(private readonly invitations: CreatorTeamInvitationsService) {}

  @Post("inspect")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  inspect(
    @Body(new ZodValidationPipe(InspectCreatorTeamInvitationSchema))
    body: ReturnType<typeof InspectCreatorTeamInvitationSchema.parse>,
  ) {
    return this.invitations.inspect(body.token);
  }

  @Post("accept")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(JwtAuthGuard)
  accept(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(AcceptCreatorTeamInvitationSchema))
    body: ReturnType<typeof AcceptCreatorTeamInvitationSchema.parse>,
  ) {
    return this.invitations.accept(request.user, body.token);
  }
}

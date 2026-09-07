import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../co-pilot/pipes/zod-validation.pipe";
import {
  InviteCreatorTeamMemberSchema,
  UpdateCreatorTeamMemberRoleSchema,
} from "./creator-team.schema";
import { CreatorTeamInvitationsService } from "./creator-team-invitations.service";
import { CreatorTeamService } from "./creator-team.service";

@Controller("api/v1/creator/settings/team")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorTeamController {
  constructor(
    private readonly team: CreatorTeamService,
    private readonly invitations: CreatorTeamInvitationsService,
  ) {}

  @Get()
  list(@Req() request: RequestWithAuthUser) {
    return this.team.list(request.user);
  }

  @Post("invitations")
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(InviteCreatorTeamMemberSchema))
    body: ReturnType<typeof InviteCreatorTeamMemberSchema.parse>,
  ) {
    return this.invitations.create(request.user, body);
  }

  @Patch("members/:membershipId/role")
  changeRole(
    @Req() request: RequestWithAuthUser,
    @Param("membershipId") membershipId: string,
    @Body(new ZodValidationPipe(UpdateCreatorTeamMemberRoleSchema))
    body: ReturnType<typeof UpdateCreatorTeamMemberRoleSchema.parse>,
  ) {
    return this.team.updateRole(request.user, membershipId, body.allocatedRole);
  }

  @Delete("members/:membershipId")
  remove(
    @Req() request: RequestWithAuthUser,
    @Param("membershipId") membershipId: string,
  ) {
    return this.team.remove(request.user, membershipId);
  }

  @Delete("invitations/:invitationId")
  cancelInvitation(
    @Req() request: RequestWithAuthUser,
    @Param("invitationId") invitationId: string,
  ) {
    return this.team.cancelInvitation(request.user, invitationId);
  }
}

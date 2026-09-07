import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

@Controller("api/v1/creator/workspace")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorWorkspaceActorController {
  constructor(private readonly actors: CreatorWorkspaceActorService) {}

  @Get("actor-context")
  @Header("Cache-Control", "no-store")
  async current(@Req() request: RequestWithAuthUser) {
    const context = await this.actors.resolve(request.user);
    return {
      actor_user_id: context.actorUserId,
      actor_membership_id: context.actorMembershipId,
      actor_role: context.actorRole,
      workspace_id: context.workspaceId,
      organization_id: context.organizationId,
      subject_creator_profile_id: context.subjectCreatorProfileId,
      subject_owner_user_id: context.subjectOwnerUserId,
      allowed_actions: context.allowedActions,
    };
  }
}

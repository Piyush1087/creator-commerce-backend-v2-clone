import { ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { assertCreatorWorkspaceAction } from "../../creator-settings/team/creator-team.policy";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import type { CreatorPayoutsAuthorizationScope } from "../contracts/creator-payouts.contract";

@Injectable()
export class CreatorPayoutsAuthorizationService {
  constructor(private readonly actors: CreatorWorkspaceActorService) {}

  async resolve(user: AuthUser): Promise<CreatorPayoutsAuthorizationScope> {
    const actor = await this.actors.resolveReadOnly(user);
    assertCreatorWorkspaceAction(actor.allowedActions, "PAYOUT_WORKSPACE_READ");
    if (actor.actorRole === "ASSISTANT") {
      throw new ForbiddenException({
        code: "CREATOR_PAYOUTS_FORBIDDEN",
        message: "Creator payout workspace access is not permitted.",
      });
    }
    return {
      workspaceId: actor.workspaceId,
      organizationId: actor.organizationId,
      subjectCreatorProfileId: actor.subjectCreatorProfileId,
      subjectOwnerUserId: actor.subjectOwnerUserId,
      membershipId: actor.actorMembershipId,
      actorRole: actor.actorRole,
      authorizationVersion:
        actor.authorizationVersion ?? `membership:${actor.actorMembershipId}`,
    };
  }
}

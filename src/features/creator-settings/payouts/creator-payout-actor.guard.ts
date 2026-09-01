import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";

import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import { CREATOR_WORKSPACE_ACTOR_RESOLVER } from "./creator-payout-settings.types";

export interface CreatorWorkspaceActorResolver {
  resolve(user: AuthUser): Promise<CreatorWorkspaceActorContext>;
}

export type CreatorPayoutActorRequest = {
  user: AuthUser;
  creatorWorkspaceActor?: CreatorWorkspaceActorContext;
};

/** P2 must bind this guard's resolver token to P1B's canonical resolver. */
@Injectable()
export class CreatorPayoutActorGuard implements CanActivate {
  constructor(
    @Inject(CREATOR_WORKSPACE_ACTOR_RESOLVER)
    private readonly resolver: CreatorWorkspaceActorResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<CreatorPayoutActorRequest>();
    request.creatorWorkspaceActor = await this.resolver.resolve(request.user);
    return true;
  }
}

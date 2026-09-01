import type { AuthUser } from "../../auth/types/auth-user";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";

/**
 * P1C consumes the canonical actor/subject boundary without owning it.
 * P1B supplies the implementation when the checkpoint streams converge.
 */
export const CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT = Symbol(
  "CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT",
);

export interface CreatorInstagramSettingsActorPort {
  resolve(user: AuthUser): Promise<CreatorWorkspaceActorContext>;
}

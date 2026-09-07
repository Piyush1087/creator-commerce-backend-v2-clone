export const CREATOR_WORKSPACE_ACTIONS = [
  "WORKSPACE_PROFILE_READ",
  "WORKSPACE_PROFILE_MANAGE",
  "CONTACT_READ",
  "CONTACT_MANAGE",
  "TEAM_READ",
  "TEAM_MANAGE",
  "INSTAGRAM_SETTINGS_READ",
  "INSTAGRAM_SETTINGS_MANAGE",
  "PAYOUT_SETTINGS_READ",
  "PAYOUT_SETTINGS_MANAGE",
  "LEGAL_PROFILE_READ",
  "LEGAL_PROFILE_MANAGE",
] as const;

export type CreatorWorkspaceAction = (typeof CREATOR_WORKSPACE_ACTIONS)[number];

export type CreatorWorkspaceActorRole = "OWNER" | "MANAGER" | "ASSISTANT";

/**
 * Shared C-05 identity boundary. The authenticated Team member is the actor;
 * the canonical Owner Creator remains the business subject.
 *
 * associatedEmail is deliberately absent: it is compatibility evidence, not
 * authorization authority.
 */
export type CreatorWorkspaceActorContext = {
  readonly actorUserId: string;
  readonly actorMembershipId: string;
  readonly actorRole: CreatorWorkspaceActorRole;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly subjectCreatorProfileId: string;
  readonly subjectOwnerUserId: string;
  readonly allowedActions: readonly CreatorWorkspaceAction[];
};

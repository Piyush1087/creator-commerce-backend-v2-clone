import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  Prisma,
  WorkspaceInvitationStatus,
  type CreatorWorkspaceInvitation,
} from "@prisma/client";

import {
  CREATOR_WORKSPACE_ACTIONS,
  type CreatorWorkspaceAction,
  type CreatorWorkspaceActorRole,
} from "../../../shared/creator/creator-workspace-actor.contract";
import type { CreatorTeamAssignableRole } from "./creator-team.schema";

export const CREATOR_TEAM_MAX_SEATS = 5;

export function assertCreatorTeamSeatCapacity(
  activeMembers: number,
  pendingInvitations: number,
): void {
  if (activeMembers + pendingInvitations >= CREATOR_TEAM_MAX_SEATS) {
    throw new BadRequestException(
      "Workspace seat capacity fully exhausted (5/5).",
    );
  }
}

const OWNER_ACTIONS: readonly CreatorWorkspaceAction[] =
  CREATOR_WORKSPACE_ACTIONS;

const MANAGER_ACTIONS: readonly CreatorWorkspaceAction[] = OWNER_ACTIONS;
const ASSISTANT_ACTIONS: readonly CreatorWorkspaceAction[] = [];

export function creatorWorkspaceActionsForRole(
  role: CreatorWorkspaceActorRole,
): readonly CreatorWorkspaceAction[] {
  if (role === CreatorTeamRole.OWNER) return OWNER_ACTIONS;
  if (role === CreatorTeamRole.MANAGER) return MANAGER_ACTIONS;
  return ASSISTANT_ACTIONS;
}

export function assertCreatorWorkspaceAction(
  allowedActions: readonly CreatorWorkspaceAction[],
  action: CreatorWorkspaceAction,
): void {
  if (!allowedActions.includes(action)) {
    throw new ForbiddenException(`Creator workspace action denied: ${action}`);
  }
}

export function assertCreatorTeamManager(role: CreatorTeamRole): void {
  if (role === CreatorTeamRole.OWNER || role === CreatorTeamRole.MANAGER) {
    return;
  }
  throw new ForbiddenException(
    "Assistants cannot view or administer Creator Team settings.",
  );
}

export function assertAssignableCreatorTeamRole(
  role: CreatorTeamRole | CreatorTeamAssignableRole,
): asserts role is CreatorTeamAssignableRole {
  if (role === CreatorTeamRole.MANAGER || role === CreatorTeamRole.ASSISTANT) {
    return;
  }
  throw new BadRequestException(
    "Owner authority is established only by canonical Creator provisioning.",
  );
}

export function assertMutableCreatorTeamTarget(input: {
  actorUserId: string;
  targetUserId: string | null;
  targetRole: CreatorTeamRole;
  nextRole?: CreatorTeamRole | CreatorTeamAssignableRole;
}): void {
  if (input.targetRole === CreatorTeamRole.OWNER) {
    throw new ConflictException({
      code: "CREATOR_OWNER_PROTECTED",
      message:
        "The canonical Creator Owner cannot be removed or changed through Team settings.",
    });
  }
  if (input.nextRole) assertAssignableCreatorTeamRole(input.nextRole);
  if (input.targetUserId === input.actorUserId) {
    throw new BadRequestException(
      "You cannot change or remove your own Team membership.",
    );
  }
}

export async function lockCreatorTeam(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM creator_workspaces WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new NotFoundException("Creator workspace not found");
  }
}

export function effectiveCreatorInvitationStatus(
  invitation: Pick<
    CreatorWorkspaceInvitation,
    "invitationStatus" | "expiresAt"
  >,
  capturedNow: Date,
): WorkspaceInvitationStatus {
  if (
    invitation.invitationStatus === WorkspaceInvitationStatus.PENDING &&
    invitation.expiresAt.getTime() <= capturedNow.getTime()
  ) {
    return WorkspaceInvitationStatus.EXPIRED;
  }
  return invitation.invitationStatus;
}

/** Caller holds the CreatorWorkspace Team lock. */
export function expireCreatorTeamInvitations(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  capturedNow: Date,
) {
  return tx.creatorWorkspaceInvitation.updateMany({
    where: {
      workspaceId,
      invitationStatus: WorkspaceInvitationStatus.PENDING,
      expiresAt: { lte: capturedNow },
    },
    data: { invitationStatus: WorkspaceInvitationStatus.EXPIRED },
  });
}

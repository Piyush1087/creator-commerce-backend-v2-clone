import { Prisma, type TeamInvitation } from "@prisma/client";

export const TEAM_INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type CanonicalTeamInvitationStatus =
  (typeof TEAM_INVITATION_STATUS)[keyof typeof TEAM_INVITATION_STATUS];

export type EffectiveTeamInvitationStatus =
  | CanonicalTeamInvitationStatus
  | "UNKNOWN";

export function effectiveTeamInvitationStatus(
  invitation: Pick<TeamInvitation, "status" | "expiresAt">,
  capturedNow: Date,
): EffectiveTeamInvitationStatus {
  if (
    invitation.status === TEAM_INVITATION_STATUS.PENDING &&
    invitation.expiresAt.getTime() <= capturedNow.getTime()
  ) {
    return TEAM_INVITATION_STATUS.EXPIRED;
  }
  if (
    Object.values(TEAM_INVITATION_STATUS).includes(
      invitation.status as CanonicalTeamInvitationStatus,
    )
  ) {
    return invitation.status as CanonicalTeamInvitationStatus;
  }
  return "UNKNOWN";
}

/** Caller must hold the BrandProfile Team lock. */
export async function reconcileExpiredTeamInvitations(
  tx: Prisma.TransactionClient,
  brandProfileId: string,
  capturedNow: Date,
) {
  return tx.teamInvitation.updateMany({
    where: {
      brandProfileId,
      status: TEAM_INVITATION_STATUS.PENDING,
      expiresAt: { lte: capturedNow },
    },
    data: { status: TEAM_INVITATION_STATUS.EXPIRED },
  });
}

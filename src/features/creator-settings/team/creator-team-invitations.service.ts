import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  Prisma,
  UserAuthState,
  UserRole,
  WorkspaceInvitationStatus,
} from "@prisma/client";

import { MailService } from "../../../mail/mail.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { lockCanonicalIdentityEmail } from "../../../shared/identity/sterile-provisional-creator.policy";
import { normalizeEmail } from "../../../shared/identity/normalize-email";
import {
  generateTeamInvitationToken,
  hashTeamInvitationToken,
  teamInvitationDigestCandidates,
} from "../../../shared/team/team-invitation-token";
import type { AuthUser } from "../../auth/types/auth-user";
import type { InviteCreatorTeamMemberInput } from "./creator-team.schema";
import {
  assertAssignableCreatorTeamRole,
  assertCreatorTeamSeatCapacity,
  assertCreatorTeamManager,
  assertCreatorWorkspaceAction,
  CREATOR_TEAM_MAX_SEATS,
  effectiveCreatorInvitationStatus,
  expireCreatorTeamInvitations,
  lockCreatorTeam,
} from "./creator-team.policy";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

@Injectable()
export class CreatorTeamInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
    private readonly mail: MailService,
  ) {}

  async create(actor: AuthUser, input: InviteCreatorTeamMemberInput) {
    const initial = await this.actors.resolve(actor);
    const email = normalizeEmail(input.recipientEmail);
    assertAssignableCreatorTeamRole(input.allocatedRole);

    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, initial.workspaceId);
        const context = await this.actors.resolveInTransaction(
          tx,
          actor,
          initial.workspaceId,
        );
        assertCreatorWorkspaceAction(context.allowedActions, "TEAM_MANAGE");
        assertCreatorTeamManager(context.actorRole);

        const capturedNow = new Date();
        await expireCreatorTeamInvitations(
          tx,
          context.workspaceId,
          capturedNow,
        );
        const workspace = await tx.creatorWorkspace.findUniqueOrThrow({
          where: { id: context.workspaceId },
          select: { organization: { select: { name: true } } },
        });

        // Email is used only to prevent duplicate admission metadata. It never
        // resolves an actor or grants workspace authority.
        const conflictingMember = await tx.creatorWorkspaceMember.findFirst({
          where: {
            workspaceId: context.workspaceId,
            OR: [
              { user: { normalizedEmail: email } },
              { associatedEmail: { equals: email, mode: "insensitive" } },
            ],
          },
        });
        if (conflictingMember?.userId === null) {
          throw new ConflictException({
            code: "CREATOR_TEAM_LEGACY_IDENTITY_UNRESOLVED",
            message:
              "An unresolved historical Team row uses this email. Contact support before inviting it.",
          });
        }
        if (conflictingMember?.isActive) {
          throw new ConflictException(
            "This account is already an active Team member.",
          );
        }

        const pendingDuplicate = await tx.creatorWorkspaceInvitation.findFirst({
          where: {
            workspaceId: context.workspaceId,
            recipientEmail: { equals: email, mode: "insensitive" },
            invitationStatus: WorkspaceInvitationStatus.PENDING,
            expiresAt: { gt: capturedNow },
          },
        });
        if (pendingDuplicate) {
          throw new ConflictException(
            "A pending invitation already exists for this email.",
          );
        }

        const [activeMembers, pendingInvitations] = await Promise.all([
          tx.creatorWorkspaceMember.count({
            where: { workspaceId: context.workspaceId, isActive: true },
          }),
          tx.creatorWorkspaceInvitation.count({
            where: {
              workspaceId: context.workspaceId,
              invitationStatus: WorkspaceInvitationStatus.PENDING,
              expiresAt: { gt: capturedNow },
            },
          }),
        ]);
        assertCreatorTeamSeatCapacity(activeMembers, pendingInvitations);

        const rawToken = generateTeamInvitationToken();
        const expiresAt = new Date(
          capturedNow.getTime() + 7 * 24 * 60 * 60 * 1000,
        );
        const invitation = await tx.creatorWorkspaceInvitation.create({
          data: {
            workspaceId: context.workspaceId,
            recipientEmail: email,
            allocatedRole: input.allocatedRole,
            secureTokenHash: hashTeamInvitationToken(rawToken),
            expiresAt,
          },
        });

        try {
          await this.mail.sendCreatorTeamInvitation({
            email,
            workspaceName: workspace.organization.name,
            role: input.allocatedRole,
            expiresAt,
            rawToken,
          });
        } catch {
          // Roll back the row. Provider exceptions may include the token-bearing
          // payload, so they are never propagated or logged here.
          throw new ServiceUnavailableException(
            "Invitation email could not be dispatched. No active invitation was created; please try again.",
          );
        }

        return {
          invitation_id: invitation.id,
          email,
          role: invitation.allocatedRole,
          expires_at: expiresAt.toISOString(),
          delivery_status: "DISPATCHED" as const,
        };
      },
      { timeout: 20_000 },
    );
  }

  async inspect(rawToken: string) {
    const initial = await this.lookup(this.prisma, rawToken);
    return this.prisma.$transaction(async (tx) => {
      await lockCreatorTeam(tx, initial.workspaceId);
      const capturedNow = new Date();
      await expireCreatorTeamInvitations(tx, initial.workspaceId, capturedNow);
      const invitation = await this.lookup(tx, rawToken);
      this.assertPending(invitation, capturedNow);
      const workspace = await tx.creatorWorkspace.findUniqueOrThrow({
        where: { id: invitation.workspaceId },
        select: { organization: { select: { name: true } } },
      });
      const existingUser = await tx.user.findUnique({
        where: { normalizedEmail: normalizeEmail(invitation.recipientEmail) },
        select: { role: true, authState: true },
      });
      return {
        workspace_name: workspace.organization.name,
        email: invitation.recipientEmail,
        role: invitation.allocatedRole,
        expires_at: invitation.expiresAt.toISOString(),
        requires_existing_creator_account: !(
          existingUser?.role === UserRole.CREATOR &&
          existingUser.authState === UserAuthState.ACTIVE
        ),
      };
    });
  }

  async accept(actor: AuthUser, rawToken: string) {
    const initial = await this.lookup(this.prisma, rawToken);
    return this.prisma.$transaction(
      async (tx) => {
        await lockCreatorTeam(tx, initial.workspaceId);
        const capturedNow = new Date();
        await expireCreatorTeamInvitations(
          tx,
          initial.workspaceId,
          capturedNow,
        );
        const invitation = await this.lookup(tx, rawToken);
        this.assertPending(invitation, capturedNow);
        assertAssignableCreatorTeamRole(invitation.allocatedRole);

        const invitedEmail = normalizeEmail(invitation.recipientEmail);
        await lockCanonicalIdentityEmail(tx, invitedEmail);
        const existingUser = await tx.user.findUnique({
          where: { id: actor.id },
          include: { creatorProfile: { select: { id: true } } },
        });
        if (
          !existingUser ||
          existingUser.role !== UserRole.CREATOR ||
          existingUser.authState !== UserAuthState.ACTIVE ||
          existingUser.normalizedEmail !== invitedEmail ||
          normalizeEmail(actor.email) !== invitedEmail
        ) {
          throw new ForbiddenException(
            "Sign in with the active Creator account matching the invited email.",
          );
        }

        // associatedEmail only locates a uniqueness collision. The authenticated
        // direct userId must still match before an inactive row is reactivated.
        const admissionRows = await tx.creatorWorkspaceMember.findMany({
          where: {
            workspaceId: invitation.workspaceId,
            OR: [
              { userId: existingUser.id },
              {
                associatedEmail: {
                  equals: invitedEmail,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: { id: true, userId: true, isActive: true },
          take: 2,
        });
        const readmissionId = resolveCreatorTeamReadmission(
          admissionRows,
          existingUser.id,
        );

        const [activeMembers, pendingInvitations] = await Promise.all([
          tx.creatorWorkspaceMember.count({
            where: { workspaceId: invitation.workspaceId, isActive: true },
          }),
          tx.creatorWorkspaceInvitation.count({
            where: {
              workspaceId: invitation.workspaceId,
              invitationStatus: WorkspaceInvitationStatus.PENDING,
              expiresAt: { gt: capturedNow },
            },
          }),
        ]);
        if (
          activeMembers >= CREATOR_TEAM_MAX_SEATS ||
          activeMembers + pendingInvitations > CREATOR_TEAM_MAX_SEATS
        ) {
          throw new ConflictException(
            "Workspace seat capacity is no longer available.",
          );
        }

        const membership = readmissionId
          ? await tx.creatorWorkspaceMember.update({
              where: { id: readmissionId },
              data: {
                associatedEmail: invitedEmail,
                securityRole: invitation.allocatedRole,
                isActive: true,
                joinedAt: capturedNow,
              },
            })
          : await tx.creatorWorkspaceMember.create({
              data: {
                workspaceId: invitation.workspaceId,
                userId: existingUser.id,
                // Compatibility display metadata only; not authorization authority.
                associatedEmail: invitedEmail,
                securityRole: invitation.allocatedRole,
                isActive: true,
                joinedAt: capturedNow,
              },
            });
        const consumed = await tx.creatorWorkspaceInvitation.updateMany({
          where: {
            id: invitation.id,
            invitationStatus: WorkspaceInvitationStatus.PENDING,
            expiresAt: { gt: capturedNow },
          },
          data: { invitationStatus: WorkspaceInvitationStatus.ACCEPTED },
        });
        if (consumed.count !== 1) {
          throw new ConflictException("Invitation cannot be consumed.");
        }

        const context = await this.actors.resolveInTransaction(
          tx,
          actor,
          invitation.workspaceId,
        );
        return {
          accepted: true,
          membership_id: membership.id,
          workspace_id: context.workspaceId,
          subject_creator_profile_id: context.subjectCreatorProfileId,
          actor_role: context.actorRole,
        };
      },
      { timeout: 15_000 },
    );
  }

  private lookup(tx: Prisma.TransactionClient, rawToken: string) {
    const candidates = teamInvitationDigestCandidates(rawToken);
    return tx.creatorWorkspaceInvitation
      .findFirst({ where: { secureTokenHash: { in: candidates } } })
      .then((invitation) => {
        if (!invitation) {
          throw new NotFoundException({
            code: "INVITATION_INVALID",
            message: "Invalid invitation.",
          });
        }
        return invitation;
      });
  }

  private assertPending(
    invitation: Awaited<ReturnType<CreatorTeamInvitationsService["lookup"]>>,
    capturedNow: Date,
  ): void {
    const state = effectiveCreatorInvitationStatus(invitation, capturedNow);
    if (state === WorkspaceInvitationStatus.PENDING) return;
    if (state === WorkspaceInvitationStatus.ACCEPTED) {
      throw new ConflictException({
        code: "INVITATION_CONSUMED",
        message: "This invitation has already been accepted.",
      });
    }
    throw new GoneException({
      code: "INVITATION_EXPIRED",
      message: "This invitation has expired or was cancelled.",
    });
  }
}

export function resolveCreatorTeamReadmission(
  rows: ReadonlyArray<{ id: string; userId: string | null; isActive: boolean }>,
  acceptingUserId: string,
): string | null {
  if (rows.length > 1) {
    throw new ConflictException({
      code: "CREATOR_TEAM_IDENTITY_AMBIGUOUS",
      message: "Team identity is ambiguous. Contact support before acceptance.",
    });
  }
  const row = rows[0];
  if (!row) return null;
  if (row.userId === null) {
    throw new ConflictException({
      code: "CREATOR_TEAM_LEGACY_IDENTITY_UNRESOLVED",
      message:
        "Historical Team identity is unresolved. Contact support before accepting this invitation.",
    });
  }
  if (row.userId !== acceptingUserId) {
    throw new ConflictException({
      code: "CREATOR_TEAM_IDENTITY_MISMATCH",
      message: "Invitation identity does not match the historical Team member.",
    });
  }
  if (row.isActive) {
    throw new ConflictException(
      "This account is already an active Team member.",
    );
  }
  return row.id;
}

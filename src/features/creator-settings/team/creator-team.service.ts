import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  Prisma,
  WorkspaceInvitationStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { CreatorTeamAssignableRole } from "./creator-team.schema";
import {
  assertCreatorTeamManager,
  assertCreatorWorkspaceAction,
  assertMutableCreatorTeamTarget,
  CREATOR_TEAM_MAX_SEATS,
  expireCreatorTeamInvitations,
  lockCreatorTeam,
} from "./creator-team.policy";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

@Injectable()
export class CreatorTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: CreatorWorkspaceActorService,
  ) {}

  async list(actor: AuthUser) {
    const context = await this.actors.resolve(actor);
    assertCreatorWorkspaceAction(context.allowedActions, "TEAM_READ");
    assertCreatorTeamManager(context.actorRole);
    const capturedNow = new Date();

    const [workspace, members, invitations] = await Promise.all([
      this.prisma.creatorWorkspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
        select: { id: true, organization: { select: { name: true } } },
      }),
      this.prisma.creatorWorkspaceMember.findMany({
        where: { workspaceId: context.workspaceId, isActive: true },
        include: { user: true },
        orderBy: [{ securityRole: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.creatorWorkspaceInvitation.findMany({
        where: {
          workspaceId: context.workspaceId,
          invitationStatus: WorkspaceInvitationStatus.PENDING,
          expiresAt: { gt: capturedNow },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      actor: {
        user_id: context.actorUserId,
        membership_id: context.actorMembershipId,
        role: context.actorRole,
        allowed_actions: context.allowedActions,
      },
      workspace: {
        workspace_id: workspace.id,
        organization_name: workspace.organization.name,
        subject_creator_profile_id: context.subjectCreatorProfileId,
      },
      team: {
        members: members.map((member) => {
          const mutable =
            member.securityRole !== CreatorTeamRole.OWNER &&
            member.userId !== context.actorUserId;
          return {
            membership_id: member.id,
            user_id: member.userId,
            name: member.user?.name ?? null,
            email: member.user?.email ?? member.associatedEmail,
            role: member.securityRole,
            status: member.userId && member.user ? "ACTIVE" : "UNRESOLVED",
            is_current_actor: member.userId === context.actorUserId,
            is_owner: member.securityRole === CreatorTeamRole.OWNER,
            can_change_role: mutable,
            can_remove: mutable,
          };
        }),
        pending_invitations: invitations.map((invitation) => ({
          invitation_id: invitation.id,
          email: invitation.recipientEmail,
          role: invitation.allocatedRole,
          status: "PENDING" as const,
          expires_at: invitation.expiresAt.toISOString(),
          can_cancel: true,
        })),
        seat_usage: {
          active_members: members.length,
          pending_invitations: invitations.length,
          max_seats: CREATOR_TEAM_MAX_SEATS,
          is_at_capacity:
            members.length + invitations.length >= CREATOR_TEAM_MAX_SEATS,
        },
      },
    };
  }

  async updateRole(
    actor: AuthUser,
    membershipId: string,
    allocatedRole: CreatorTeamAssignableRole,
  ) {
    return this.mutate(actor, async (tx, context) => {
      const target = await tx.creatorWorkspaceMember.findFirst({
        where: {
          id: membershipId,
          workspaceId: context.workspaceId,
          isActive: true,
        },
      });
      if (!target) throw new NotFoundException("Team membership not found");
      assertMutableCreatorTeamTarget({
        actorUserId: context.actorUserId,
        targetUserId: target.userId,
        targetRole: target.securityRole,
        nextRole: allocatedRole,
      });
      const updated = await tx.creatorWorkspaceMember.update({
        where: { id: target.id },
        data: { securityRole: allocatedRole },
      });
      return { membership_id: updated.id, role: updated.securityRole };
    });
  }

  async remove(actor: AuthUser, membershipId: string) {
    return this.mutate(actor, async (tx, context) => {
      const target = await tx.creatorWorkspaceMember.findFirst({
        where: {
          id: membershipId,
          workspaceId: context.workspaceId,
          isActive: true,
        },
      });
      if (!target) throw new NotFoundException("Team membership not found");
      assertMutableCreatorTeamTarget({
        actorUserId: context.actorUserId,
        targetUserId: target.userId,
        targetRole: target.securityRole,
      });
      const removed = await tx.creatorWorkspaceMember.updateMany({
        where: {
          id: target.id,
          workspaceId: context.workspaceId,
          isActive: true,
          securityRole: { not: CreatorTeamRole.OWNER },
        },
        data: { isActive: false },
      });
      if (removed.count !== 1) {
        throw new ConflictException(
          "Team membership changed; refresh and retry.",
        );
      }
      return { removed: true, membership_id: target.id };
    });
  }

  async cancelInvitation(actor: AuthUser, invitationId: string) {
    return this.mutate(actor, async (tx, context) => {
      const capturedNow = new Date();
      await expireCreatorTeamInvitations(tx, context.workspaceId, capturedNow);
      const invitation = await tx.creatorWorkspaceInvitation.findFirst({
        where: { id: invitationId, workspaceId: context.workspaceId },
      });
      if (!invitation) throw new NotFoundException("Invitation not found");
      if (
        invitation.invitationStatus !== WorkspaceInvitationStatus.PENDING ||
        invitation.expiresAt.getTime() <= capturedNow.getTime()
      ) {
        throw new ConflictException("Invitation is no longer pending.");
      }
      const cancelled = await tx.creatorWorkspaceInvitation.updateMany({
        where: {
          id: invitation.id,
          workspaceId: context.workspaceId,
          invitationStatus: WorkspaceInvitationStatus.PENDING,
          expiresAt: { gt: capturedNow },
        },
        // The existing enum has no CANCELLED value. EXPIRED is the terminal,
        // non-authorizing compatibility state for both expiry and revocation.
        data: { invitationStatus: WorkspaceInvitationStatus.EXPIRED },
      });
      if (cancelled.count !== 1) {
        throw new ConflictException("Invitation changed; refresh and retry.");
      }
      return { cancelled: true, invitation_id: invitation.id };
    });
  }

  private async mutate<T>(
    actor: AuthUser,
    operation: (
      tx: Prisma.TransactionClient,
      context: Awaited<ReturnType<CreatorWorkspaceActorService["resolve"]>>,
    ) => Promise<T>,
  ): Promise<T> {
    const initial = await this.actors.resolve(actor);
    return this.prisma.$transaction(async (tx) => {
      await lockCreatorTeam(tx, initial.workspaceId);
      const context = await this.actors.resolveInTransaction(
        tx,
        actor,
        initial.workspaceId,
      );
      assertCreatorWorkspaceAction(context.allowedActions, "TEAM_MANAGE");
      assertCreatorTeamManager(context.actorRole);
      return operation(tx, context);
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { UpdateTeamRoleInput } from "../schemas/brand-settings.schema";
import {
  assertTeamAuthority,
  canonicalInvitationRole,
  lockBrandTeam,
  protectOrganizationalAnchor,
  requireTeamActor,
} from "../team/brand-team-policy";
import {
  effectiveTeamInvitationStatus,
  reconcileExpiredTeamInvitations,
  TEAM_INVITATION_STATUS,
} from "../team/team-invitation-lifecycle";
import { BrandSettingsAccessService } from "./brand-settings-access.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";

@Injectable()
export class BrandTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
    private readonly notifications?: NotificationDispatchService,
  ) {}

  private async mutate<T>(
    actor: AuthUser,
    action: (
      tx: Prisma.TransactionClient,
      brandProfileId: string,
      role: Awaited<ReturnType<typeof requireTeamActor>>["role"],
    ) => Promise<T>,
  ) {
    const { brandProfileId } = await this.access.resolveBrandContext(actor);
    return this.prisma.$transaction(async (tx) => {
      await lockBrandTeam(tx, brandProfileId);
      const member = await requireTeamActor(tx, brandProfileId, actor);
      return action(tx, brandProfileId, member.role);
    });
  }

  updateRole(actor: AuthUser, input: UpdateTeamRoleInput) {
    return this.mutate(actor, async (tx, brandProfileId, role) => {
      const target = await tx.brandTeamMember.findFirst({
        where: { id: input.membershipId, brandProfileId, isActive: true },
      });
      if (!target) throw new NotFoundException("Team membership not found");
      assertTeamAuthority(role, target.role, input.role);
      if (target.role !== input.role && target.role === "BRAND_OWNER")
        await protectOrganizationalAnchor(tx, brandProfileId, target.id);
      const updated = await tx.brandTeamMember.update({
        where: { id: target.id },
        data: { role: input.role },
        include: { user: true },
      });
      return {
        membership_id: updated.id,
        user_id: updated.userId,
        email: updated.user.email,
        role: updated.role,
      };
    });
  }

  revoke(actor: AuthUser, membershipId: string) {
    return this.mutate(actor, async (tx, brandProfileId, role) => {
      const target = await tx.brandTeamMember.findFirst({
        where: { id: membershipId, brandProfileId, isActive: true },
      });
      if (!target) throw new NotFoundException("Team membership not found");
      assertTeamAuthority(role, target.role);
      if (target.userId === actor.id)
        throw new BadRequestException("You cannot revoke your own access.");
      if (target.role === "BRAND_OWNER")
        await protectOrganizationalAnchor(tx, brandProfileId, target.id);
      const revoked = await tx.brandTeamMember.update({
        where: { id: target.id },
        data: { isActive: false },
      });
      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: brandProfileId,
        eventType: "team.member_access_revoked",
        source: {
          sourceType: "brand_team_membership",
          sourceId: revoked.id,
          transitionId: `revoked:${revoked.updatedAt.toISOString()}`,
        },
        payload: {},
        triggerUserId: actor.id,
        affectedUserId: revoked.userId,
      });
      return { revoked: true, membership_id: membershipId };
    });
  }

  async cancel(actor: AuthUser, invitationId: string) {
    const outcome = await this.mutate(
      actor,
      async (tx, brandProfileId, role) => {
        const capturedNow = new Date();
        await reconcileExpiredTeamInvitations(tx, brandProfileId, capturedNow);
        const invite = await tx.teamInvitation.findFirst({
          where: { id: invitationId, brandProfileId },
        });
        if (!invite) return { kind: "NOT_FOUND" as const };
        assertTeamAuthority(role, canonicalInvitationRole(invite.role));
        const state = effectiveTeamInvitationStatus(invite, capturedNow);
        if (state !== TEAM_INVITATION_STATUS.PENDING)
          return { kind: "TERMINAL" as const, state };
        const result = await tx.teamInvitation.updateMany({
          where: {
            id: invite.id,
            status: TEAM_INVITATION_STATUS.PENDING,
            expiresAt: { gt: capturedNow },
          },
          data: { status: TEAM_INVITATION_STATUS.CANCELLED },
        });
        if (result.count !== 1) return { kind: "CONFLICT" as const };
        return {
          kind: "CANCELLED" as const,
          value: { cancelled: true, invitation_id: invitationId },
        };
      },
    );
    if (outcome.kind === "CANCELLED") return outcome.value;
    if (outcome.kind === "NOT_FOUND")
      throw new NotFoundException("Invitation not found");
    if (outcome.kind === "CONFLICT")
      throw new ConflictException("Invitation already consumed");
    throw new ConflictException({
      code: "INVITATION_NOT_PENDING",
      message: `Invitation is already ${outcome.state.toLowerCase()}.`,
    });
  }
}

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
  protectLastOwner,
  requireTeamActor,
} from "../team/brand-team-policy";
import { BrandSettingsAccessService } from "./brand-settings-access.service";

@Injectable()
export class BrandTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
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
      if (target.role !== input.role)
        await protectLastOwner(tx, brandProfileId, target.role);
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
      await protectLastOwner(tx, brandProfileId, target.role);
      await tx.brandTeamMember.update({
        where: { id: target.id },
        data: { isActive: false },
      });
      return { revoked: true, membership_id: membershipId };
    });
  }

  cancel(actor: AuthUser, invitationId: string) {
    return this.mutate(actor, async (tx, brandProfileId, role) => {
      const invite = await tx.teamInvitation.findFirst({
        where: { id: invitationId, brandProfileId, status: "PENDING" },
      });
      if (!invite) throw new NotFoundException("Pending invitation not found");
      assertTeamAuthority(role, canonicalInvitationRole(invite.role));
      const result = await tx.teamInvitation.updateMany({
        where: { id: invite.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (result.count !== 1)
        throw new ConflictException("Invitation already consumed");
      return { cancelled: true, invitation_id: invitationId };
    });
  }
}

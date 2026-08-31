import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreatorTeamRole, OrganizationKind, UserRole } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";

export const CREATOR_SETTINGS_MAX_SEATS = 5;

const WORKSPACE_ADMIN_ROLES: CreatorTeamRole[] = [
  CreatorTeamRole.OWNER,
  CreatorTeamRole.MANAGER,
];

@Injectable()
export class CreatorSettingsAccessService {
  constructor(private readonly prisma: PrismaService) {}

  assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }

  async resolveCreatorProfile(user: AuthUser) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new ConflictException({
        code: "CREATOR_CANONICAL_PROFILE_MISSING",
        message: "Creator provisioning is incomplete.",
      });
    }

    return profile;
  }

  async resolveWorkspace(creatorProfileId: string, _userEmail: string) {
    const workspace = await this.prisma.creatorWorkspace.findFirst({
      where: { ownerProfileId: creatorProfileId },
      include: {
        organization: true,
        ownerProfile: { include: { user: true } },
      },
    });

    if (!workspace) {
      throw new ConflictException({
        code: "CREATOR_CANONICAL_WORKSPACE_MISSING",
        message: "Creator workspace provisioning is incomplete.",
      });
    }

    if (
      workspace.organization.kind !== OrganizationKind.CREATOR ||
      workspace.ownerProfile.user.organizationId !== workspace.organizationId
    ) {
      throw new ConflictException({
        code: "CREATOR_CANONICAL_CONTEXT_INCONSISTENT",
        message: "Creator workspace context is inconsistent.",
      });
    }

    return workspace;
  }

  async resolveWorkspaceRole(
    workspaceId: string,
    user: AuthUser,
    creatorProfileId: string,
  ): Promise<CreatorTeamRole> {
    const member = await this.prisma.creatorWorkspaceMember.findFirst({
      where: {
        workspaceId,
        assignedProfileId: creatorProfileId,
        assignedProfile: { userId: user.id },
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenException("No active workspace membership found");
    }

    return member.securityRole;
  }

  assertWorkspaceAdmin(role: CreatorTeamRole): void {
    if (!WORKSPACE_ADMIN_ROLES.includes(role)) {
      throw new ForbiddenException(
        "Assistant profiles cannot modify workspace settings.",
      );
    }
  }

  assertPayoutMutation(role: CreatorTeamRole): void {
    if (role !== CreatorTeamRole.OWNER) {
      throw new ForbiddenException(
        "Only workspace owners can modify payout destinations.",
      );
    }
  }

  isAssistantReadOnly(role: CreatorTeamRole): boolean {
    return role === CreatorTeamRole.ASSISTANT;
  }

  async getWorkspaceMemberOrThrow(workspaceId: string, memberId: string) {
    const member = await this.prisma.creatorWorkspaceMember.findFirst({
      where: { id: memberId, workspaceId, isActive: true },
    });
    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }
    return member;
  }
}

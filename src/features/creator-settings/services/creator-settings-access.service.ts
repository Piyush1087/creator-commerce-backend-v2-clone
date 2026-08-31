import {
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

    let profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await this.prisma.creatorProfile.create({
        data: {
          userId: user.id,
          displayName: user.name,
        },
      });
    }

    return profile;
  }

  async resolveWorkspace(creatorProfileId: string, userEmail: string) {
    let workspace = await this.prisma.creatorWorkspace.findFirst({
      where: { ownerProfileId: creatorProfileId },
    });

    if (!workspace) {
      workspace = await this.prisma.$transaction(async (tx) => {
        const owner = await tx.creatorProfile.findUniqueOrThrow({
          where: { id: creatorProfileId },
          include: { user: true },
        });
        let organizationId = owner.user.organizationId;
        if (!organizationId) {
          const organization = await tx.organization.create({
            data: {
              name: owner.displayName ?? "My Creative Workspace",
              kind: OrganizationKind.CREATOR,
            },
          });
          organizationId = organization.id;
          await tx.user.update({
            where: { id: owner.userId },
            data: { organizationId },
          });
        }
        return tx.creatorWorkspace.create({
          data: {
            ownerProfileId: creatorProfileId,
            organizationId,
            organizationDisplayName: "My Creative Workspace",
            members: {
              create: {
                assignedProfileId: creatorProfileId,
                associatedEmail: userEmail.toLowerCase(),
                securityRole: CreatorTeamRole.OWNER,
                isActive: true,
                joinedAt: new Date(),
              },
            },
          },
        });
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
        OR: [
          { assignedProfileId: creatorProfileId },
          { associatedEmail: user.email.toLowerCase() },
        ],
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

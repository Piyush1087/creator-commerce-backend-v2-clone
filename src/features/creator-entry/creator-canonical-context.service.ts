import { ConflictException, Injectable } from "@nestjs/common";
import {
  CreatorTeamRole,
  OrganizationKind,
  Prisma,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";

export type CanonicalCreatorContext = {
  userId: string;
  creatorProfileId: string;
};

type CanonicalCreatorRecord = {
  authState: UserAuthState;
  organizationId: string | null;
  organization: { kind: OrganizationKind } | null;
  creatorProfile: {
    id: string;
    ownedWorkspaces: Array<{
      ownerProfileId: string;
      organizationId: string;
      members: Array<{ assignedProfileId: string | null }>;
    }>;
  } | null;
};

/** Shared fail-closed authority for all Creator Entry provider operations. */
@Injectable()
export class CreatorCanonicalContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<CanonicalCreatorContext> {
    const user = await this.find(this.prisma, userId);
    if (!user || user.role !== UserRole.CREATOR) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.ACCOUNT_CONTEXT_CONFLICT,
        message: "Creator account context is required.",
      });
    }
    if (!this.isCanonical(user)) {
      throw new ConflictException({
        code: "CONTEXT_RECOVERY_REQUIRED",
        message: "Creator account context requires recovery.",
      });
    }
    return { userId: user.id, creatorProfileId: user.creatorProfile!.id };
  }

  async assertInTransaction(
    tx: Prisma.TransactionClient,
    expected: CanonicalCreatorContext,
  ): Promise<void> {
    const user = await this.find(tx, expected.userId);
    if (
      !user ||
      user.role !== UserRole.CREATOR ||
      user.creatorProfile?.id !== expected.creatorProfileId ||
      !this.isCanonical(user)
    ) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_AUTHORIZATION_STALE,
        message: "Instagram connection state changed. Start a new attempt.",
      });
    }
  }

  private find(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ) {
    return client.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        creatorProfile: {
          include: {
            ownedWorkspaces: {
              include: {
                members: {
                  where: {
                    isActive: true,
                    securityRole: CreatorTeamRole.OWNER,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private isCanonical(user: CanonicalCreatorRecord): boolean {
    const profile = user.creatorProfile;
    const workspaces = profile?.ownedWorkspaces ?? [];
    const workspace = workspaces[0];
    return Boolean(
      user.authState === UserAuthState.ACTIVE &&
      user.organizationId &&
      user.organization?.kind === OrganizationKind.CREATOR &&
      profile &&
      workspaces.length === 1 &&
      workspace.ownerProfileId === profile.id &&
      workspace.organizationId === user.organizationId &&
      workspace.members.length === 1 &&
      workspace.members[0].assignedProfileId === profile.id,
    );
  }
}

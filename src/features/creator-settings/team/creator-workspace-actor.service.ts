import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  OrganizationKind,
  Prisma,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import { creatorWorkspaceActionsForRole } from "./creator-team.policy";

const workspaceIdentityInclude = {
  organization: true,
  ownerProfile: { include: { user: true } },
} satisfies Prisma.CreatorWorkspaceInclude;

type WorkspaceIdentity = Prisma.CreatorWorkspaceGetPayload<{
  include: typeof workspaceIdentityInclude;
}>;

@Injectable()
export class CreatorWorkspaceActorService {
  constructor(private readonly prisma: PrismaService) {}

  resolve(
    actor: AuthUser,
    workspaceId?: string,
  ): Promise<CreatorWorkspaceActorContext> {
    return this.prisma.$transaction((tx) =>
      this.resolveInTransaction(tx, actor, workspaceId),
    );
  }

  async resolveInTransaction(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    workspaceId?: string,
  ): Promise<CreatorWorkspaceActorContext> {
    if (actor.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }

    const actorUser = await tx.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, authState: true },
    });
    if (
      !actorUser ||
      actorUser.role !== UserRole.CREATOR ||
      actorUser.authState !== UserAuthState.ACTIVE
    ) {
      throw new ForbiddenException("An active Creator account is required");
    }

    const ownedWorkspaces = await tx.creatorWorkspace.findMany({
      where: {
        ...(workspaceId ? { id: workspaceId } : {}),
        ownerProfile: { userId: actor.id },
      },
      include: workspaceIdentityInclude,
      take: 2,
    });
    if (ownedWorkspaces.length > 1) {
      throw new ConflictException({
        code: "CREATOR_WORKSPACE_SELECTION_REQUIRED",
        message: "Creator workspace selection is ambiguous.",
      });
    }

    // Compatibility reconciliation only: old Owner rows are bound through the
    // canonical ownerProfile.userId relationship, never email metadata.
    if (ownedWorkspaces[0]) {
      await this.ensureCanonicalOwnerMembership(tx, ownedWorkspaces[0]);
    }

    const selectedWorkspaceId = ownedWorkspaces[0]?.id ?? workspaceId;
    const memberships = await tx.creatorWorkspaceMember.findMany({
      where: {
        userId: actor.id,
        isActive: true,
        ...(selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}),
      },
      include: {
        workspace: { include: workspaceIdentityInclude },
      },
      take: 2,
    });

    if (memberships.length === 0) {
      throw new ForbiddenException("No active Creator workspace membership");
    }
    if (memberships.length > 1) {
      throw new ConflictException({
        code: "CREATOR_WORKSPACE_SELECTION_REQUIRED",
        message: "Select one Creator workspace before continuing.",
      });
    }

    const membership = memberships[0];
    const workspace = membership.workspace;
    await this.ensureCanonicalOwnerMembership(tx, workspace);
    this.assertCanonicalSubject(workspace);

    if (
      membership.securityRole === CreatorTeamRole.OWNER &&
      (membership.userId !== workspace.ownerProfile.userId ||
        membership.assignedProfileId !== workspace.ownerProfileId)
    ) {
      throw new ConflictException({
        code: "CREATOR_OWNER_MEMBERSHIP_INCONSISTENT",
        message: "Creator Owner authority is inconsistent.",
      });
    }

    return {
      actorUserId: actor.id,
      actorMembershipId: membership.id,
      actorRole: membership.securityRole,
      workspaceId: workspace.id,
      organizationId: workspace.organizationId,
      subjectCreatorProfileId: workspace.ownerProfileId,
      subjectOwnerUserId: workspace.ownerProfile.userId,
      allowedActions: creatorWorkspaceActionsForRole(membership.securityRole),
    };
  }

  private assertCanonicalSubject(workspace: WorkspaceIdentity): void {
    const owner = workspace.ownerProfile.user;
    if (
      workspace.organization.kind !== OrganizationKind.CREATOR ||
      owner.role !== UserRole.CREATOR ||
      owner.authState !== UserAuthState.ACTIVE ||
      owner.organizationId !== workspace.organizationId
    ) {
      throw new ConflictException({
        code: "CREATOR_CANONICAL_CONTEXT_INCONSISTENT",
        message: "Creator workspace subject context is inconsistent.",
      });
    }
  }

  private async ensureCanonicalOwnerMembership(
    tx: Prisma.TransactionClient,
    workspace: WorkspaceIdentity,
  ): Promise<void> {
    const owners = await tx.creatorWorkspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
        securityRole: CreatorTeamRole.OWNER,
        isActive: true,
      },
      take: 2,
    });
    if (owners.length !== 1) {
      throw new ConflictException({
        code: "CREATOR_ONE_OWNER_INVARIANT_VIOLATED",
        message: "Creator workspace must have exactly one active Owner.",
      });
    }

    const ownerMembership = owners[0];
    if (ownerMembership.assignedProfileId !== workspace.ownerProfileId) {
      throw new ConflictException({
        code: "CREATOR_OWNER_MEMBERSHIP_INCONSISTENT",
        message: "Creator Owner membership does not match the subject profile.",
      });
    }

    if (ownerMembership.userId === null) {
      try {
        const bound = await tx.creatorWorkspaceMember.updateMany({
          where: {
            id: ownerMembership.id,
            workspaceId: workspace.id,
            assignedProfileId: workspace.ownerProfileId,
            securityRole: CreatorTeamRole.OWNER,
            isActive: true,
            userId: null,
          },
          data: { userId: workspace.ownerProfile.userId },
        });
        if (bound.count !== 1) {
          const concurrentlyBound = await tx.creatorWorkspaceMember.findUnique({
            where: { id: ownerMembership.id },
            select: { userId: true },
          });
          if (concurrentlyBound?.userId !== workspace.ownerProfile.userId) {
            throw new Error("Owner membership changed during reconciliation");
          }
        }
      } catch {
        throw new ConflictException({
          code: "CREATOR_OWNER_IDENTITY_RECONCILIATION_REQUIRED",
          message: "Creator Owner identity requires support reconciliation.",
        });
      }
      return;
    }

    if (ownerMembership.userId !== workspace.ownerProfile.userId) {
      throw new ConflictException({
        code: "CREATOR_OWNER_MEMBERSHIP_INCONSISTENT",
        message: "Creator Owner identity does not match the subject profile.",
      });
    }
  }
}

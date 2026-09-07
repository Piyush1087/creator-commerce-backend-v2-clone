import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  CreatorTeamRole,
  OrganizationKind,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

const ownerUser = {
  id: "owner-user",
  role: UserRole.CREATOR,
  authState: UserAuthState.ACTIVE,
  organizationId: "creator-organization",
};
const workspace = {
  id: "creator-workspace",
  ownerProfileId: "subject-profile",
  organizationId: "creator-organization",
  organizationDisplayName: "Creator Studio",
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: {
    id: "creator-organization",
    name: "Creator Studio",
    kind: OrganizationKind.CREATOR,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  ownerProfile: {
    id: "subject-profile",
    userId: ownerUser.id,
    user: ownerUser,
  },
};

function authUser(id: string): AuthUser {
  return {
    id,
    email: `${id}@example.test`,
    name: id,
    role: UserRole.CREATOR,
    organizationId: null,
  };
}

function directMember(role: CreatorTeamRole, userId: string) {
  return {
    id: `${role.toLowerCase()}-membership`,
    workspaceId: workspace.id,
    assignedProfileId:
      role === CreatorTeamRole.OWNER ? workspace.ownerProfileId : null,
    userId,
    associatedEmail: `${userId}@example.test`,
    securityRole: role,
    isActive: true,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace,
  };
}

function serviceFixture(input: {
  actorId: string;
  role: CreatorTeamRole;
  active?: boolean;
  directIdentity?: boolean;
  ownerCount?: number;
}) {
  const member = directMember(input.role, input.actorId);
  member.isActive = input.active ?? true;
  if (input.directIdentity === false) member.userId = null as unknown as string;
  const canonicalOwner = directMember(CreatorTeamRole.OWNER, ownerUser.id);
  const owners = Array.from({ length: input.ownerCount ?? 1 }, (_, index) =>
    index === 0
      ? canonicalOwner
      : { ...canonicalOwner, id: `duplicate-owner-${index}` },
  );
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: input.actorId,
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
      }),
    },
    creatorWorkspace: { findMany: vi.fn().mockResolvedValue([]) },
    creatorWorkspaceMember: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(
          input.directIdentity === false || input.active === false
            ? []
            : [member],
        )
        .mockResolvedValueOnce(owners),
      updateMany: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    ),
  } as unknown as PrismaService;
  return { service: new CreatorWorkspaceActorService(prisma), tx };
}

describe("C05 Creator subject/actor resolution", () => {
  it.each([
    [CreatorTeamRole.OWNER, 12],
    [CreatorTeamRole.MANAGER, 12],
    [CreatorTeamRole.ASSISTANT, 0],
  ])(
    "projects %s with its exact Settings capabilities",
    async (role, count) => {
      const actorId =
        role === CreatorTeamRole.OWNER ? ownerUser.id : `${role}-user`;
      const { service } = serviceFixture({ actorId, role });
      const context = await service.resolve(authUser(actorId));
      expect(context.actorUserId).toBe(actorId);
      expect(context.actorRole).toBe(role);
      expect(context.subjectCreatorProfileId).toBe(workspace.ownerProfileId);
      expect(context.subjectOwnerUserId).toBe(ownerUser.id);
      expect(
        context.allowedActions.filter(
          (action) => !action.startsWith("CAMPAIGN_"),
        ),
      ).toHaveLength(count);
      expect(context.allowedActions).toContain("CAMPAIGN_OPPORTUNITY_VIEW");
      expect(context.allowedActions).toContain("CAMPAIGN_APPLICATION_APPLY");
      expect(
        context.allowedActions.includes(
          "CAMPAIGN_APPLICATION_WITHDRAW_PENDING",
        ),
      ).toBe(role !== CreatorTeamRole.ASSISTANT);
    },
  );

  it.each([
    ["email-only", false, true],
    ["inactive", true, false],
  ])(
    "fails closed for %s membership identity",
    async (_label, directIdentity, active) => {
      const { service } = serviceFixture({
        actorId: "assistant-user",
        role: CreatorTeamRole.ASSISTANT,
        directIdentity,
        active,
      });
      const operation = service.resolve(authUser("assistant-user"));
      await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
      await operation.catch((error: ForbiddenException) =>
        expect(error.getStatus()).toBe(403),
      );
    },
  );

  it("fails closed when more than one active Owner exists", async () => {
    const { service } = serviceFixture({
      actorId: "manager-user",
      role: CreatorTeamRole.MANAGER,
      ownerCount: 2,
    });
    await expect(
      service.resolve(authUser("manager-user")),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("binds a legacy Owner only through canonical owner profile identity", async () => {
    const legacyOwner = {
      ...directMember(CreatorTeamRole.OWNER, ownerUser.id),
      userId: null,
    };
    const canonicalOwner = directMember(CreatorTeamRole.OWNER, ownerUser.id);
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: ownerUser.id,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
        }),
      },
      creatorWorkspace: { findMany: vi.fn().mockResolvedValue([workspace]) },
      creatorWorkspaceMember: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([legacyOwner])
          .mockResolvedValueOnce([canonicalOwner])
          .mockResolvedValueOnce([canonicalOwner]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        (operation: (transaction: typeof tx) => Promise<unknown>) =>
          operation(tx),
      ),
    } as unknown as PrismaService;
    const service = new CreatorWorkspaceActorService(prisma);
    const context = await service.resolve(authUser(ownerUser.id));
    expect(context.actorRole).toBe(CreatorTeamRole.OWNER);
    expect(tx.creatorWorkspaceMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedProfileId: workspace.ownerProfileId,
          userId: null,
        }),
        data: { userId: ownerUser.id },
      }),
    );
  });
});

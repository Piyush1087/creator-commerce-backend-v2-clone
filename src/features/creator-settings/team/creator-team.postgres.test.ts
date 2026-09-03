import "reflect-metadata";
import { randomUUID } from "node:crypto";
import {
  CreatorTeamRole,
  PrismaClient,
  UserAuthState,
  UserRole,
  WorkspaceInvitationStatus,
} from "@prisma/client";
import type { ServerClient } from "postmark";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { MailService } from "../../../mail/mail.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import { hashTeamInvitationToken } from "../../../shared/team/team-invitation-token";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorTeamInvitationsService } from "./creator-team-invitations.service";
import { CreatorTeamService } from "./creator-team.service";
import { CreatorWorkspaceActorService } from "./creator-workspace-actor.service";

describe.skipIf(process.env.C05_TEAM_DATABASE_TEST !== "true")(
  "C05 P1B real-PostgreSQL environment-gated acceptance",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(db);
    const send = vi.fn().mockResolvedValue({ ErrorCode: 0 });
    const mail = new MailService({
      sendEmailWithTemplate: send,
    } as unknown as ServerClient);
    const invitations = new CreatorTeamInvitationsService(db, actors, mail);
    const team = new CreatorTeamService(db, actors);
    const workspaceIds: string[] = [];
    const profileIds: string[] = [];
    const userIds: string[] = [];
    const organizationIds: string[] = [];

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/c05_")
      ) {
        throw new Error(
          "C05 Team tests require a disposable loopback c05_* database.",
        );
      }
      vi.stubEnv("POSTMARK_TEAM_INVITE_TEMPLATE_ID", "1");
      vi.stubEnv("APP_FRONTEND_URL", "http://localhost:5173");
    });

    beforeEach(() => {
      send.mockReset().mockResolvedValue({ ErrorCode: 0 });
    });

    afterAll(async () => {
      try {
        await prisma.creatorWorkspaceInvitation.deleteMany({
          where: { workspaceId: { in: workspaceIds } },
        });
        await prisma.creatorWorkspaceMember.deleteMany({
          where: { workspaceId: { in: workspaceIds } },
        });
        await prisma.creatorWorkspace.deleteMany({
          where: { id: { in: workspaceIds } },
        });
        await prisma.creatorProfile.deleteMany({
          where: { id: { in: profileIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.organization.deleteMany({
          where: { id: { in: organizationIds } },
        });
      } finally {
        await prisma.$disconnect();
        vi.unstubAllEnvs();
      }
    });

    const actor = (user: { id: string; email: string }): AuthUser => ({
      id: user.id,
      email: user.email,
      name: null,
      role: UserRole.CREATOR,
      organizationId: null,
    });

    async function createUser() {
      const organization = await prisma.organization.create({
        data: {
          name: `Invitee ${randomUUID()}`,
          kind: "CREATOR",
        },
      });
      organizationIds.push(organization.id);
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      userIds.push(user.id);
      return user;
    }

    async function createWorkspace() {
      const organization = await prisma.organization.create({
        data: {
          name: "Canonical Creator Studio",
          kind: "CREATOR",
        },
      });
      organizationIds.push(organization.id);
      const owner = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });
      userIds.push(owner.id);
      const profile = await prisma.creatorProfile.create({
        data: { userId: owner.id, displayName: "Owner Creator" },
      });
      profileIds.push(profile.id);
      const workspace = await prisma.creatorWorkspace.create({
        data: {
          ownerProfileId: profile.id,
          organizationId: organization.id,
          organizationDisplayName: "Legacy display metadata",
        },
      });
      workspaceIds.push(workspace.id);
      const ownerMembership = await prisma.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: profile.id,
          userId: owner.id,
          associatedEmail: owner.email,
          securityRole: CreatorTeamRole.OWNER,
          joinedAt: new Date(),
        },
      });
      return { organization, owner, profile, workspace, ownerMembership };
    }

    async function addMember(
      workspaceId: string,
      role: CreatorTeamRole,
      active = true,
    ) {
      const user = await createUser();
      const membership = await prisma.creatorWorkspaceMember.create({
        data: {
          workspaceId,
          userId: user.id,
          associatedEmail: user.email,
          securityRole: role,
          isActive: active,
          joinedAt: active ? new Date() : null,
        },
      });
      return { user, membership };
    }

    function sentToken(): string {
      const payload = send.mock.calls.at(-1)?.[0] as {
        TemplateModel: { acceptance_url: string };
      };
      return new URLSearchParams(
        new URL(payload.TemplateModel.acceptance_url).hash.slice(1),
      ).get("token")!;
    }

    it("separates Team actor identity from the canonical Owner subject", async () => {
      const fixture = await createWorkspace();
      const manager = await addMember(
        fixture.workspace.id,
        CreatorTeamRole.MANAGER,
      );
      const context = await actors.resolve(actor(manager.user));
      expect(context.actorUserId).toBe(manager.user.id);
      expect(context.actorRole).toBe(CreatorTeamRole.MANAGER);
      expect(context.subjectCreatorProfileId).toBe(fixture.profile.id);
      expect(context.subjectOwnerUserId).toBe(fixture.owner.id);

      const unresolved = await createUser();
      await prisma.creatorWorkspaceMember.create({
        data: {
          workspaceId: fixture.workspace.id,
          associatedEmail: unresolved.email,
          securityRole: CreatorTeamRole.ASSISTANT,
        },
      });
      await expect(actors.resolve(actor(unresolved))).rejects.toThrow(
        "No active Creator workspace membership",
      );

      const inactive = await addMember(
        fixture.workspace.id,
        CreatorTeamRole.ASSISTANT,
        false,
      );
      await expect(actors.resolve(actor(inactive.user))).rejects.toThrow(
        "No active Creator workspace membership",
      );
    });

    it("hashes, consumes, replays, and safely reactivates admission", async () => {
      const fixture = await createWorkspace();
      const recipient = await createUser();
      const userCount = await prisma.user.count();
      const dispatch = await invitations.create(actor(fixture.owner), {
        recipientEmail: recipient.email,
        allocatedRole: "ASSISTANT",
      });
      const rawToken = sentToken();
      const stored = await prisma.creatorWorkspaceInvitation.findUniqueOrThrow({
        where: { id: dispatch.invitation_id },
      });
      expect(stored.secureTokenHash).toBe(hashTeamInvitationToken(rawToken));
      expect(stored.secureTokenHash).not.toContain(rawToken);
      const accepted = await invitations.accept(actor(recipient), rawToken);
      expect(accepted.subject_creator_profile_id).toBe(fixture.profile.id);
      await expect(
        invitations.accept(actor(recipient), rawToken),
      ).rejects.toThrow("already been accepted");
      expect(await prisma.user.count()).toBe(userCount);

      await team.remove(actor(fixture.owner), accepted.membership_id);
      const redispatch = await invitations.create(actor(fixture.owner), {
        recipientEmail: recipient.email,
        allocatedRole: "MANAGER",
      });
      const secondToken = sentToken();
      const readmitted = await invitations.accept(
        actor(recipient),
        secondToken,
      );
      expect(readmitted.membership_id).toBe(accepted.membership_id);
      expect(
        (
          await prisma.creatorWorkspaceMember.findUniqueOrThrow({
            where: { id: accepted.membership_id },
          })
        ).securityRole,
      ).toBe(CreatorTeamRole.MANAGER);
      expect(redispatch.delivery_status).toBe("DISPATCHED");
    });

    it("serializes duplicate invitations and the five-seat cap", async () => {
      const fixture = await createWorkspace();
      await addMember(fixture.workspace.id, CreatorTeamRole.MANAGER);
      await addMember(fixture.workspace.id, CreatorTeamRole.ASSISTANT);
      await addMember(fixture.workspace.id, CreatorTeamRole.ASSISTANT);
      const firstEmail = `${randomUUID()}@example.test`;
      const capacityRace = await Promise.allSettled([
        invitations.create(actor(fixture.owner), {
          recipientEmail: firstEmail,
          allocatedRole: "ASSISTANT",
        }),
        invitations.create(actor(fixture.owner), {
          recipientEmail: `${randomUUID()}@example.test`,
          allocatedRole: "ASSISTANT",
        }),
      ]);
      expect(
        capacityRace.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.creatorWorkspaceInvitation.count({
          where: {
            workspaceId: fixture.workspace.id,
            invitationStatus: WorkspaceInvitationStatus.PENDING,
          },
        }),
      ).toBe(1);

      const duplicateFixture = await createWorkspace();
      const duplicateEmail = `${randomUUID()}@example.test`;
      const duplicateRace = await Promise.allSettled([
        invitations.create(actor(duplicateFixture.owner), {
          recipientEmail: duplicateEmail,
          allocatedRole: "MANAGER",
        }),
        invitations.create(actor(duplicateFixture.owner), {
          recipientEmail: duplicateEmail.toUpperCase(),
          allocatedRole: "MANAGER",
        }),
      ]);
      expect(
        duplicateRace.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
    });

    it("enforces Owner protection and the Manager/Assistant matrix", async () => {
      const fixture = await createWorkspace();
      const manager = await addMember(
        fixture.workspace.id,
        CreatorTeamRole.MANAGER,
      );
      const assistant = await addMember(
        fixture.workspace.id,
        CreatorTeamRole.ASSISTANT,
      );
      await expect(
        team.updateRole(
          actor(manager.user),
          fixture.ownerMembership.id,
          "ASSISTANT",
        ),
      ).rejects.toThrow();
      await team.updateRole(
        actor(manager.user),
        assistant.membership.id,
        "MANAGER",
      );
      await expect(team.list(actor(assistant.user))).rejects.toThrow(
        "Creator workspace action denied",
      );
      await expect(
        invitations.create(actor(assistant.user), {
          recipientEmail: `${randomUUID()}@example.test`,
          allocatedRole: "ASSISTANT",
        }),
      ).rejects.toThrow("Creator workspace action denied");
    });

    it("makes cancellation and expiry terminal", async () => {
      const fixture = await createWorkspace();
      const cancelled = await invitations.create(actor(fixture.owner), {
        recipientEmail: `${randomUUID()}@example.test`,
        allocatedRole: "ASSISTANT",
      });
      const cancelledToken = sentToken();
      await team.cancelInvitation(
        actor(fixture.owner),
        cancelled.invitation_id,
      );
      await expect(invitations.inspect(cancelledToken)).rejects.toThrow(
        "expired or was cancelled",
      );

      const expired = await invitations.create(actor(fixture.owner), {
        recipientEmail: `${randomUUID()}@example.test`,
        allocatedRole: "ASSISTANT",
      });
      const expiredToken = sentToken();
      await prisma.creatorWorkspaceInvitation.update({
        where: { id: expired.invitation_id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(invitations.inspect(expiredToken)).rejects.toThrow(
        "expired or was cancelled",
      );
    });
  },
);

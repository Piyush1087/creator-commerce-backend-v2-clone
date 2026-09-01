import { randomUUID } from "node:crypto";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  BrandRole,
  PrismaClient,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { CHAT_CAPABILITY_CATALOG } from "../capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import { ChatContextService } from "../context/chat-context.service";
import { ChatConversationService } from "./chat-conversation.service";
import { CoPilotThreadService } from "../../co-pilot/services/co-pilot-thread.service";

describe.skipIf(process.env.CHAT_HOME_DATABASE_TEST !== "true")(
  "Chat conversation PostgreSQL ownership and persistence",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const authorization = new BrandWorkspaceAuthorizationService(
      db,
      new BrandCentreAuthService(db, new BrandCentreSessionEvictionService(db)),
    );
    const threads = new CoPilotThreadService(db);
    const conversations = new ChatConversationService(authorization, threads);
    const context = new ChatContextService(
      authorization,
      conversations,
      new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG),
    );
    const brandIds: string[] = [];
    const userIds: string[] = [];
    const organizationIds: string[] = [];

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !/^\/chat_home_p[23]_/u.test(url.pathname)
      ) {
        throw new Error(
          "Chat PostgreSQL tests require a disposable local chat_home_p2_* or chat_home_p3_* database",
        );
      }
      const migrations = await prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      expect(migrations[0].count).toBe(66);
    });

    afterAll(async () => {
      try {
        if (brandIds.length) {
          await prisma.brandProfile.deleteMany({
            where: { id: { in: brandIds } },
          });
        }
        if (userIds.length) {
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        if (organizationIds.length) {
          await prisma.organization.deleteMany({
            where: { id: { in: organizationIds } },
          });
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    const authUser = (user: {
      id: string;
      email: string;
      name: string | null;
      role: UserRole;
      organizationId: string | null;
    }): AuthUser => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    });

    async function createOrganization(name: string) {
      const organization = await prisma.organization.create({ data: { name } });
      organizationIds.push(organization.id);
      return organization;
    }

    async function createBrand(organizationId: string, name: string) {
      const brand = await prisma.brandProfile.create({
        data: {
          organizationId,
          name,
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
        },
      });
      brandIds.push(brand.id);
      return brand;
    }

    async function createBrandUser(
      organizationId: string,
      name: string,
    ): Promise<AuthUser> {
      const user = await prisma.user.create({
        data: {
          organizationId,
          email: `${randomUUID()}@example.test`,
          name,
          role: UserRole.BRAND,
          authState: UserAuthState.ACTIVE,
        },
      });
      userIds.push(user.id);
      return authUser(user);
    }

    async function addMembership(
      brandProfileId: string,
      userId: string,
      options: { active?: boolean; role?: BrandRole } = {},
    ) {
      return prisma.brandTeamMember.create({
        data: {
          brandProfileId,
          userId,
          role: options.role ?? BrandRole.BRAND_OWNER,
          isActive: options.active ?? true,
        },
      });
    }

    it("blocks same-Brand cross-user access on new Chat and legacy thread service paths", async () => {
      const organization = await createOrganization("Chat P2 shared Brand");
      const brand = await createBrand(organization.id, "Shared Brand");
      const userA = await createBrandUser(organization.id, "User A");
      const userB = await createBrandUser(organization.id, "User B");
      await addMembership(brand.id, userA.id);
      await addMembership(brand.id, userB.id, {
        role: BrandRole.CAMPAIGN_MANAGER,
      });

      const thread = await conversations.createConversation(userA, "Private");
      await conversations.appendUserMessage(userA, thread.id, "Private prompt");
      const scopeB = { brandProfileId: brand.id, userId: userB.id };

      expect(await conversations.listConversations(userB)).toEqual([]);
      expect(await conversations.getConversation(userB, thread.id)).toBeNull();
      expect(await conversations.listMessages(userB, thread.id)).toBeNull();
      expect(
        await conversations.appendUserMessage(userB, thread.id, "intrusion"),
      ).toBeNull();
      expect(
        await threads.appendAssistantMessage({
          scope: scopeB,
          threadId: thread.id,
          payload: {},
          formatType: "CONVERSATIONAL_NARRATIVE",
          narrativeText: "intrusion",
        }),
      ).toBeNull();
      expect(
        await conversations.archiveConversation(userB, thread.id, true),
      ).toBeNull();

      // Existing CoPilotThreadService is the legacy shared-storage service path.
      expect(await threads.listThreads(scopeB, {})).toEqual([]);
      expect(await threads.getThread(scopeB, thread.id)).toBeNull();
      expect(
        await threads.findHitlResolution(scopeB, thread.id, randomUUID()),
      ).toBeNull();
    });

    it("blocks cross-Brand scope and persists messages across service instances", async () => {
      const organization = await createOrganization("Chat P2 persistence");
      const foreignOrganization = await createOrganization(
        "Chat P2 foreign persistence scope",
      );
      const brandA = await createBrand(organization.id, "Brand A");
      const brandB = await createBrand(foreignOrganization.id, "Brand B");
      const user = await createBrandUser(organization.id, "Persistent User");
      await addMembership(brandA.id, user.id);

      const thread = await conversations.createConversation(user, "Durable");
      await conversations.appendUserMessage(user, thread.id, "Persist me");
      expect(
        await threads.getThread(
          { brandProfileId: brandB.id, userId: user.id },
          thread.id,
          { includeArchived: true },
        ),
      ).toBeNull();

      const reloadedThreads = new CoPilotThreadService(db);
      const reloadedMessages = await reloadedThreads.listMessages(
        { brandProfileId: brandA.id, userId: user.id },
        thread.id,
      );
      expect(reloadedMessages?.map((message) => message.textContent)).toContain(
        "Persist me",
      );
    });

    it("requires active membership and rejects mismatched or foreign conversations in ChatContext", async () => {
      const activeOrg = await createOrganization("Chat P2 active context");
      const activeBrand = await createBrand(activeOrg.id, "Active Brand");
      const owner = await createBrandUser(activeOrg.id, "Owner");
      const teammate = await createBrandUser(activeOrg.id, "Teammate");
      await addMembership(activeBrand.id, owner.id);
      await addMembership(activeBrand.id, teammate.id, {
        role: BrandRole.CAMPAIGN_MANAGER,
      });
      const thread = await conversations.createConversation(owner, "Owned");

      await expect(
        context.assemble(owner, {
          conversationId: thread.id,
          surface: "MODULE",
          routePath: "/campaigns/client-hint",
          selectedEntity: { type: "CAMPAIGN", id: "client-hint" },
        }),
      ).resolves.toMatchObject({
        conversation: { id: thread.id },
        canonicalRefs: [{ type: "BRAND", id: activeBrand.id }],
      });
      await expect(
        context.assemble(teammate, {
          conversationId: thread.id,
          surface: "HOME",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      const inactiveOrg = await createOrganization("Chat P2 inactive context");
      const inactiveBrand = await createBrand(inactiveOrg.id, "Inactive Brand");
      const inactive = await createBrandUser(inactiveOrg.id, "Inactive");
      await addMembership(inactiveBrand.id, inactive.id, { active: false });
      await expect(
        conversations.createConversation(inactive),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const foreignOrg = await createOrganization("Chat P2 foreign context");
      const foreignBrand = await createBrand(foreignOrg.id, "Foreign Brand");
      const mismatched = await createBrandUser(activeOrg.id, "Mismatched");
      await addMembership(foreignBrand.id, mismatched.id);
      await expect(
        context.assemble(mismatched, { surface: "HOME" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  },
);

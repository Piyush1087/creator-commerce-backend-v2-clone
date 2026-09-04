import { randomUUID } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard } from "@nestjs/throttler";
import {
  BrandRole,
  LeakBucket,
  LeakPlannerStatus,
  PerformanceColor,
  PrismaClient,
  PriorityRank,
  UserAuthState,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../brand-centre/services/brand-centre-session-eviction.service";
import { CoPilotThreadService } from "../co-pilot/services/co-pilot-thread.service";
import type { ChatCapabilityExecutor } from "./capabilities/chat-capability.executor";
import { CHAT_CAPABILITY_CATALOG } from "./capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "./capabilities/chat-capability.registry";
import { ChatController } from "./chat.controller";
import { ChatContextService } from "./context/chat-context.service";
import { ChatConversationService } from "./conversation/chat-conversation.service";
import type { ChatModelGateway } from "./model/chat-model.gateway";
import { ChatTurnOrchestratorService } from "./orchestration/chat-turn-orchestrator.service";
import { ChatResponseValidationService } from "./response/chat-response-validation.service";
import type { ChatTelemetryService } from "./telemetry/chat-telemetry.service";

describe.skipIf(process.env.CHAT_HOME_P3_DATABASE_TEST !== "true")(
  "permanent Chat HTTP PostgreSQL privacy and persistence",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const actors = new Map<string, AuthUser>();
    const brandIds: string[] = [];
    const userIds: string[] = [];
    const organizationIds: string[] = [];
    let app: INestApplication;
    let baseUrl: string;
    let userA: AuthUser;
    let userB: AuthUser;
    let foreignUser: AuthUser;
    let sharedBrandId: string;
    let chatLeakId: string;
    let sessionBefore: Awaited<ReturnType<typeof sessionSnapshot>>;
    let conversationId: string;
    let conversations: ChatConversationService;

    const allowActor: CanActivate = {
      canActivate(executionContext: ExecutionContext): boolean {
        const request = executionContext
          .switchToHttp()
          .getRequest<RequestWithAuthUser>();
        const actorId = String(request.headers["x-test-actor"] ?? "");
        const actor = actors.get(actorId);
        if (!actor) return false;
        request.user = actor;
        return true;
      },
    };

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

    async function createUser(organizationId: string, name: string) {
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
      const actor = authUser(user);
      actors.set(actor.id, actor);
      return actor;
    }

    async function addMembership(
      brandProfileId: string,
      userId: string,
      role: BrandRole,
    ) {
      await prisma.brandTeamMember.create({
        data: { brandProfileId, userId, role, isActive: true },
      });
    }

    function sessionSnapshot() {
      return Promise.all([
        prisma.brandProfile.findUniqueOrThrow({
          where: { id: sharedBrandId },
          select: {
            id: true,
            brandCentreLastActiveAt: true,
            updatedAt: true,
          },
        }),
        prisma.brandPerformanceLeak.findUniqueOrThrow({
          where: { id: chatLeakId },
          select: {
            id: true,
            plannerStatus: true,
            isArchived: true,
            archivedAt: true,
            updatedAt: true,
          },
        }),
      ]);
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/chat_home_p3_")
      ) {
        throw new Error(
          "Chat P3 HTTP tests require a disposable local chat_home_p3_* database",
        );
      }
      const migrations = await prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      expect(migrations[0].count).toBeGreaterThanOrEqual(66);

      const sharedOrg = await createOrganization("Chat P3 HTTP shared");
      const sharedBrand = await createBrand(sharedOrg.id, "Shared Brand");
      sharedBrandId = sharedBrand.id;
      userA = await createUser(sharedOrg.id, "User A");
      userB = await createUser(sharedOrg.id, "User B");
      await addMembership(sharedBrand.id, userA.id, BrandRole.BRAND_OWNER);
      await addMembership(sharedBrand.id, userB.id, BrandRole.CAMPAIGN_MANAGER);

      const foreignOrg = await createOrganization("Chat P3 HTTP foreign");
      const foreignBrand = await createBrand(foreignOrg.id, "Foreign Brand");
      foreignUser = await createUser(foreignOrg.id, "Foreign User");
      await addMembership(
        foreignBrand.id,
        foreignUser.id,
        BrandRole.BRAND_OWNER,
      );

      const authorization = new BrandWorkspaceAuthorizationService(
        db,
        new BrandCentreAuthService(
          db,
          new BrandCentreSessionEvictionService(db),
        ),
      );
      conversations = new ChatConversationService(
        authorization,
        new CoPilotThreadService(db),
      );
      const capabilities = new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG);
      const contexts = new ChatContextService(
        authorization,
        conversations,
        capabilities,
      );
      const turns = new ChatTurnOrchestratorService(
        contexts,
        conversations,
        capabilities,
        {
          execute: vi.fn(async (executionContext, capabilityId) => {
            const brandRef = {
              type: "BRAND" as const,
              id: executionContext.chatContext.workspace.brandProfileId,
            };
            return {
              capabilityId,
              availability: "AVAILABLE" as const,
              data: {
                workspaceBrand: brandRef,
                membershipRole:
                  executionContext.chatContext.workspace.membershipRole,
                surface: executionContext.chatContext.surface.kind,
                capabilities: executionContext.chatContext.capabilities,
              },
              grounding: [
                {
                  sourceType: "CANONICAL" as const,
                  capabilityId,
                  entityRefs: [brandRef],
                },
              ],
              authorizedEntityRefs: [brandRef],
            };
          }),
        } as unknown as ChatCapabilityExecutor,
        {
          planCapabilities: vi.fn().mockResolvedValue({
            requests: [{ capabilityId: "workspace.context.read", input: {} }],
          }),
          synthesize: vi.fn().mockResolvedValue({
            answer: "This answer is grounded in the current workspace.",
            freshnessNotes: [],
            limitations: [],
          }),
        } as unknown as ChatModelGateway,
        new ChatResponseValidationService(),
        { recordTurn: vi.fn() } as unknown as ChatTelemetryService,
      );

      const moduleRef = await Test.createTestingModule({
        controllers: [ChatController],
        providers: [
          { provide: ChatConversationService, useValue: conversations },
          { provide: ChatTurnOrchestratorService, useValue: turns },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(allowActor)
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = moduleRef.createNestApplication();
      await app.listen(0, "127.0.0.1");
      baseUrl = await app.getUrl();
      const conversation = await conversations.createConversation(
        userA,
        "Private HTTP conversation",
      );
      conversationId = conversation.id;
      await prisma.brandProfile.update({
        where: { id: sharedBrandId },
        data: {
          brandCentreLastActiveAt: new Date(Date.now() - 31 * 60 * 1000),
        },
      });
      const leak = await prisma.brandPerformanceLeak.create({
        data: {
          brandProfileId: sharedBrandId,
          insightTitle: "P7-C1 Chat session boundary",
          shortDescription: "Chat reads must not evict this leak",
          priorityRank: PriorityRank.HIGH,
          leakBucket: LeakBucket.PDP,
          performanceStatus: PerformanceColor.RED,
          projectedLiftPercentage: 8.5,
          drawerDeepDive: { evidence: ["P7-C1 Chat"] },
          plannerStatus: LeakPlannerStatus.PUSHED_TO_PLANNER,
        },
      });
      chatLeakId = leak.id;
      sessionBefore = await sessionSnapshot();
    });

    afterAll(async () => {
      try {
        await app?.close();
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

    async function request(
      actor: AuthUser,
      method: string,
      path: string,
      body?: unknown,
    ) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "x-test-actor": actor.id,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await response.json();
      return { status: response.status, payload };
    }

    it("blocks same-Brand cross-user GET, PATCH, and POST turn routes", async () => {
      expect(
        (
          await request(
            userB,
            "GET",
            `/api/v1/chat/conversations/${conversationId}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            userB,
            "PATCH",
            `/api/v1/chat/conversations/${conversationId}`,
            { title: "Intrusion" },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            userB,
            "POST",
            `/api/v1/chat/conversations/${conversationId}/turns`,
            { message: "Intrusion" },
          )
        ).status,
      ).toBe(404);
      expect(await conversations.listMessages(userA, conversationId)).toEqual(
        [],
      );
    });

    it("blocks cross-Brand conversation access without existence leakage", async () => {
      expect(
        (
          await request(
            foreignUser,
            "GET",
            `/api/v1/chat/conversations/${conversationId}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            foreignUser,
            "POST",
            `/api/v1/chat/conversations/${conversationId}/turns`,
            { message: "Foreign Brand intrusion" },
          )
        ).status,
      ).toBe(404);
    });

    it("rejects HTTP authority injection before turn execution", async () => {
      expect(
        (
          await request(
            userA,
            "POST",
            `/api/v1/chat/conversations/${conversationId}/turns`,
            { message: "Hello", brandProfileId: "foreign" },
          )
        ).status,
      ).toBe(400);
      expect(await conversations.listMessages(userA, conversationId)).toEqual(
        [],
      );
    });

    it("persists the user message and validated grounded assistant payload across reload", async () => {
      const turn = await request(
        userA,
        "POST",
        `/api/v1/chat/conversations/${conversationId}/turns`,
        { message: "What workspace is this?" },
      );
      expect(turn.status).toBe(201);
      expect(turn.payload).toMatchObject({
        contractVersion: "1.0",
        status: "ANSWERED",
        grounding: [
          {
            capabilityId: "workspace.context.read",
            sourceType: "CANONICAL",
          },
        ],
      });

      const reloaded = new CoPilotThreadService(db);
      const brandId = (
        await new BrandWorkspaceAuthorizationService(
          db,
          new BrandCentreAuthService(
            db,
            new BrandCentreSessionEvictionService(db),
          ),
        ).resolveBrandContext(userA)
      ).brandProfileId;
      const messages = await reloaded.listMessages(
        { brandProfileId: brandId, userId: userA.id },
        conversationId,
      );
      expect(messages?.map((message) => message.role)).toEqual([
        "USER",
        "ASSISTANT",
      ]);
      expect(messages?.[1].payload).toMatchObject({
        contractVersion: "1.0",
        status: "ANSWERED",
        grounding: [
          { capabilityId: "workspace.context.read", sourceType: "CANONICAL" },
        ],
      });
    });

    it("keeps Chat context and capability authorization free of Brand Centre session effects", async () => {
      const after = await sessionSnapshot();
      expect(after).toEqual(sessionBefore);
      expect(after[1]).toMatchObject({
        id: chatLeakId,
        plannerStatus: LeakPlannerStatus.PUSHED_TO_PLANNER,
        isArchived: false,
        archivedAt: null,
      });
    });
  },
);

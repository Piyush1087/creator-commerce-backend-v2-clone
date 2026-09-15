import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { AuthModule } from "../../auth/auth.module";
import type { AuthSessionService } from "../../auth/auth-session.service";
import type { PortfolioModule } from "../portfolio.module";
import type { PrismaService } from "../../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PortfolioRepository } from "../portfolio.repository";
import { PortfolioService } from "../portfolio.service";
import { PortfolioConsumerSchema } from "../contracts/portfolio.contract";
import { portfolioTestOwner, portfolioReference } from "./portfolio.fixture";
import { IntelligenceOwnerScopeRepository } from "../../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
describe.skipIf(process.env.CREATOR_PORTFOLIO_DATABASE_TEST !== "true")(
  "Portfolio P1 actual PostgreSQL and JWT/session API",
  () => {
    const db = new PrismaClient();
    const prisma = db as unknown as PrismaService;
    const repository = new PortfolioRepository(
      prisma,
      new CreatorWorkspaceActorService(prisma),
    );
    const service = new PortfolioService(repository);
    beforeAll(async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "localhost" ||
        route.port !== "55472" ||
        route.pathname !== "/creator_portfolio_v3_p1"
      )
        throw new Error("TASK_OWNED_PORTFOLIO_P1_DATABASE_REQUIRED");
      await db.$connect();
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      ).toEqual([{ n: 105 }]);
    });
    afterAll(async () => db.$disconnect());
    async function counts(workspaceId: string) {
      return {
        aggregate: await db.creatorPortfolio.count({ where: { workspaceId } }),
        items: await db.creatorPortfolioItem.count({
          where: { portfolio: { workspaceId } },
        }),
        aliases: await db.creatorPortfolioAlias.count({
          where: { item: { portfolio: { workspaceId } } },
        }),
        revisions: await db.creatorPortfolioRevision.count({
          where: { portfolio: { workspaceId } },
        }),
      };
    }
    it("is source-independent, active roles read without rows, Owner/Manager curate and Assistant cannot", async () => {
      const a = await portfolioTestOwner(db);
      for (const actor of [a.owner, a.manager, a.assistant])
        expect((await service.read(actor.auth)).items).toEqual([]);
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 0,
        items: 0,
        aliases: 0,
        revisions: 0,
      });
      await expect(
        service.mutate(a.assistant.auth, portfolioReference()),
      ).rejects.toThrow();
      const first = await service.mutate(a.owner.auth, portfolioReference());
      expect(first.currentRevision).toBe(1);
      const second = await service.mutate(
        a.manager.auth,
        portfolioReference(1),
      );
      expect(second.currentRevision).toBe(2);
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 1,
        items: 2,
        aliases: 2,
        revisions: 2,
      });
      console.info(
        "PORTFOLIO_MANUAL_COUNTS",
        JSON.stringify(await counts(a.workspace.id)),
      );
    });
    it("exact mutation replay is stable; changed payload, actor, stale revision and simultaneous CAS reject atomically", async () => {
      const a = await portfolioTestOwner(db);
      const command = portfolioReference();
      const first = await service.mutate(a.owner.auth, command);
      const before = await counts(a.workspace.id);
      expect(await service.mutate(a.owner.auth, command)).toEqual(first);
      await expect(
        service.mutate(a.owner.auth, { ...command, title: "Different" }),
      ).rejects.toThrow();
      await expect(service.mutate(a.manager.auth, command)).rejects.toThrow();
      await expect(
        service.mutate(a.owner.auth, portfolioReference()),
      ).rejects.toThrow();
      expect(await counts(a.workspace.id)).toEqual(before);
      const outcomes = await Promise.allSettled([
        service.mutate(a.owner.auth, portfolioReference(1)),
        service.mutate(a.manager.auth, portfolioReference(1)),
      ]);
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 1,
        items: 2,
        aliases: 2,
        revisions: 2,
      });
    });
    it("removal and restore are reversible without rewriting source data or provenance", async () => {
      const a = await portfolioTestOwner(db);
      const source = await db.creatorSocialIntegration.findUniqueOrThrow({
        where: { id: a.integration.id },
      });
      const first = await service.mutate(a.owner.auth, portfolioReference());
      const item = first.items[0];
      const remove = {
        intent: "REMOVE",
        itemId: item.id,
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
      };
      expect((await service.mutate(a.manager.auth, remove)).items).toEqual([]);
      expect(
        (await service.read(a.assistant.auth, { filter: "REMOVED" })).items,
      ).toEqual([{ ...item, state: "REMOVED" }]);
      expect(
        (
          await service.mutate(a.owner.auth, {
            ...remove,
            intent: "RESTORE",
            expectedRevision: 2,
            idempotencyKey: randomUUID(),
          })
        ).items,
      ).toEqual([item]);
      expect(
        await db.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: a.integration.id },
        }),
      ).toEqual(source);
    });
    it("only Creator-provided limited facts edit; stable identity and alias uniqueness survive edits", async () => {
      const a = await portfolioTestOwner(db);
      const first = await service.mutate(a.owner.auth, portfolioReference());
      const edit = {
        intent: "EDIT_REFERENCE",
        itemId: first.items[0].id,
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        destination: "https://example.com/work-reference",
        title: "Edited reference",
        creatorContext: "Creator-authored context",
        workDate: null,
      };
      const changed = await service.mutate(a.manager.auth, edit);
      expect(changed.items[0].id).toBe(first.items[0].id);
      expect(changed.items[0].creatorContext).toBe("Creator-authored context");
      expect(changed.items[0].provenance).toEqual(first.items[0].provenance);
      await expect(
        service.mutate(a.owner.auth, {
          ...portfolioReference(2),
          destination: edit.destination,
        }),
      ).rejects.toThrow();
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 1,
        items: 1,
        aliases: 1,
        revisions: 2,
      });
    });
    it("other Creator IDs, inactive members and subject overrides fail with no target/peer mutation", async () => {
      const a = await portfolioTestOwner(db),
        b = await portfolioTestOwner(db);
      const first = await service.mutate(a.owner.auth, portfolioReference());
      await expect(
        service.mutate(b.owner.auth, {
          intent: "REMOVE",
          itemId: first.items[0].id,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      expect(() =>
        service.read(a.owner.auth, { workspaceId: b.workspace.id }),
      ).toThrow();
      await db.creatorWorkspaceMember.update({
        where: { id: a.manager.membership.id },
        data: { isActive: false },
      });
      await expect(service.read(a.manager.auth)).rejects.toThrow();
      await expect(
        service.mutate(a.manager.auth, portfolioReference(1)),
      ).rejects.toThrow();
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 1,
        items: 1,
        aliases: 1,
        revisions: 1,
      });
      expect(await counts(b.workspace.id)).toEqual({
        aggregate: 0,
        items: 0,
        aliases: 0,
        revisions: 0,
      });
    });
    it("audit cannot update/delete or forge identity/revision; current stays stable", async () => {
      const a = await portfolioTestOwner(db);
      await service.mutate(a.owner.auth, portfolioReference());
      const aggregate = await db.creatorPortfolio.findUniqueOrThrow({
        where: { workspaceId: a.workspace.id },
      });
      const revision = await db.creatorPortfolioRevision.findFirstOrThrow({
        where: { portfolioId: aggregate.id },
      });
      await expect(
        db.creatorPortfolioRevision.update({
          where: { id: revision.id },
          data: { commandHash: "a".repeat(64) },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorPortfolioRevision.delete({ where: { id: revision.id } }),
      ).rejects.toThrow();
      await expect(
        db.creatorPortfolio.update({
          where: { id: aggregate.id },
          data: { ownerProfileId: randomUUID(), currentRevision: 2 },
        }),
      ).rejects.toThrow();
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 1,
        items: 1,
        aliases: 1,
        revisions: 1,
      });
    });
    it("existing internal source purge does not target derived Portfolio; task-only aggregate deletion is target-only", async () => {
      const a = await portfolioTestOwner(db),
        b = await portfolioTestOwner(db);
      const first = await service.mutate(a.owner.auth, portfolioReference());
      const other = await service.mutate(b.owner.auth, portfolioReference());
      const scopes = new IntelligenceOwnerScopeRepository(prisma);
      const scope = await scopes.resolve({
        kind: "CREATOR",
        creatorProfileId: a.profile.id,
        creatorWorkspaceId: a.workspace.id,
      });
      await scopes.purgeCreatorInstagram(scope.id); // Regression only; never Portfolio production integration.
      expect(await service.read(a.owner.auth)).toEqual(first);
      expect(await service.read(b.owner.auth)).toEqual(other);
      await db.creatorPortfolio.deleteMany({
        where: { workspaceId: a.workspace.id, ownerProfileId: a.profile.id },
      }); // Task-only generic aggregate capability proof, not a deletion command.
      expect(await counts(a.workspace.id)).toEqual({
        aggregate: 0,
        items: 0,
        aliases: 0,
        revisions: 0,
      });
      expect(await service.read(b.owner.auth)).toEqual(other);
      expect(
        await db.creatorSocialIntegration.count({
          where: { id: a.integration.id },
        }),
      ).toBe(1);
    });
    it("real JWT/session HTTP: roles, anonymous, CAS, replay, malicious fields, cross-Creator and inactive denial", async () => {
      const a = await portfolioTestOwner(db),
        b = await portfolioTestOwner(db);
      const compiled = createRequire(resolve("package.json"));
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
          (
            compiled(resolve("dist/features/auth/auth.module.js")) as {
              AuthModule: typeof AuthModule;
            }
          ).AuthModule,
          (
            compiled(
              resolve("dist/features/creator-portfolio/portfolio.module.js"),
            ) as { PortfolioModule: typeof PortfolioModule }
          ).PortfolioModule,
        ],
      })
        .overrideProvider("POSTMARK_CLIENT")
        .useValue({
          sendEmail: () => {
            throw new Error("TEST_FORBIDDEN_EXTERNAL_EMAIL_DISPATCH");
          },
          sendEmailWithTemplate: () => {
            throw new Error("TEST_FORBIDDEN_EXTERNAL_EMAIL_DISPATCH");
          },
        })
        .compile();
      const app = module.createNestApplication({ logger: false });
      try {
        await app.listen(0, "127.0.0.1");
        const address = app.getHttpServer().address() as { port: number };
        const base = `http://127.0.0.1:${address.port}/api/v1/creator/portfolio`;
        const sessions = app.get(
          (
            compiled(resolve("dist/features/auth/auth-session.service.js")) as {
              AuthSessionService: typeof AuthSessionService;
            }
          ).AuthSessionService,
        );
        const owner = (await sessions.create(a.owner.auth.id)).accessToken,
          manager = (await sessions.create(a.manager.auth.id)).accessToken,
          assistant = (await sessions.create(a.assistant.auth.id)).accessToken,
          other = (await sessions.create(b.owner.auth.id)).accessToken;
        const get = (token: string, suffix = "") =>
          fetch(base + suffix, {
            headers: { Authorization: `Bearer ${token}` },
          });
        const put = (token: string, body: unknown) =>
          fetch(base, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
        expect((await fetch(base)).status).toBe(401);
        for (const token of [owner, manager, assistant])
          expect((await get(token)).status).toBe(200);
        const command = portfolioReference();
        expect((await put(assistant, command)).status).toBe(403);
        const first = await put(owner, command);
        expect(first.status).toBe(200);
        expect(first.headers.get("cache-control")).toBe("private, no-store");
        const item = PortfolioConsumerSchema.parse(await first.json()).items[0];
        expect((await put(owner, command)).status).toBe(200);
        expect((await put(manager, portfolioReference(1))).status).toBe(200);
        expect((await put(owner, portfolioReference(1))).status).toBe(409);
        expect(
          (
            await put(owner, {
              ...portfolioReference(2),
              ownerProfileId: b.profile.id,
            })
          ).status,
        ).toBe(400);
        expect(
          (await get(owner, `?workspaceId=${b.workspace.id}`)).status,
        ).toBe(400);
        expect(
          (
            await put(other, {
              intent: "REMOVE",
              itemId: item.id,
              expectedRevision: 0,
              idempotencyKey: randomUUID(),
            })
          ).status,
        ).toBe(404);
        expect(
          PortfolioConsumerSchema.parse(await (await get(other)).json()).items,
        ).toEqual([]);
        await db.creatorWorkspaceMember.update({
          where: { id: a.assistant.membership.id },
          data: { isActive: false },
        });
        expect((await get(assistant)).status).toBe(403);
        expect(await counts(a.workspace.id)).toEqual({
          aggregate: 1,
          items: 2,
          aliases: 2,
          revisions: 2,
        });
      } finally {
        await app.close();
      }
    }, 60000);
  },
);

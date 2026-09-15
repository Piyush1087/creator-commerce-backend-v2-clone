import "reflect-metadata";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { hashPasswordAsync } from "../../../shared/crypto/password.util";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PortfolioService } from "../portfolio.service";
import { PortfolioRepository } from "../portfolio.repository";
import { portfolioTestOwner, portfolioReference } from "./portfolio.fixture";
import { portfolioC04Fixture } from "./portfolio-c04.harness";
import { audienceV1ContentTestFixture } from "./portfolio-content.fixture";
import { audienceV1TestRuntime } from "../../creator-audience-v1/creator-audience-v1.test-fixture";
describe.skipIf(process.env.CREATOR_PORTFOLIO_P4_TEST !== "true")(
  "Portfolio P4 real source and password-auth browser fixtures",
  () => {
    const db = new PrismaClient({ transactionOptions: { timeout: 30000 } });
    const prisma = db as unknown as PrismaService;
    const service = new PortfolioService(
      new PortfolioRepository(prisma, new CreatorWorkspaceActorService(prisma)),
    );
    beforeAll(async () => {
      const u = new URL(process.env.DATABASE_URL ?? "");
      if (
        u.hostname !== "localhost" ||
        u.port !== "55472" ||
        u.pathname !== "/creator_portfolio_v3_p4" ||
        !process.env.CREATOR_PORTFOLIO_FIXTURE_PASSWORD
      )
        throw new Error("OWNED_P4_DATABASE_CONFIGURATION_REQUIRED");
      await db.$connect();
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 105 }]);
    });
    afterAll(() => db.$disconnect());
    it("seeds supported states for all roles using actual source, canonical C04 fixtures and canonical Portfolio curation", async () => {
      const passwordHash = await hashPasswordAsync(
        process.env.CREATOR_PORTFOLIO_FIXTURE_PASSWORD!,
      );
      const matrix = [];
      for (const name of [
        "main",
        "partial",
        "unavailable",
        "processing",
        "removed",
        "empty",
        "notprocessed",
      ]) {
        const owner = await portfolioTestOwner(db);
        for (const [role, seat] of [
          ["owner", owner.owner],
          ["manager", owner.manager],
          ["assistant", owner.assistant],
        ] as const) {
          const email = `portfolio-v3-p4-${name}-${role}@example.test`;
          expect(await db.user.count({ where: { email } })).toBe(0);
          await db.user.update({
            where: { id: seat.auth.id },
            data: {
              email,
              normalizedEmail: email,
              name: `Portfolio ${role}`,
              hashedPassword: passwordHash,
              authMethods: {
                create: { type: "PASSWORD", credentialHash: passwordHash },
              },
            },
          });
        }
        let calls = 0;
        if (name !== "notprocessed") {
          const capturedAt = new Date(Date.now() - 1000);
          const fixture = await audienceV1ContentTestFixture(
            db,
            capturedAt,
            (index) =>
              name !== "empty" && index < 3
                ? "Paid partnership with @example"
                : "Everyday product mention",
          );
          try {
            const pipeline = audienceV1TestRuntime(
              db,
              fixture.provider,
            ).content(fixture.analyzer);
            const input = {
              actor: owner.actor,
              integrationId: owner.integration.id,
              providerAccountId: owner.providerAccountId,
              authorizationGeneration: 1,
              capturedAt,
              requestIdentity: `portfolio-p4-${randomUUID()}`,
            };
            await pipeline.execute(input);
            if (name === "main") {
              await portfolioC04Fixture(db, owner);
              await portfolioC04Fixture(
                db,
                owner,
                `https://drive.google.com/file/d/${randomUUID()}/view`,
                false,
              );
            }
            if (name === "partial")
              await portfolioC04Fixture(
                db,
                owner,
                "opaque-unavailable-work-reference",
              );
            const first = await service.read(owner.owner.auth);
            const rowsBefore = await db.creatorPortfolioRevision.count({
              where: { portfolio: { workspaceId: owner.workspace.id } },
            });
            const beforeCalls = fixture.providerCalls(),
              media = { ...fixture.external.count };
            const replay = await service.read(owner.owner.auth);
            expect(replay.items.map((item) => item.id)).toEqual(
              first.items.map((item) => item.id),
            );
            expect(
              await db.creatorPortfolioRevision.count({
                where: { portfolio: { workspaceId: owner.workspace.id } },
              }),
            ).toBe(rowsBefore);
            expect(fixture.providerCalls()).toBe(beforeCalls);
            expect(fixture.external.count).toEqual(media);
            calls = beforeCalls;
            if (name === "main") {
              const dual = first.items.filter(
                (item) =>
                  item.provenance.some((p) => p.source === "INSTAGRAM") &&
                  item.provenance.some((p) => p.source === "CREATOR_SHOP"),
              );
              expect(dual).toHaveLength(1);
              expect(
                first.items.some(
                  (item) =>
                    item.kind === "UGC" &&
                    item.provenance.some((p) => p.source === "CREATOR_SHOP"),
                ),
              ).toBe(true);
              const ref = portfolioReference(first.currentRevision);
              await service.mutate(owner.owner.auth, {
                ...ref,
                title: "Creator-authored work reference",
              });
            }
            if (name === "removed") {
              for (const item of first.items) {
                const current = await service.read(owner.owner.auth);
                await service.mutate(owner.owner.auth, {
                  intent: "REMOVE",
                  itemId: item.id,
                  expectedRevision: current.currentRevision,
                  idempotencyKey: randomUUID(),
                });
              }
            }
            if (name === "unavailable" || name === "processing") {
              const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
                where: {
                  ownerKey: `CREATOR:${owner.profile.id}:${owner.workspace.id}`,
                },
              });
              const request = `portfolio-p4-status-${randomUUID()}`;
              await db.$executeRaw(
                Prisma.sql`INSERT INTO data_extraction_captures (id,capture_ref,owner_scope_id,brand_id,resource_ref,acquisition_request_key,status,started_at,acquisition_quality,provider_integration_id,provider_account_id,authorization_generation) SELECT ${randomUUID()},${`creator-content-capture:${request}`},owner_scope_id,NULL,resource_ref,${request},${name === "unavailable" ? "FAILED" : "RUNNING"}::"DataExtractionCaptureStatus",CURRENT_TIMESTAMP,'UNAVAILABLE',provider_integration_id,provider_account_id,authorization_generation FROM data_extraction_captures WHERE owner_scope_id=${scope.id} AND status='COMPLETED' AND capture_ref LIKE 'creator-content-capture:%' LIMIT 1`,
              );
            }
          } finally {
            await fixture.cleanup();
          }
        }
        const value = await service.read(owner.owner.auth);
        expect(value.discovery).toBe(
          name === "partial" || name === "processing"
            ? "PARTIAL"
            : name === "unavailable"
              ? "UNAVAILABLE"
              : name === "notprocessed"
                ? "NOT_PROCESSED"
                : "AVAILABLE",
        );
        if (name === "empty" || name === "notprocessed" || name === "removed")
          expect(value.items).toHaveLength(0);
        if (name === "removed")
          expect(
            (await service.read(owner.owner.auth, { filter: "REMOVED" })).items,
          ).toHaveLength(3);
        for (const seat of [owner.manager, owner.assistant])
          expect(
            (await service.read(seat.auth)).items.map((i) => i.id),
          ).toEqual(value.items.map((i) => i.id));
        matrix.push({
          state: name,
          roles: 3,
          discovery: value.discovery,
          items: value.items.length,
          sourceFixtureCalls: calls,
          repeatExpensiveWork: 0,
        });
      }
      const pg = await db.$queryRaw<
        Array<{ version: string }>
      >`SELECT version() version`;
      const extensions = await db.$queryRaw<
        Array<{ extname: string; extversion: string }>
      >`SELECT extname,extversion FROM pg_extension ORDER BY extname`;
      console.log(
        JSON.stringify({
          gate: "PORTFOLIO_P4_REAL_FIXTURES",
          matrix,
          postgres: pg[0].version,
          extensions,
          rawMediaRetained: false,
          temporaryCleanup: true,
          authBypass: false,
          liveGraphCalls: 0,
          liveModelCalls: 0,
        }),
      );
    }, 120000);
  },
);

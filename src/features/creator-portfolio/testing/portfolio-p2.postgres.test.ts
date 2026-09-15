import "reflect-metadata";
import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PortfolioRepository } from "../portfolio.repository";
import { PortfolioService } from "../portfolio.service";
import { PortfolioConsumerSchema } from "../contracts/portfolio.contract";
import { portfolioTestOwner, portfolioReference } from "./portfolio.fixture";
import { portfolioC04Fixture } from "./portfolio-c04.harness";
import { audienceV1ContentTestFixture } from "./portfolio-content.fixture";
import { audienceV1TestRuntime } from "../../creator-audience-v1/creator-audience-v1.test-fixture";
import { IntelligenceOwnerScopeRepository } from "../../data-extraction/evidence/ownership/intelligence-owner-scope.repository";
describe.skipIf(process.env.CREATOR_PORTFOLIO_DATABASE_TEST !== "true")(
  "Portfolio P2 actual retained Evidence/C04 projections",
  () => {
    const db = new PrismaClient({ transactionOptions: { timeout: 30_000 } }),
      prisma = db as unknown as PrismaService;
    const service = new PortfolioService(
      new PortfolioRepository(prisma, new CreatorWorkspaceActorService(prisma)),
    );
    beforeAll(async () => {
      const u = new URL(process.env.DATABASE_URL ?? "");
      if (
        u.hostname !== "localhost" ||
        u.port !== "55472" ||
        u.pathname !== "/creator_portfolio_v3_p2"
      )
        throw new Error("TASK_OWNED_P2_DATABASE_REQUIRED");
      await db.$connect();
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 105 }]);
    });
    afterAll(() => db.$disconnect());
    async function counts(
      owner: Awaited<ReturnType<typeof portfolioTestOwner>>,
    ) {
      const scope = await db.intelligenceOwnerScope.findUnique({
        where: {
          ownerKey: `CREATOR:${owner.profile.id}:${owner.workspace.id}`,
        },
      });
      return {
        items: await db.creatorPortfolioItem.count({
          where: { portfolio: { workspaceId: owner.workspace.id } },
        }),
        audits: await db.creatorPortfolioRevision.count({
          where: { portfolio: { workspaceId: owner.workspace.id } },
        }),
        aliases: await db.creatorPortfolioAlias.count({
          where: { item: { portfolio: { workspaceId: owner.workspace.id } } },
        }),
        captures: scope
          ? (
              await db.$queryRaw<Array<{ n: number }>>(
                Prisma.sql`SELECT count(*)::int n FROM data_extraction_captures WHERE owner_scope_id=${scope.id}`,
              )
            )[0].n
          : 0,
        evidence: scope
          ? (
              await db.$queryRaw<Array<{ n: number }>>(
                Prisma.sql`SELECT count(*)::int n FROM data_extraction_evidence_items WHERE owner_scope_id=${scope.id}`,
              )
            )[0].n
          : 0,
        objects: scope
          ? (
              await db.$queryRaw<Array<{ n: number }>>(
                Prisma.sql`SELECT count(*)::int n FROM intelligence_object_generations WHERE owner_scope_id=${scope.id}`,
              )
            )[0].n
          : 0,
        components: scope
          ? (
              await db.$queryRaw<Array<{ n: number }>>(
                Prisma.sql`SELECT count(*)::int n FROM intelligence_component_generations WHERE owner_scope_id=${scope.id}`,
              )
            )[0].n
          : 0,
        current: scope
          ? (
              await db.$queryRaw<Array<{ n: number }>>(
                Prisma.sql`SELECT count(*)::int n FROM intelligence_current_components WHERE owner_scope_id=${scope.id}`,
              )
            )[0].n
          : 0,
      };
    }
    async function source(
      owner: Awaited<ReturnType<typeof portfolioTestOwner>>,
      caption = (index: number) =>
        index < 3
          ? "Paid partnership with @example"
          : "Everyday product mention",
    ) {
      const capturedAt = new Date(Date.now() - 1000),
        fixture = await audienceV1ContentTestFixture(db, capturedAt, caption);
      try {
        const pipeline = audienceV1TestRuntime(db, fixture.provider).content(
          fixture.analyzer,
        );
        const input = {
          actor: owner.actor,
          integrationId: owner.integration.id,
          providerAccountId: owner.providerAccountId,
          authorizationGeneration: owner.integration.authorizationGeneration,
          capturedAt,
          requestIdentity: `portfolio-p2-${randomUUID()}`,
        };
        await pipeline.execute(input);
        return { fixture, input, pipeline };
      } catch (error) {
        await fixture.cleanup();
        throw error;
      }
    }
    it("admits exact completed source Evidence independent of performance, dual-source dedups, replay/roles/removed stability and no expensive work", async () => {
      const a = await portfolioTestOwner(db),
        s = await source(a);
      try {
        const before = await counts(a),
          expensive = s.fixture.providerCalls(),
          media = { ...s.fixture.external.count };
        const c04 = await portfolioC04Fixture(db, a);
        const first = PortfolioConsumerSchema.parse(
          await service.read(a.owner.auth),
        );
        expect(first.items).toHaveLength(3);
        expect(first.discovery).toBe("AVAILABLE");
        const dual = first.items.find((i) =>
          i.provenance.some((p) => p.source === "CREATOR_SHOP"),
        )!;
        expect(dual.provenance.map((p) => p.source)).toEqual([
          "CREATOR_SHOP",
          "INSTAGRAM",
        ]);
        expect(JSON.stringify(first)).not.toMatch(
          /sourceCaptureRef|evidenceRefs|authorizationGeneration|accountId|sourceHash/u,
        );
        const stable = await counts(a);
        const persistedRefs = await db.creatorPortfolioItem.findMany({
          where: { portfolio: { workspaceId: a.workspace.id } },
          select: { id: true, provenance: true, state: true },
          orderBy: { id: "asc" },
        });
        expect(stable.captures).toBe(before.captures);
        expect(stable.evidence).toBe(before.evidence);
        expect(stable.items).toBe(3);
        for (const actor of [a.owner, a.manager, a.assistant])
          expect(
            (await service.read(actor.auth)).items.map((i) => i.id),
          ).toEqual(first.items.map((i) => i.id));
        expect(await counts(a)).toEqual(stable);
        expect(
          await db.creatorPortfolioItem.findMany({
            where: { portfolio: { workspaceId: a.workspace.id } },
            select: { id: true, provenance: true, state: true },
            orderBy: { id: "asc" },
          }),
        ).toEqual(persistedRefs);
        console.info(
          JSON.stringify({
            gate: "P2_SOURCE_REPLAY_ROW_COUNTS",
            before,
            after: stable,
            providerFixtureCalls: expensive,
            mediaFixtureCalls: media,
            repeatExpensiveWork: 0,
            exactEvidenceRefs: true,
          }),
        );
        expect(s.fixture.providerCalls()).toBe(expensive);
        expect(s.fixture.external.count).toEqual(media);
        await service.mutate(a.owner.auth, {
          intent: "REMOVE",
          itemId: dual.id,
          expectedRevision: first.currentRevision,
          idempotencyKey: randomUUID(),
        });
        const removed = (
          await service.read(a.manager.auth, { filter: "REMOVED" })
        ).items;
        expect(removed.map((i) => i.id)).toEqual([dual.id]);
        expect((await service.read(a.owner.auth)).items).toHaveLength(2);
        const current = await db.collaboration.findUniqueOrThrow({
          where: { id: c04.collaboration.id },
        });
        expect(current.lifecycle).toBe("COMPLETED");
        const afterRemove = await counts(a);
        await service.read(a.assistant.auth);
        expect(await counts(a)).toEqual(afterRemove);
        expect((await s.pipeline.execute(s.input)).reused).toBe(true);
        expect(s.fixture.providerCalls()).toBe(expensive);
        const publishing =
          await db.collaborationPublishingExecution.findUniqueOrThrow({
            where: { deliverableExecutionId: c04.execution.id },
          });
        await db.collaborationPublishingEvidence.create({
          data: {
            publishingExecutionId: publishing.id,
            sequence: 2,
            evidenceRef: "https://www.instagram.com/p/DistinctCompletedWork/",
            submittedByUserId: a.actor.actorUserId,
            verifiedAt: new Date(),
          },
        });
        const multi = await service.read(a.owner.auth);
        expect(multi.items).toHaveLength(3);
        expect((await counts(a)).items).toBe(4);
        const multiStable = await counts(a);
        await service.read(a.assistant.auth);
        expect(await counts(a)).toEqual(multiStable);
        await service.mutate(a.manager.auth, {
          intent: "RESTORE",
          itemId: dual.id,
          expectedRevision: multi.currentRevision,
          idempotencyKey: randomUUID(),
        });
        expect((await service.read(a.owner.auth)).items).toHaveLength(4);
        const other = await portfolioTestOwner(db);
        await service.mutate(other.owner.auth, portfolioReference());
        const beforePurge = await counts(a);
        // Generic target-only FK proof, not a Portfolio/Settings production action.
        await db.creatorPortfolio.deleteMany({
          where: { workspaceId: a.workspace.id, ownerProfileId: a.profile.id },
        });
        const purged = await counts(a);
        expect(purged.items).toBe(0);
        expect(purged.audits).toBe(0);
        expect(purged.evidence).toBe(beforePurge.evidence);
        expect(purged.captures).toBe(beforePurge.captures);
        expect(
          await db.collaborationPublishingEvidence.count({
            where: { publishingExecutionId: publishing.id },
          }),
        ).toBe(2);
        expect((await counts(other)).items).toBe(1);
      } finally {
        await s.fixture.cleanup();
      }
    }, 120_000);
    it("UGC completed nonpublishing work qualifies without handle posting; incomplete/opaque C04 fails closed", async () => {
      const a = await portfolioTestOwner(db);
      const good = await portfolioC04Fixture(
        db,
        a,
        `https://drive.google.com/file/d/${randomUUID()}/view`,
        false,
      );
      await portfolioC04Fixture(
        db,
        a,
        "opaque-authorized-asset-without-consumer-link",
        false,
      );
      const value = await service.read(a.owner.auth);
      expect(value.items).toHaveLength(1);
      expect(value.items[0].kind).toBe("UGC");
      expect(value.items[0].provenance[0]).toMatchObject({
        source: "CREATOR_SHOP",
        verification: "COMPLETED_WORK",
      });
      expect(value.discovery).toBe("PARTIAL");
      await db.collaboration.update({
        where: { id: good.collaboration.id },
        data: { lifecycle: "ACTIVE", completedAt: null },
      });
      expect((await service.read(a.owner.auth)).items).toHaveLength(1); // derived history retained, never rewritten into canonical truth.
    }, 120_000);
    it("disconnect/account/generation/capability failure and source purge preserve last-good derived curation; other Creator cannot substitute", async () => {
      const a = await portfolioTestOwner(db),
        b = await portfolioTestOwner(db),
        s = await source(a);
      try {
        const first = await service.read(a.owner.auth),
          stable = await counts(a);
        expect(first.items).toHaveLength(3);
        const scopeForFailure =
          await db.intelligenceOwnerScope.findUniqueOrThrow({
            where: { ownerKey: `CREATOR:${a.profile.id}:${a.workspace.id}` },
          });
        const failedKey = `portfolio-failed-profile-${randomUUID()}`;
        await db.$executeRaw(Prisma.sql`INSERT INTO data_extraction_captures (id,capture_ref,owner_scope_id,brand_id,resource_ref,acquisition_request_key,status,started_at,acquisition_quality,provider_integration_id,provider_account_id,authorization_generation)
          SELECT ${randomUUID()},${`creator-content-capture:${failedKey}`},owner_scope_id,NULL,resource_ref,${failedKey},'FAILED',CURRENT_TIMESTAMP,'UNAVAILABLE',provider_integration_id,provider_account_id,authorization_generation
          FROM data_extraction_captures WHERE owner_scope_id=${scopeForFailure.id} AND status='COMPLETED' AND capture_ref LIKE 'creator-content-capture:%' LIMIT 1`);
        const failedRead = await service.read(a.owner.auth);
        expect(failedRead.discovery).toBe("UNAVAILABLE");
        expect(failedRead.items.map((i) => i.id)).toEqual(
          first.items.map((i) => i.id),
        );
        const failedCounts = await counts(a);
        expect(failedCounts.items).toBe(stable.items);
        expect(failedCounts.audits).toBe(stable.audits);
        expect(failedCounts.evidence).toBe(stable.evidence);
        expect((await service.read(b.owner.auth)).items).toEqual([]);
        for (const data of [
          { disconnectedAt: new Date() },
          { disconnectedAt: null, authorizationGeneration: 2 },
          { authorizationGeneration: 1, nativePlatformUserId: "other-account" },
          {
            nativePlatformUserId: a.providerAccountId,
            insightsCapability: "UNKNOWN" as const,
          },
        ]) {
          await db.creatorSocialIntegration.update({
            where: { id: a.integration.id },
            data,
          });
          const retained = await service.read(a.owner.auth);
          expect(retained.items.map((i) => i.id)).toEqual(
            first.items.map((i) => i.id),
          );
          expect(await counts(a)).toEqual(failedCounts);
        }
        await db.creatorSocialIntegration.update({
          where: { id: a.integration.id },
          data: {
            insightsCapability: "AVAILABLE",
            authorizationGeneration: 1,
            nativePlatformUserId: a.providerAccountId,
          },
        });
        const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
          where: { ownerKey: `CREATOR:${a.profile.id}:${a.workspace.id}` },
        });
        // Accepted internal purge is regression-only, not invoked by Portfolio production.
        await new IntelligenceOwnerScopeRepository(
          prisma,
        ).purgeCreatorInstagram(scope.id);
        expect(
          (await service.read(a.owner.auth)).items.map((i) => i.id),
        ).toEqual(first.items.map((i) => i.id));
        expect((await counts(a)).items).toBe(3);
        expect((await service.read(b.owner.auth)).items).toEqual([]);
        await expect(
          service.mutate(b.owner.auth, {
            intent: "REMOVE",
            itemId: first.items[0].id,
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toThrow();
      } finally {
        await s.fixture.cleanup();
      }
    }, 120_000);
  },
);

import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { InstagramIntelligenceProviderReadClient } from "../instagram/instagram-intelligence-provider.types";
import {
  audienceV1TestOwner,
  audienceV1TestRuntime,
} from "./creator-audience-v1.test-fixture";
import { AudienceV1ProcessorExecutor } from "./creator-audience-v1.processor";
import { AUDIENCE_V1_PATHS } from "./creator-audience-v1.contract";
import { audienceV1ContentTestFixture } from "./creator-audience-v1.content-test-fixture";
import { rm } from "node:fs/promises";
import { dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";

const enabled = process.env.CREATOR_AUDIENCE_V1_DATABASE_TEST === "true";
describe.skipIf(!enabled)(
  "Audience V1 admitted shared runtime PostgreSQL",
  () => {
    const db = new PrismaClient();
    let runtime: ReturnType<typeof audienceV1TestRuntime>;
    let calls = 0;
    let share = 60;
    let explicitZero = false;
    let mode: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" = "AVAILABLE";
    const provider: InstagramIntelligenceProviderReadClient = {
      readProfile: async () => ({
        availability: "AVAILABLE",
        providerAccountId: "fixture-account",
        appScopedUserId: { state: "OBSERVED", value: "fixture-account" },
        username: { state: "OBSERVED", value: "fixture" },
        name: { state: "OBSERVED", value: "Fixture" },
        accountType: { state: "OBSERVED", value: "CREATOR" },
        followersCount: { state: "OBSERVED", value: 1000 },
        followsCount: { state: "OBSERVED", value: 5 },
        mediaCount: { state: "OBSERVED", value: 10 },
      }),
      readAudienceInsights: async (_, population, breakdown) => {
        calls++;
        const available =
          mode !== "UNAVAILABLE" &&
          !(mode === "PARTIAL" && breakdown === "CITY");
        return {
          availability: available ? "AVAILABLE" : "UNAVAILABLE",
          population,
          breakdown,
          timeframe: "THIS_MONTH",
          denominator: available ? (explicitZero ? 0 : 100) : undefined,
          values: available
            ? [
                { dimension: "A", value: explicitZero ? 0 : share },
                { dimension: "B", value: explicitZero ? 0 : 100 - share },
              ]
            : [],
          limitation: available
            ? null
            : "PROVIDER_EMPTY_OR_THRESHOLD_SUPPRESSED",
        };
      },
      readMediaInventory: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
      readMediaInsights: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
      readCarouselChildren: async () => {
        throw new Error("UNEXPECTED_PROVIDER_METHOD");
      },
    };
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        url.hostname !== "localhost" ||
        url.port !== "55471" ||
        !["/creator_audience_v1_p1", "/creator_audience_v1_p4"].includes(
          url.pathname,
        )
      )
        throw new Error("TASK_OWNED_AUDIENCE_V1_DATABASE_REQUIRED");
      await db.$connect();
      runtime = audienceV1TestRuntime(db, provider);
      expect(runtime.contracts.isReady()).toBe(true);
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      await db.$disconnect();
    });
    async function acquire(
      fixture: Awaited<ReturnType<typeof audienceV1TestOwner>>,
      at = new Date("2026-09-15T10:00:00.000Z"),
    ) {
      return runtime.pipeline.execute({
        actor: fixture.actor,
        integrationId: fixture.integration.id,
        providerAccountId: fixture.providerAccountId,
        authorizationGeneration: 1,
        capturedAt: at,
        requestIdentity: `audience-v1-source:${randomUUID()}`,
      });
    }
    async function counts(
      fixture: Awaited<ReturnType<typeof audienceV1TestOwner>>,
    ) {
      const scope = await db.intelligenceOwnerScope.findUniqueOrThrow({
        where: {
          ownerKey: `CREATOR:${fixture.profile.id}:${fixture.workspace.id}`,
        },
      });
      const rows = await db.$queryRaw<Array<Record<string, bigint>>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM data_extraction_resources WHERE owner_scope_id=${scope.id}) resources,
        (SELECT count(*) FROM data_extraction_captures WHERE owner_scope_id=${scope.id}) captures,
        (SELECT count(*) FROM data_extraction_evidence_items WHERE owner_scope_id=${scope.id}) evidence,
        (SELECT count(*) FROM data_extraction_semantic_observations WHERE owner_scope_id=${scope.id}) observations,
        (SELECT count(*) FROM data_extraction_observation_support WHERE owner_scope_id=${scope.id}) support,
        (SELECT count(*) FROM intelligence_executions WHERE owner_scope_id=${scope.id}) executions,
        (SELECT count(*) FROM intelligence_processor_executions WHERE owner_scope_id=${scope.id}) processors,
        (SELECT count(*) FROM intelligence_processor_attempts WHERE owner_scope_id=${scope.id}) attempts,
        (SELECT count(*) FROM intelligence_object_generations WHERE owner_scope_id=${scope.id}) objects,
        (SELECT count(*) FROM intelligence_component_generations WHERE owner_scope_id=${scope.id}) components,
        (SELECT count(*) FROM intelligence_component_transitions WHERE owner_scope_id=${scope.id}) transitions,
        (SELECT count(*) FROM intelligence_current_components WHERE owner_scope_id=${scope.id}) current`);
      return { scope, values: rows[0] };
    }
    it("persists exact DE/Capture/Evidence → verified V1 generation/CAS/current and replays with stable rows", async () => {
      mode = "AVAILABLE";
      share = 60;
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const before = calls;
      const first = await runtime.v1.execute(
        fixture.actor,
        new Date("2026-09-15T10:00:00.000Z"),
      );
      expect(first.reused).toBe(false);
      expect(first.generationIds).toHaveLength(1);
      const after = await counts(fixture);
      expect(after.values).toEqual({
        resources: 1n,
        captures: 1n,
        evidence: 8n,
        observations: 0n,
        support: 0n,
        executions: 2n,
        processors: 2n,
        attempts: 2n,
        objects: 2n,
        components: 10n,
        transitions: 10n,
        current: 10n,
      });
      const replay = await runtime.v1.execute(
        fixture.actor,
        new Date("2026-09-15T11:00:00.000Z"),
      );
      expect(replay.reused).toBe(true);
      expect(replay.generationIds).toEqual(first.generationIds);
      expect(replay.value).toEqual(first.value);
      expect(calls).toBe(before);
      expect((await counts(fixture)).values).toEqual(after.values);
      const lineage = await db.intelligenceEvidenceReference.findMany({
        select: {
          evidenceRef: true,
          capabilityId: true,
          captureId: true,
          capturedAt: true,
        },
        where: {
          ownerScopeId: after.scope.id,
          objectGenerationId: first.generationIds[0],
        },
      });
      expect(lineage.length).toBeGreaterThan(0);
      expect(
        lineage.every(
          (row) =>
            row.capabilityId.startsWith("instagram.audience_") &&
            row.captureId &&
            row.capturedAt,
        ),
      ).toBe(true);
      expect(new Set(lineage.map((row) => row.evidenceRef)).size).toBe(8);
    }, 20_000);
    it("preserves explicit zero counts and invalid-denominator missingness on replay", async () => {
      mode = "AVAILABLE";
      explicitZero = true;
      try {
        const fixture = await audienceV1TestOwner(db);
        await acquire(fixture);
        const first = await runtime.v1.execute(fixture.actor);
        expect(first.value?.overview.accountFollowerCount).toBe(1000);
        expect(
          first.value?.overview.facts.every(
            (row) => row.count === 0 && row.percentage === null,
          ),
        ).toBe(true);
        expect(
          first.value?.profiles.every((row) => row.cohortSize === null),
        ).toBe(true);
        const before = await counts(fixture);
        const replay = await runtime.v1.execute(fixture.actor);
        expect(replay.reused).toBe(true);
        expect(replay.value).toEqual(first.value);
        expect((await counts(fixture)).values).toEqual(before.values);
      } finally {
        explicitZero = false;
      }
    }, 20_000);
    it("retains partial first-current and preserves it exactly on successful replay", async () => {
      mode = "PARTIAL";
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const first = await runtime.v1.execute(fixture.actor);
      expect(first.state).toBe("PARTIAL");
      expect(
        first.value?.profiles.every(
          (row) => row.coverage.availableDimensions === 3,
        ),
      ).toBe(true);
      const state = await counts(fixture);
      const replay = await runtime.v1.execute(fixture.actor);
      expect(replay.reused).toBe(true);
      expect(replay.value).toEqual(first.value);
      expect((await counts(fixture)).values).toEqual(state.values);
    }, 20_000);
    it("does not replace a valid derived current with changed partial input", async () => {
      mode = "AVAILABLE";
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const first = await runtime.v1.execute(fixture.actor);
      mode = "PARTIAL";
      share = 80;
      await acquire(fixture, new Date("2026-09-16T10:00:00.000Z"));
      const before = await counts(fixture);
      const partial = await runtime.v1.execute(fixture.actor);
      expect(partial.currentPreserved).toBe(true);
      expect(partial.generationIds).toEqual(first.generationIds);
      expect(partial.value).toEqual(first.value);
      expect((await counts(fixture)).values).toEqual(before.values);
    }, 20_000);
    it("does not create derived current from unavailable source", async () => {
      mode = "UNAVAILABLE";
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const before = await counts(fixture);
      expect((await runtime.v1.execute(fixture.actor)).state).toBe(
        "UNAVAILABLE",
      );
      expect((await counts(fixture)).values).toEqual(before.values);
    }, 20_000);
    it("recovers comparable retained history with exact per-Capture support", async () => {
      mode = "AVAILABLE";
      const fixture = await audienceV1TestOwner(db);
      share = 50;
      await acquire(fixture, new Date("2026-09-01T10:00:00.000Z"));
      share = 60;
      await acquire(fixture, new Date("2026-09-08T10:00:00.000Z"));
      share = 70;
      await acquire(fixture);
      const result = await runtime.v1.execute(
        fixture.actor,
        new Date("2026-09-15T10:00:00.000Z"),
      );
      expect(result.value?.change.state).toBe("AVAILABLE");
      expect(result.value?.change.observations[0]).toMatchObject({
        snapshotCount: 3,
        elapsedDays: 14,
        percentagePointDelta: 20,
      });
      const rows = await db.intelligenceEvidenceReference.findMany({
        where: {
          objectGenerationId: result.generationIds[0],
          componentSemanticPath: AUDIENCE_V1_PATHS[3],
        },
        select: { captureId: true },
      });
      expect(new Set(rows.map((row) => row.captureId)).size).toBe(3);
    }, 20_000);
    it("canonicalizes retained input identity independently of database Evidence row order", async () => {
      mode = "AVAILABLE";
      const fixture = await audienceV1TestOwner(db);
      share = 50;
      await acquire(fixture, new Date("2026-09-01T10:00:00.000Z"));
      share = 60;
      await acquire(fixture, new Date("2026-09-08T10:00:00.000Z"));
      share = 70;
      await acquire(fixture);
      const now = new Date("2026-09-15T10:00:00.000Z");
      await db.$transaction(async (tx) => {
        const first = await runtime.source.readInTransaction(
          tx,
          fixture.actor,
          now,
        );
        const shuffled = new Proxy(tx, {
          get(target, property) {
            if (property === "dataExtractionEvidenceItem")
              return new Proxy(target.dataExtractionEvidenceItem, {
                get(delegate, key) {
                  if (key === "findMany")
                    return async (args: unknown) =>
                      [...(await delegate.findMany(args as never))].reverse();
                  return Reflect.get(delegate, key);
                },
              });
            return Reflect.get(target, property);
          },
        });
        const second = await runtime.source.readInTransaction(
          shuffled,
          fixture.actor,
          now,
        );
        expect(first).not.toBeNull();
        expect(second?.manifest).toEqual(first?.manifest);
        expect(second?.value).toEqual(first?.value);
      });
    }, 20_000);
    it.each([
      "disconnect",
      "generation",
      "account",
      "capability",
      "inactive",
    ] as const)(
      "rejects current %s before replay with no new rows",
      async (kind) => {
        mode = "AVAILABLE";
        const fixture = await audienceV1TestOwner(db);
        await acquire(fixture);
        await runtime.v1.execute(fixture.actor);
        const before = await counts(fixture);
        await db.creatorSocialIntegration.update({
          where: { id: fixture.integration.id },
          data:
            kind === "disconnect"
              ? { disconnectedAt: new Date() }
              : kind === "generation"
                ? { authorizationGeneration: 2 }
                : kind === "account"
                  ? { nativePlatformUserId: `other-account-${randomUUID()}` }
                  : kind === "capability"
                    ? { insightsCapability: "UNAVAILABLE" }
                    : { tokenStateCondition: "EXPIRED" },
        });
        await expect(runtime.v1.execute(fixture.actor)).rejects.toThrow(
          /FENCE_REJECTED|IDENTITY_MISMATCH/u,
        );
        expect((await counts(fixture)).values).toEqual(before.values);
      },
      20_000,
    );
    it("rejects a cross-Creator workspace substitution atomically", async () => {
      mode = "AVAILABLE";
      const first = await audienceV1TestOwner(db);
      const second = await audienceV1TestOwner(db);
      await acquire(first);
      await runtime.v1.execute(first.actor);
      const before = await counts(first);
      await expect(
        runtime.v1.execute({
          ...first.actor,
          workspaceId: second.workspace.id,
        }),
      ).rejects.toThrow("SUBJECT_MISMATCH");
      expect((await counts(first)).values).toEqual(before.values);
    }, 20_000);
    it("rejects substituted source Evidence hash without new derived rows", async () => {
      mode = "AVAILABLE";
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      await runtime.v1.execute(fixture.actor);
      const before = await counts(fixture);
      const item = await db.dataExtractionEvidenceItem.findFirstOrThrow({
        select: { id: true },
        where: { ownerScopeId: before.scope.id },
      });
      await db.dataExtractionEvidenceItem.update({
        select: { id: true },
        where: { id: item.id },
        data: { contentHash: "f".repeat(64) },
      });
      await expect(runtime.v1.execute(fixture.actor)).rejects.toThrow(
        "EVIDENCE_IDENTITY_MISMATCH",
      );
      expect((await counts(fixture)).values).toEqual(before.values);
    }, 20_000);
    it("failed changed execution records shared failure and preserves prior valid current", async () => {
      mode = "AVAILABLE";
      share = 60;
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const first = await runtime.v1.execute(fixture.actor);
      share = 75;
      await acquire(fixture, new Date("2026-09-16T10:00:00.000Z"));
      const before = await counts(fixture);
      const spy = vi
        .spyOn(AudienceV1ProcessorExecutor.prototype, "execute")
        .mockRejectedValueOnce(new Error("SYNTHETIC_TEST_FAILURE"));
      await expect(runtime.v1.execute(fixture.actor)).rejects.toThrow(
        "FAILED_CURRENT_PRESERVED",
      );
      spy.mockRestore();
      const after = await counts(fixture);
      expect(after.values.objects).toBe(before.values.objects);
      expect(after.values.current).toBe(before.values.current);
      const rows = await db.$queryRaw<
        Array<{ objectGenerationId: string }>
      >(Prisma.sql`
      SELECT g.object_generation_id AS "objectGenerationId" FROM intelligence_current_components c
      JOIN intelligence_component_generations g ON g.owner_scope_id=c.owner_scope_id AND g.component_generation_id=c.current_component_generation_id
      WHERE c.owner_scope_id=${before.scope.id} AND c.component_semantic_path IN
        ('$/f/audience_overview','$/f/audience_profiles','$/f/audience_content_context','$/f/audience_change')`);
      expect(rows).toHaveLength(4);
      expect(
        rows.every((row) => row.objectGenerationId === first.generationIds[0]),
      ).toBe(true);
      expect(
        await db.intelligenceProcessorExecution.count({
          where: {
            ownerScopeId: before.scope.id,
            processorId: "creator_audience_v1",
            status: "FAILED_TERMINAL",
          },
        }),
      ).toBe(1);
    }, 20_000);
    it("rejects mid-flight authorization-generation change at shared finalization without replacing current", async () => {
      mode = "AVAILABLE";
      share = 60;
      const fixture = await audienceV1TestOwner(db);
      await acquire(fixture);
      const first = await runtime.v1.execute(fixture.actor);
      share = 75;
      await acquire(fixture, new Date("2026-09-16T10:00:00.000Z"));
      const before = await counts(fixture);
      const original = AudienceV1ProcessorExecutor.prototype.execute;
      const spy = vi
        .spyOn(AudienceV1ProcessorExecutor.prototype, "execute")
        .mockImplementationOnce(async function (context) {
          const result = await original.call(this, context);
          await db.creatorSocialIntegration.update({
            where: { id: fixture.integration.id },
            data: { authorizationGeneration: 2 },
          });
          return result;
        });
      try {
        await expect(runtime.v1.execute(fixture.actor)).rejects.toThrow(
          "FAILED_CURRENT_PRESERVED",
        );
      } finally {
        spy.mockRestore();
      }
      const after = await counts(fixture);
      expect(after.values.objects).toBe(before.values.objects);
      expect(after.values.current).toBe(before.values.current);
      expect(
        await db.intelligenceObjectGeneration.count({
          where: { id: first.generationIds[0] },
        }),
      ).toBe(1);
      expect(
        await db.intelligenceProcessorExecution.count({
          where: {
            ownerScopeId: before.scope.id,
            processorId: "creator_audience_v1",
            status: "FAILED_TERMINAL",
            lastErrorCode: "CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED",
          },
        }),
      ).toBe(1);
    }, 20_000);
    it("admits accepted Content model-derivation lineage as separate facts and omits it at the 48h boundary", async () => {
      mode = "AVAILABLE";
      share = 60;
      const fixture = await audienceV1TestOwner(db);
      const cutoff = new Date("2026-09-15T10:00:00.000Z");
      const contentFixture = await audienceV1ContentTestFixture(db, cutoff);
      try {
        const local = audienceV1TestRuntime(db, {
          ...contentFixture.provider,
          readProfile: provider.readProfile,
          readAudienceInsights: provider.readAudienceInsights,
        });
        await local.pipeline.execute({
          actor: fixture.actor,
          integrationId: fixture.integration.id,
          providerAccountId: fixture.providerAccountId,
          authorizationGeneration: 1,
          capturedAt: cutoff,
          requestIdentity: `audience-context:${randomUUID()}`,
        });
        await local.content(contentFixture.analyzer).execute({
          actor: fixture.actor,
          integrationId: fixture.integration.id,
          providerAccountId: fixture.providerAccountId,
          authorizationGeneration: 1,
          capturedAt: cutoff,
          requestIdentity: `content-context:${randomUUID()}`,
        });
        const first = await local.v1.execute(fixture.actor, cutoff);
        expect(first.value?.contentContext.length).toBeGreaterThan(0);
        expect(first.value?.contentContext.length).toBeLessThanOrEqual(2);
        const sourceCalls = contentFixture.providerCalls();
        const modelCalls = { ...contentFixture.external.count };
        const after = await counts(fixture);
        const replay = await local.v1.execute(
          fixture.actor,
          new Date(cutoff.getTime() + 3_600_000),
        );
        expect(replay.reused).toBe(true);
        expect(replay.value).toEqual(first.value);
        expect(contentFixture.providerCalls()).toBe(sourceCalls);
        expect(contentFixture.external.count).toEqual(modelCalls);
        expect((await counts(fixture)).values).toEqual(after.values);
        const refs = first.value!.contentContext.flatMap(
          (row) => row.contentFact.evidenceRefs,
        );
        const support = await db.intelligenceEvidenceReference.findMany({
          select: { evidenceRef: true, captureId: true, capabilityId: true },
          where: {
            objectGenerationId: first.generationIds[0],
            componentSemanticPath: AUDIENCE_V1_PATHS[2],
          },
        });
        expect(
          refs.every((ref) =>
            support.some(
              (row) =>
                row.evidenceRef === ref &&
                row.capabilityId === "instagram.media_insights",
            ),
          ),
        ).toBe(true);
        const stale = await local.source.read(
          fixture.actor,
          new Date(cutoff.getTime() + 48 * 3_600_000),
        );
        expect(stale?.value.contentContext).toEqual([]);
        expect(stale?.value.overview.facts).toEqual(
          first.value!.overview.facts,
        );
        expect(stale?.value.status).toBe("READY");
      } finally {
        const root = resolve(
          dirname(contentFixture.external.imageStore.getRootForDiagnostics()),
        );
        if (
          dirname(root) !== resolve(tmpdir()) ||
          !/^creator-content-correction-audience-v1-[a-f0-9-]+$/u.test(
            basename(root),
          )
        )
          throw new Error("TASK_TEMP_CLEANUP_SCOPE_REJECTED");
        await rm(root, { recursive: true, force: true });
      }
    }, 30_000);
    it("Settings-owned purge removes target V0/V1 rows while the other Creator survives", async () => {
      mode = "AVAILABLE";
      const first = await audienceV1TestOwner(db);
      const second = await audienceV1TestOwner(db);
      await acquire(first);
      await runtime.v1.execute(first.actor);
      await acquire(second);
      await runtime.v1.execute(second.actor);
      const other = await counts(second);
      const scope = (await counts(first)).scope;
      const websiteRef = `audience-v1-website:${randomUUID()}`;
      await db.$executeRaw(Prisma.sql`
        INSERT INTO data_extraction_resources
          (id, resource_ref, owner_scope_id, brand_id, source_class, resource_type,
           canonical_resource_key, canonical_resource_key_hash, canonical_url)
        VALUES (${randomUUID()},${websiteRef},${scope.id},NULL,'OWNED_WEBSITE','OWNED_WEB_PAGE',
          ${websiteRef},${"f".repeat(64)},'https://creator.example.test/about')`);
      await runtime.scopes.purgeCreatorInstagram(scope.id);
      expect((await counts(first)).values).toEqual({
        resources: 1n,
        captures: 0n,
        evidence: 0n,
        observations: 0n,
        support: 0n,
        executions: 0n,
        processors: 0n,
        attempts: 0n,
        objects: 0n,
        components: 0n,
        transitions: 0n,
        current: 0n,
      });
      expect((await counts(second)).values).toEqual(other.values);
      expect(
        await db.dataExtractionResource.count({
          where: { resourceRef: websiteRef },
        }),
      ).toBe(1);
    }, 20_000);
  },
);

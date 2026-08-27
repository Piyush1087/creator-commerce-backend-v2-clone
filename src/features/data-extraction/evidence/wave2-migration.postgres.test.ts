import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DATA_EXTRACTION_EVIDENCE_CAPABILITIES,
  WAVE1_EVIDENCE_CAPABILITIES,
} from "./domain/evidence-vocabulary";

const migrationName =
  "20260826180000_data_extraction_wave2_supported_capabilities";
const pairs = [
  ["data_extraction_capability_executions", "capexec"],
  ["data_extraction_capability_resources", "capresource"],
  ["data_extraction_evidence_items", "evidence"],
  ["data_extraction_capability_evidence", "capevidence"],
  ["data_extraction_semantic_observations", "observation"],
  ["data_extraction_observation_support", "obs_support"],
  ["data_extraction_observation_relations", "obs_relation"],
] as const;
const allTables = [
  ...pairs.map(([table]) => table),
  "data_extraction_resources",
  "data_extraction_captures",
  "data_extraction_content_artifacts",
  "data_extraction_freshness_assessments",
  "data_extraction_provider_execution_links",
];
const databaseUrl = process.env.DE_W2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const upgrade = process.env.DE_W2_MIGRATION_PHASE === "UPGRADE";
const database = databaseUrl ? describe : describe.skip;

describe("DE-W2 approved migration shape", () => {
  it("contains only seven closed CHECK replacements in a transaction", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations", migrationName, "migration.sql"),
      "utf8",
    );
    expect(sql.match(/DROP CONSTRAINT/g)).toHaveLength(7);
    expect(sql.match(/ADD CONSTRAINT/g)).toHaveLength(7);
    expect(sql).not.toMatch(
      /CREATE TABLE|ADD COLUMN|CREATE TYPE|UPDATE |INSERT |DELETE |TRUNCATE|LIKE |DROP TABLE|DROP COLUMN/i,
    );
    const checks = [
      ...sql.matchAll(/CHECK \("capability_id" IN \(([\s\S]*?)\)\)/g),
    ];
    expect(checks).toHaveLength(7);
    for (const check of checks)
      expect([...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(
        DATA_EXTRACTION_EVIDENCE_CAPABILITIES,
      );
    for (const [table, key] of pairs) {
      expect(sql).toContain(`ALTER TABLE "${table}"`);
      expect(sql).toContain(`DROP CONSTRAINT "ck_de_${key}_wave1_capability"`);
      expect(sql).toContain(
        `ADD CONSTRAINT "ck_de_${key}_supported_capability"`,
      );
    }
  });
});

database("DE-W2 seven-constraint PostgreSQL compatibility", () => {
  const prisma = new PrismaClient();
  let upgradeBefore: unknown;
  let upgradeAfter: unknown;
  let fixtures: Awaited<ReturnType<typeof seed>>[] = [];
  async function brand() {
    return prisma.brandProfile.create({
      data: {
        domain: `w2-migration-${randomUUID()}.example`,
        name: "Migration fixture",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
  }
  async function seed(brandId: string, capabilityId: string) {
    const suffix = randomUUID();
    const resource = await prisma.dataExtractionResource.create({
      data: {
        brandId,
        resourceRef: `resource:${suffix}`,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        pageRole: "HOMEPAGE",
        canonicalResourceKey: suffix,
        canonicalResourceKeyHash: suffix,
        canonicalUrl: `https://fixture.example/${suffix}`,
      },
    });
    const execution = await prisma.dataExtractionCapabilityExecution.create({
      data: {
        brandId,
        capabilityId,
        capabilityExecutionRef: `capability-execution:${suffix}`,
        normalizationContractVersion: "1.0",
        resourceScopeHash: suffix,
        freshnessIntent: "REUSE_ALLOWED",
        requestKey: suffix,
        availability: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: "COMPLETE",
        completedAt: new Date("2026-08-26T00:00:00Z"),
      },
    });
    const capture = await prisma.dataExtractionCapture.create({
      data: {
        brandId,
        resourceRef: resource.resourceRef,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        captureRef: `capture:${suffix}`,
        acquisitionRequestKey: suffix,
        status: "COMPLETED",
        startedAt: new Date("2026-08-26T00:00:00Z"),
        capturedAt: new Date("2026-08-26T00:00:01Z"),
        acquisitionQuality: "COMPLETE",
      },
    });
    const content = await prisma.dataExtractionContentArtifact.create({
      data: {
        brandId,
        captureRef: capture.captureRef,
        contentArtifactRef: `content:${suffix}`,
        kind: "NORMALIZED_TEXT",
        mediaType: "text/plain",
        contentHash: suffix,
        byteLength: 7,
        inlineContent: "fixture",
      },
    });
    const evidence = await prisma.dataExtractionEvidenceItem.create({
      data: {
        brandId,
        capabilityId,
        evidenceRef: `evidence:${suffix}`,
        normalizationContractVersion: "1.0",
        resourceRef: resource.resourceRef,
        captureRef: capture.captureRef,
        contentArtifactRef: content.contentArtifactRef,
        boundedPayload: { statement: "Fixture preserved unchanged" },
        contentHash: suffix,
        representativeness: "CONTEXT_SPECIFIC",
        coverageSnapshot: "SINGLE_RESOURCE",
        freshnessAtEmission: "CURRENT",
        freshnessBasis: "FIXTURE",
        freshnessEvaluatedAt: new Date("2026-08-26T00:00:01Z"),
        qualitySnapshot: "COMPLETE",
        itemFingerprint: suffix,
        semanticObservationKey: `observation:${suffix}`,
      },
    });
    const source = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId,
        capabilityId,
        semanticObservationKey: `observation:${suffix}`,
      },
    });
    const target = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId,
        capabilityId,
        semanticObservationKey: `observation:other:${suffix}`,
      },
    });
    await prisma.dataExtractionCapabilityResource.create({
      data: {
        brandId,
        capabilityId,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        resourceRef: resource.resourceRef,
      },
    });
    await prisma.dataExtractionCapabilityEvidence.create({
      data: {
        brandId,
        capabilityId,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        evidenceRef: evidence.evidenceRef,
      },
    });
    await prisma.dataExtractionObservationSupport.create({
      data: {
        brandId,
        capabilityId,
        semanticObservationKey: source.semanticObservationKey,
        evidenceRef: evidence.evidenceRef,
      },
    });
    await prisma.dataExtractionObservationRelation.create({
      data: {
        brandId,
        capabilityId,
        sourceObservationKey: source.semanticObservationKey,
        targetObservationKey: target.semanticObservationKey,
        relationType: "CONFLICTS_WITH",
      },
    });
    await prisma.dataExtractionFreshnessAssessment.create({
      data: {
        brandId,
        targetType: "CAPTURE",
        targetRef: capture.captureRef,
        state: "CURRENT",
        basis: "FIXTURE",
        evaluatedAt: new Date("2026-08-26T00:00:01Z"),
        priorCaptureRef: capture.captureRef,
      },
    });
    await prisma.dataExtractionProviderExecutionLink.create({
      data: {
        brandId,
        captureRef: capture.captureRef,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        providerExecutionRef: `provider-execution:${suffix}`,
        attemptRole: "PRIMARY",
      },
    });
    return {
      brandId,
      capabilityId,
      resource,
      execution,
      capture,
      content,
      evidence,
      source,
      target,
    };
  }
  async function snapshot(brandId: string) {
    const snapshot: Record<string, unknown> = {};
    for (const table of allTables) {
      // Table identifiers are this test's fixed allow-list; Brand ID remains parameterized.
      snapshot[table] = await prisma.$queryRawUnsafe(
        `SELECT to_jsonb(t) AS row, t.xmin::text AS xmin, t.ctid::text AS tuple FROM "${table}" t WHERE brand_id = $1 ORDER BY to_jsonb(t)::text`,
        brandId,
      );
    }
    return snapshot;
  }
  beforeAll(async () => {
    await prisma.$connect();
    if (upgrade) {
      const url = new URL(databaseUrl!);
      if (
        url.hostname !== "127.0.0.1" ||
        !/^\/codex_de_w2_[a-f0-9]{12}$/.test(url.pathname)
      )
        throw new Error("MIGRATION_TEST_REQUIRES_CREATED_DISPOSABLE_DATABASE");
      const applied = await prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      expect(Number(applied[0].count)).toBe(48);
      const owner = await brand();
      for (const id of WAVE1_EVIDENCE_CAPABILITIES) await seed(owner.id, id);
      upgradeBefore = await snapshot(owner.id);
      const foreignKeysBefore =
        await prisma.$queryRaw`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype = 'f' ORDER BY conname`;
      await promisify(execFile)(
        process.execPath,
        ["node_modules/prisma/build/index.js", "migrate", "deploy"],
        { cwd: process.cwd(), timeout: 180_000 },
      );
      upgradeAfter = await snapshot(owner.id);
      expect(upgradeAfter).toEqual(upgradeBefore);
      expect(
        await prisma.$queryRaw`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE contype = 'f' ORDER BY conname`,
      ).toEqual(foreignKeysBefore);
    }
    const owner = await brand();
    fixtures = [];
    for (const id of DATA_EXTRACTION_EVIDENCE_CAPABILITIES)
      fixtures.push(await seed(owner.id, id));
  }, 240_000);
  afterAll(async () => prisma.$disconnect());

  it.skipIf(!upgrade)(
    "preserves populated W1 rows, timestamps, Evidence refs, execution refs and observation keys across 48→49",
    () => {
      expect(upgradeBefore).toBeDefined();
      expect(upgradeAfter).toEqual(upgradeBefore);
    },
  );
  it("retains the seven renamed explicit nine-ID checks after migration 50", async () => {
    const migrations = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(Number(migrations[0].count)).toBe(50);
    const constraints = await prisma.$queryRaw<
      Array<{ conname: string; definition: string }>
    >`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname LIKE 'ck_de_%capability'`;
    expect(constraints.map((c) => c.conname).sort()).toEqual(
      pairs.map(([, key]) => `ck_de_${key}_supported_capability`).sort(),
    );
    for (const row of constraints)
      expect(
        [...row.definition.matchAll(/'([^']+)'/g)].map((m) => m[1]),
      ).toEqual(DATA_EXTRACTION_EVIDENCE_CAPABILITIES);
  });
  it.each(DATA_EXTRACTION_EVIDENCE_CAPABILITIES)(
    "accepts %s through all seven constrained tables",
    async (id) => {
      const fixture = fixtures.find((f) => f.capabilityId === id)!;
      for (const [table] of pairs) {
        const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT count(*) FROM "${table}" WHERE brand_id=$1 AND capability_id=$2`,
          fixture.brandId,
          id,
        );
        expect(Number(rows[0].count)).toBeGreaterThan(0);
      }
    },
  );
  it.each(pairs)(
    "rejects unapproved IDs at %s using its CHECK, not only a FK",
    async (table, key) => {
      const owner = fixtures[0].brandId;
      for (const unknown of [
        "owned_website.unapproved_test_capability",
        "instagram.owned_brand_context",
        "similarweb.brand_context",
        "owned_website.imagery_evidence",
        "owned_website.graphic_treatment_evidence",
      ]) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET capability_id=$1 WHERE brand_id=$2`,
            unknown,
            owner,
          );
          throw new Error("UNKNOWN_CAPABILITY_ACCEPTED");
        } catch (error) {
          expect(error).toMatchObject({
            code: "P2010",
            meta: { code: "23514" },
          });
          expect(String(error)).toContain(`ck_de_${key}_supported_capability`);
        }
      }
    },
  );
  it("keeps capability-consistent composite foreign keys and cross-Brand isolation", async () => {
    const a = fixtures[0];
    const b = fixtures[5];
    await expect(
      prisma.dataExtractionCapabilityEvidence.create({
        data: {
          brandId: a.brandId,
          capabilityId: a.capabilityId,
          capabilityExecutionRef: a.execution.capabilityExecutionRef,
          evidenceRef: b.evidence.evidenceRef,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.dataExtractionObservationSupport.create({
        data: {
          brandId: a.brandId,
          capabilityId: a.capabilityId,
          semanticObservationKey: a.source.semanticObservationKey,
          evidenceRef: b.evidence.evidenceRef,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.dataExtractionObservationRelation.create({
        data: {
          brandId: a.brandId,
          capabilityId: a.capabilityId,
          sourceObservationKey: a.source.semanticObservationKey,
          targetObservationKey: b.target.semanticObservationKey,
          relationType: "CONFLICTS_WITH",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    const other = await brand();
    await expect(
      prisma.dataExtractionCapabilityResource.create({
        data: {
          brandId: other.id,
          capabilityId: a.capabilityId,
          capabilityExecutionRef: a.execution.capabilityExecutionRef,
          resourceRef: a.resource.resourceRef,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.dataExtractionCapture.create({
        data: {
          brandId: other.id,
          resourceRef: a.resource.resourceRef,
          captureRef: randomUUID(),
          acquisitionRequestKey: randomUUID(),
          startedAt: new Date(),
          acquisitionQuality: "COMPLETE",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

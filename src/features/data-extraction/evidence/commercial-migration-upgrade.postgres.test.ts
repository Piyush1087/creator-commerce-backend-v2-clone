import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DATA_EXTRACTION_EVIDENCE_CAPABILITIES } from "./domain/evidence-vocabulary";

const databaseUrl = process.env.DE_P2B2_MIGRATION_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;
const tables = [
  "data_extraction_capability_executions",
  "data_extraction_capability_resources",
  "data_extraction_evidence_items",
  "data_extraction_capability_evidence",
  "data_extraction_semantic_observations",
  "data_extraction_observation_support",
  "data_extraction_observation_relations",
] as const;

database("P2B-2 populated active-to-converged migration", () => {
  const prisma = new PrismaClient();
  let before: unknown;
  let after: unknown;

  async function seed(capabilityId: string) {
    const suffix = randomUUID();
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `p2b2-migration-${suffix}.example`,
        name: "P2B-2 migration fixture",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    const resource = await prisma.dataExtractionResource.create({
      data: {
        brandId: brand.id,
        resourceRef: `resource:${suffix}`,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        pageRole: "OFFERING_DETAIL",
        canonicalResourceKey: suffix,
        canonicalResourceKeyHash: suffix,
        canonicalUrl: `https://fixture.example/${suffix}`,
      },
    });
    const execution = await prisma.dataExtractionCapabilityExecution.create({
      data: {
        brandId: brand.id,
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
        completedAt: new Date("2026-08-28T00:00:02Z"),
      },
    });
    const capture = await prisma.dataExtractionCapture.create({
      data: {
        brandId: brand.id,
        resourceRef: resource.resourceRef,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        captureRef: `capture:${suffix}`,
        acquisitionRequestKey: suffix,
        status: "COMPLETED",
        startedAt: new Date("2026-08-28T00:00:00Z"),
        capturedAt: new Date("2026-08-28T00:00:01Z"),
        acquisitionQuality: "COMPLETE",
      },
    });
    const content = await prisma.dataExtractionContentArtifact.create({
      data: {
        brandId: brand.id,
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
        brandId: brand.id,
        capabilityId,
        evidenceRef: `evidence:${suffix}`,
        normalizationContractVersion: "1.0",
        resourceRef: resource.resourceRef,
        captureRef: capture.captureRef,
        contentArtifactRef: content.contentArtifactRef,
        boundedPayload: { fixture: true },
        contentHash: suffix,
        representativeness: "OFFERING_SPECIFIC",
        coverageSnapshot: "SINGLE_RESOURCE",
        freshnessAtEmission: "CURRENT",
        freshnessBasis: "FIXTURE",
        freshnessEvaluatedAt: new Date("2026-08-28T00:00:01Z"),
        qualitySnapshot: "COMPLETE",
        itemFingerprint: suffix,
        semanticObservationKey: `observation:${suffix}`,
      },
    });
    const source = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId: brand.id,
        capabilityId,
        semanticObservationKey: `observation:${suffix}`,
      },
    });
    const target = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId: brand.id,
        capabilityId,
        semanticObservationKey: `observation:other:${suffix}`,
      },
    });
    await prisma.dataExtractionCapabilityResource.create({
      data: {
        brandId: brand.id,
        capabilityId,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        resourceRef: resource.resourceRef,
      },
    });
    await prisma.dataExtractionCapabilityEvidence.create({
      data: {
        brandId: brand.id,
        capabilityId,
        capabilityExecutionRef: execution.capabilityExecutionRef,
        evidenceRef: evidence.evidenceRef,
      },
    });
    await prisma.dataExtractionObservationSupport.create({
      data: {
        brandId: brand.id,
        capabilityId,
        semanticObservationKey: source.semanticObservationKey,
        evidenceRef: evidence.evidenceRef,
      },
    });
    await prisma.dataExtractionObservationRelation.create({
      data: {
        brandId: brand.id,
        capabilityId,
        sourceObservationKey: source.semanticObservationKey,
        targetObservationKey: target.semanticObservationKey,
        relationType: "CONFLICTS_WITH",
      },
    });
    return brand.id;
  }

  async function snapshot(brandId: string) {
    const result: Record<string, unknown> = {};
    for (const table of tables)
      result[table] = await prisma.$queryRawUnsafe(
        `SELECT to_jsonb(t) AS row, t.xmin::text AS xmin, t.ctid::text AS tuple FROM "${table}" t WHERE brand_id=$1 ORDER BY to_jsonb(t)::text`,
        brandId,
      );
    return result;
  }

  beforeAll(async () => {
    const parsed = new URL(databaseUrl!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      !/^\/codex_p2b2_migration_[a-f0-9]{12}$/.test(parsed.pathname)
    )
      throw new Error("MIGRATION_TEST_REQUIRES_DISPOSABLE_DATABASE");
    await prisma.$connect();
    const initial = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(Number(initial[0].count)).toBe(63);
    const brandId = await seed("owned_website.offering_context");
    before = await snapshot(brandId);
    await promisify(execFile)(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { cwd: process.cwd(), timeout: 180_000 },
    );
    after = await snapshot(brandId);
    await seed("owned_website.offering_commercial_evidence");
  }, 240_000);

  afterAll(async () => prisma.$disconnect());

  it("preserves populated rows and physical tuples", () => {
    expect(after).toEqual(before);
  });

  it("records the converged migrations and installs all ten IDs in all seven checks", async () => {
    const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(Number(migrations[0].count)).toBe(66);
    const constraints = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conname LIKE 'ck_de_%supported_capability'
      ORDER BY conname`;
    expect(constraints).toHaveLength(7);
    for (const constraint of constraints)
      expect(
        [...constraint.definition.matchAll(/'([^']+)'/g)].map(
          (match) => match[1],
        ),
      ).toEqual(DATA_EXTRACTION_EVIDENCE_CAPABILITIES);
  });
});

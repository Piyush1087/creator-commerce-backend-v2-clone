import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const databaseUrl = process.env.DE_W1_0B_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("DE-W1.0B durable Evidence persistence invariants", () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function brand(suffix: string) {
    return prisma.brandProfile.create({
      data: {
        domain: `de-w1-0b-${suffix}-${randomUUID()}.example`,
        name: `DE ${suffix}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
  }

  async function resource(brandId: string, key = randomUUID()) {
    return prisma.dataExtractionResource.create({
      data: {
        resourceRef: `resource:${randomUUID()}`,
        brandId,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        pageRole: "HOMEPAGE",
        canonicalResourceKey: `https://example.com/${key}`,
        canonicalResourceKeyHash: key.replaceAll("-", "").slice(0, 64),
        canonicalUrl: `https://example.com/${key}`,
      },
    });
  }

  async function capture(brandId: string, resourceRef: string) {
    return prisma.dataExtractionCapture.create({
      data: {
        captureRef: `capture:${randomUUID()}`,
        brandId,
        resourceRef,
        acquisitionRequestKey: `request:${randomUUID()}`,
        status: "COMPLETED",
        startedAt: new Date(),
        capturedAt: new Date(),
        acquisitionQuality: "COMPLETE",
      },
    });
  }

  async function execution(
    brandId: string,
    availability = "AVAILABLE" as const,
  ) {
    return prisma.dataExtractionCapabilityExecution.create({
      data: {
        capabilityExecutionRef: `capability-execution:${randomUUID()}`,
        brandId,
        capabilityId: "owned_website.brand_messaging",
        normalizationContractVersion: "1.0",
        resourceScopeHash: randomUUID().replaceAll("-", ""),
        freshnessIntent: "REUSE_ALLOWED",
        requestKey: `capability-request:${randomUUID()}`,
        availability,
        retryability: "NOT_APPLICABLE",
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: "COMPLETE",
      },
    });
  }

  async function evidence(
    brandId: string,
    resourceRef: string,
    captureRef: string,
    fingerprint = randomUUID(),
  ) {
    return prisma.dataExtractionEvidenceItem.create({
      data: {
        evidenceRef: `evidence:${randomUUID()}`,
        brandId,
        capabilityId: "owned_website.brand_messaging",
        normalizationContractVersion: "1.0",
        resourceRef,
        captureRef,
        boundedPayload: { excerpt: "grounded brand message" },
        contentHash: randomUUID().replaceAll("-", ""),
        polarity: "AFFIRMATIVE",
        representativeness: "CONTEXT_SPECIFIC",
        coverageSnapshot: "SINGLE_RESOURCE",
        freshnessAtEmission: "CURRENT",
        freshnessBasis: "fresh capture",
        freshnessEvaluatedAt: new Date(),
        qualitySnapshot: "COMPLETE",
        itemFingerprint: fingerprint,
      },
    });
  }

  it("database-enforces same-Brand resource/capture/evidence/capability lineage", async () => {
    const a = await brand("a");
    const b = await brand("b");
    const aResource = await resource(a.id);

    await expect(
      prisma.dataExtractionCapture.create({
        data: {
          captureRef: `capture:${randomUUID()}`,
          brandId: b.id,
          resourceRef: aResource.resourceRef,
          acquisitionRequestKey: `request:${randomUUID()}`,
          status: "COMPLETED",
          startedAt: new Date(),
          capturedAt: new Date(),
          acquisitionQuality: "COMPLETE",
        },
      }),
    ).rejects.toBeTruthy();

    const aCapture = await capture(a.id, aResource.resourceRef);
    await expect(
      evidence(b.id, aResource.resourceRef, aCapture.captureRef),
    ).rejects.toBeTruthy();

    const aEvidence = await evidence(
      a.id,
      aResource.resourceRef,
      aCapture.captureRef,
    );
    const bExecution = await execution(b.id);
    await expect(
      prisma.dataExtractionCapabilityEvidence.create({
        data: {
          brandId: b.id,
          capabilityExecutionRef: bExecution.capabilityExecutionRef,
          capabilityId: bExecution.capabilityId,
          evidenceRef: aEvidence.evidenceRef,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects duplicate resource identity and duplicate Evidence idempotency", async () => {
    const currentBrand = await brand("unique");
    const key = randomUUID();
    const first = await resource(currentBrand.id, key);
    await expect(resource(currentBrand.id, key)).rejects.toBeTruthy();

    const currentCapture = await capture(currentBrand.id, first.resourceRef);
    const fingerprint = `fingerprint:${randomUUID()}`;
    await evidence(
      currentBrand.id,
      first.resourceRef,
      currentCapture.captureRef,
      fingerprint,
    );
    await expect(
      evidence(
        currentBrand.id,
        first.resourceRef,
        currentCapture.captureRef,
        fingerprint,
      ),
    ).rejects.toBeTruthy();
  });

  it("persists AVAILABLE with zero Evidence membership rows", async () => {
    const currentBrand = await brand("empty");
    const currentExecution = await execution(currentBrand.id, "AVAILABLE");
    const memberships = await prisma.dataExtractionCapabilityEvidence.count({
      where: {
        brandId: currentBrand.id,
        capabilityExecutionRef: currentExecution.capabilityExecutionRef,
      },
    });
    expect(memberships).toBe(0);
    expect(currentExecution.availability).toBe("AVAILABLE");
  });

  it("rejects duplicate capability/Evidence membership", async () => {
    const currentBrand = await brand("membership");
    const currentResource = await resource(currentBrand.id);
    const currentCapture = await capture(
      currentBrand.id,
      currentResource.resourceRef,
    );
    const currentEvidence = await evidence(
      currentBrand.id,
      currentResource.resourceRef,
      currentCapture.captureRef,
    );
    const currentExecution = await execution(currentBrand.id);
    const data = {
      brandId: currentBrand.id,
      capabilityExecutionRef: currentExecution.capabilityExecutionRef,
      capabilityId: currentExecution.capabilityId,
      evidenceRef: currentEvidence.evidenceRef,
    };
    await prisma.dataExtractionCapabilityEvidence.create({ data });
    await expect(
      prisma.dataExtractionCapabilityEvidence.create({ data }),
    ).rejects.toBeTruthy();
  });

  it("accepts POSSIBLY_STALE and rejects the non-DE STALE vocabulary", async () => {
    const currentBrand = await brand("freshness");
    const currentResource = await resource(currentBrand.id);
    const assessment = await prisma.dataExtractionFreshnessAssessment.create({
      data: {
        brandId: currentBrand.id,
        targetType: "RESOURCE",
        targetRef: currentResource.resourceRef,
        state: "POSSIBLY_STALE",
        evaluatedAt: new Date(),
        basis: "bounded age threshold",
      },
    });
    expect(assessment.state).toBe("POSSIBLY_STALE");

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "data_extraction_freshness_assessments" ("id", "brand_id", "target_type", "target_ref", "state", "evaluated_at", "basis", "created_at") VALUES ($1, $2, 'RESOURCE', $3, 'STALE', NOW(), 'invalid', NOW())`,
        randomUUID(),
        currentBrand.id,
        currentResource.resourceRef,
      ),
    ).rejects.toBeTruthy();
  });

  it("keeps Evidence provider-neutral and leaves IntelligenceEvidenceReference storage untouched", async () => {
    const evidenceColumns = await prisma.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'data_extraction_evidence_items' ORDER BY column_name`,
    );
    const names = evidenceColumns.map((row) => row.column_name);
    expect(names).not.toContain("provider_execution_ref");
    expect(names).not.toContain("provider_id");
    expect(names).not.toContain("model_id");

    const intelligenceTable = await prisma.$queryRawUnsafe<
      Array<{ exists: boolean }>
    >(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intelligence_evidence_references') AS exists`,
    );
    expect(intelligenceTable[0]?.exists).toBe(true);
  });

  it("preserves conflicts without a winner field", async () => {
    const currentBrand = await brand("conflict");
    const first = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId: currentBrand.id,
        semanticObservationKey: `observation:${randomUUID()}`,
        capabilityId: "owned_website.brand_messaging",
      },
    });
    const second = await prisma.dataExtractionSemanticObservation.create({
      data: {
        brandId: currentBrand.id,
        semanticObservationKey: `observation:${randomUUID()}`,
        capabilityId: "owned_website.brand_messaging",
      },
    });
    const conflict = await prisma.dataExtractionObservationRelation.create({
      data: {
        brandId: currentBrand.id,
        sourceObservationKey: first.semanticObservationKey,
        targetObservationKey: second.semanticObservationKey,
        capabilityId: first.capabilityId,
        relationType: "CONFLICTS_WITH",
      },
    });
    expect(conflict.relationType).toBe("CONFLICTS_WITH");

    const columns = await prisma.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'data_extraction_observation_relations'`,
    );
    expect(
      columns
        .map((row) => row.column_name)
        .some((name) => name.includes("winner")),
    ).toBe(false);
  });
});

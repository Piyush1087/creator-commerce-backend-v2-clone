import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asEvidenceRef,
  asNormalizedContentRef,
  asProviderExecutionRef,
  asResourceRef,
  asSemanticObservationKey,
  type BrandId,
  type CaptureRef,
  type ResourceRef,
} from "./domain/evidence-identities";
import type {
  DataExtractionContentArtifactRecord,
  DataExtractionEvidenceItemRecord,
} from "./domain/evidence-records";
import {
  DataExtractionPersistenceError,
} from "./persistence/evidence-persistence.errors";
import {
  DataExtractionPersistenceService,
  type DataExtractionRepositorySet,
} from "./persistence/prisma-evidence-repositories";

const databaseUrl =
  process.env.DE_W1_0C_DATABASE_URL ?? process.env.DE_W1_0B_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

const completeQuality = {
  state: "COMPLETE" as const,
  failureCategories: [] as const,
  detailCodes: [] as const,
};

describePostgres("DE-W1.0C durable Evidence repositories", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(suffix: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `de-w1-0c-${suffix}-${randomUUID()}.example`,
        name: `DE W1.0C ${suffix}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  async function createResource(
    repositories: DataExtractionRepositorySet,
    brandId: BrandId,
    suffix = randomUUID(),
  ) {
    return repositories.resources.createOrGet({
      brandId,
      resourceRef: asResourceRef(`resource:${randomUUID()}`),
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      pageRole: "HOMEPAGE",
      canonicalResourceKey: `https://example.com/${suffix}`,
      canonicalUrl: `https://example.com/${suffix}`,
    });
  }

  async function createCompletedCapture(
    repositories: DataExtractionRepositorySet,
    brandId: BrandId,
    resourceRef: ResourceRef,
    suffix = randomUUID(),
  ) {
    const capture = await repositories.captures.create({
      brandId,
      captureRef: asCaptureRef(`capture:${randomUUID()}`),
      resourceRef,
      acquisitionRequestKey: `capture-request:${suffix}`,
      startedAt: "2026-08-25T12:00:00.000Z",
      acquisitionQuality: completeQuality,
    });
    return repositories.captures.markCompleted(brandId, capture.captureRef, {
      capturedAt: "2026-08-25T12:00:01.000Z",
      observedAt: "2026-08-25T12:00:01.000Z",
      sourceRevisionRef: `revision:${suffix}`,
      sourceContentHash: randomUUID().replaceAll("-", ""),
      acquisitionQuality: completeQuality,
    });
  }

  async function createExecution(
    repositories: DataExtractionRepositorySet,
    brandId: BrandId,
    suffix = randomUUID(),
  ) {
    return repositories.capabilityExecutions.createOrGet({
      brandId,
      capabilityExecutionRef: asCapabilityExecutionRef(
        `capability-execution:${randomUUID()}`,
      ),
      capabilityId: "owned_website.brand_messaging",
      normalizationContractVersion: "1.0",
      resourceScopeHash: randomUUID().replaceAll("-", ""),
      freshnessIntent: "REUSE_ALLOWED",
      requestKey: `capability-request:${suffix}`,
      coverage: "SINGLE_RESOURCE",
    });
  }

  function evidenceRecord(
    brandId: BrandId,
    resourceRef: ResourceRef,
    captureRef: CaptureRef,
    fingerprint = `fingerprint:${randomUUID()}`,
    evidenceRef = asEvidenceRef(`evidence:${randomUUID()}`),
  ): DataExtractionEvidenceItemRecord {
    return {
      brandId,
      evidenceRef,
      capabilityId: "owned_website.brand_messaging",
      normalizationContractVersion: "1.0",
      resourceRef,
      captureRef,
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      pageRole: "HOMEPAGE",
      capturedAt: "2026-08-25T12:00:01.000Z",
      freshnessAtEmission: {
        state: "CURRENT",
        basis: "fresh capture",
        evaluatedAt: "2026-08-25T12:00:02.000Z",
      },
      representativeness: "CONTEXT_SPECIFIC",
      coverageSnapshot: "SINGLE_RESOURCE",
      qualitySnapshot: completeQuality,
      provenance: {
        acquisitionOrNormalizationRunRef: `normalization:${randomUUID()}`,
        captureMethodClass: "DIRECT_FETCH",
        normalizationContractVersion: "1.0",
        parentEvidenceRefs: [],
        parentCaptureRefs: [],
      },
      deduplication: {
        itemFingerprint: fingerprint,
        repetitionCount: 1,
        supportingResourceRefs: [resourceRef],
      },
      boundedNormalizedPayload: { excerpt: "grounded brand message" },
      contentHash: randomUUID().replaceAll("-", ""),
      polarity: "AFFIRMATIVE",
      relationshipRefs: [],
    };
  }

  function expectCode(
    promise: Promise<unknown>,
    code: DataExtractionPersistenceError["code"],
  ) {
    return expect(promise).rejects.toMatchObject({
      name: "DataExtractionPersistenceError",
      code,
    });
  }

  it("resource exact replay is idempotent and material mismatch conflicts", async () => {
    const brandId = await brand("resource");
    const repositories = persistence.repositories();
    const key = `https://example.com/${randomUUID()}`;
    const first = await repositories.resources.createOrGet({
      brandId,
      resourceRef: asResourceRef(`resource:${randomUUID()}`),
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      pageRole: "HOMEPAGE",
      canonicalResourceKey: key,
      canonicalUrl: key,
    });
    const replay = await repositories.resources.createOrGet({
      brandId,
      resourceRef: asResourceRef(`resource:${randomUUID()}`),
      sourceClass: "OWNED_WEBSITE",
      resourceType: "OWNED_WEB_PAGE",
      pageRole: "HOMEPAGE",
      canonicalResourceKey: key,
      canonicalUrl: key,
    });
    expect(replay.resourceRef).toBe(first.resourceRef);
    expect(await repositories.resources.listForBrand(brandId)).toHaveLength(1);

    await expectCode(
      repositories.resources.createOrGet({
        brandId,
        resourceRef: asResourceRef(`resource:${randomUUID()}`),
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        pageRole: "ABOUT_COMPANY",
        canonicalResourceKey: key,
        canonicalUrl: `${key}?changed=true`,
      }),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("capture request replay is idempotent across lifecycle and terminal rewrites are rejected", async () => {
    const brandId = await brand("capture");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const captureRef = asCaptureRef(`capture:${randomUUID()}`);
    const request = {
      brandId,
      captureRef,
      resourceRef: resource.resourceRef,
      acquisitionRequestKey: `capture-request:${randomUUID()}`,
      startedAt: "2026-08-25T12:10:00.000Z",
      acquisitionQuality: completeQuality,
    };
    const created = await repositories.captures.create(request);
    expect(created.captureRef).toBe(captureRef);

    const completed = await repositories.captures.markCompleted(
      brandId,
      captureRef,
      {
        capturedAt: "2026-08-25T12:10:01.000Z",
        sourceRevisionRef: "revision:terminal",
        sourceContentHash: "a".repeat(64),
        acquisitionQuality: completeQuality,
      },
    );
    expect(completed.capturedAt).toBe("2026-08-25T12:10:01.000Z");

    const replay = await repositories.captures.create(request);
    expect(replay.captureRef).toBe(captureRef);
    const dbCapture = await prisma.dataExtractionCapture.findUniqueOrThrow({
      where: { captureRef },
    });
    expect(dbCapture.status).toBe("COMPLETED");

    await expectCode(
      repositories.captures.markCompleted(brandId, captureRef, {
        capturedAt: "2026-08-25T12:10:02.000Z",
        sourceRevisionRef: "revision:rewritten",
        acquisitionQuality: completeQuality,
      }),
      "INVALID_LIFECYCLE_TRANSITION",
    );

    const failed = await repositories.captures.create({
      ...request,
      captureRef: asCaptureRef(`capture:${randomUUID()}`),
      acquisitionRequestKey: `capture-request:${randomUUID()}`,
    });
    await repositories.captures.markFailed(brandId, failed.captureRef, {
      capturedAt: "2026-08-25T12:11:01.000Z",
      acquisitionQuality: {
        state: "UNAVAILABLE",
        failureCategories: ["NETWORK"],
        detailCodes: ["TIMEOUT"],
      },
    });
    const dbFailed = await prisma.dataExtractionCapture.findUniqueOrThrow({
      where: { captureRef: failed.captureRef },
    });
    expect(dbFailed.status).toBe("FAILED");
  });

  it("capture request material mismatch conflicts", async () => {
    const brandId = await brand("capture-conflict");
    const repositories = persistence.repositories();
    const firstResource = await createResource(repositories, brandId, "first");
    const secondResource = await createResource(repositories, brandId, "second");
    const requestKey = `capture-request:${randomUUID()}`;
    await repositories.captures.create({
      brandId,
      captureRef: asCaptureRef(`capture:${randomUUID()}`),
      resourceRef: firstResource.resourceRef,
      acquisitionRequestKey: requestKey,
      startedAt: "2026-08-25T12:20:00.000Z",
      acquisitionQuality: completeQuality,
    });
    await expectCode(
      repositories.captures.create({
        brandId,
        captureRef: asCaptureRef(`capture:${randomUUID()}`),
        resourceRef: secondResource.resourceRef,
        acquisitionRequestKey: requestKey,
        startedAt: "2026-08-25T12:20:00.000Z",
        acquisitionQuality: completeQuality,
      }),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("content artifact insert/read is immutable and honors storage shape", async () => {
    const brandId = await brand("content");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const capture = await createCompletedCapture(
      repositories,
      brandId,
      resource.resourceRef,
    );
    const artifact: DataExtractionContentArtifactRecord = {
      brandId,
      contentArtifactRef: asNormalizedContentRef(`content:${randomUUID()}`),
      captureRef: capture.captureRef,
      artifactKind: "NORMALIZED_TEXT",
      mediaType: "text/plain",
      contentHash: "b".repeat(64),
      byteLength: 12,
      inlineContent: "hello world!",
      normalizationContractVersion: "1.0",
      createdAt: "2026-08-25T12:30:00.000Z",
    };
    await repositories.contentArtifacts.insert(artifact);
    await repositories.contentArtifacts.insert(artifact);
    const read = await repositories.contentArtifacts.findByRef(
      brandId,
      artifact.contentArtifactRef,
    );
    expect(read?.inlineContent).toBe("hello world!");
    expect(
      await repositories.contentArtifacts.listForCapture(
        brandId,
        capture.captureRef,
      ),
    ).toHaveLength(1);

    await expectCode(
      repositories.contentArtifacts.insert({
        ...artifact,
        contentArtifactRef: asNormalizedContentRef(`content:${randomUUID()}`),
        inlineContent: undefined,
        objectStoreRef: undefined,
      }),
      "PERSISTENCE_INVARIANT",
    );
  });

  it("capability execution replay works and AVAILABLE + [] is durable", async () => {
    const brandId = await brand("capability");
    const repositories = persistence.repositories();
    const input = {
      brandId,
      capabilityExecutionRef: asCapabilityExecutionRef(
        `capability-execution:${randomUUID()}`,
      ),
      capabilityId: "owned_website.brand_messaging" as const,
      normalizationContractVersion: "1.0",
      resourceScopeHash: randomUUID().replaceAll("-", ""),
      freshnessIntent: "REUSE_ALLOWED" as const,
      requestKey: `capability-request:${randomUUID()}`,
      coverage: "SINGLE_RESOURCE" as const,
    };
    const execution = await repositories.capabilityExecutions.createOrGet(input);
    const completed = await repositories.capabilityExecutions.complete(
      brandId,
      execution.capabilityExecutionRef,
      {
        availability: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: [],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: completeQuality,
        completedAt: "2026-08-25T12:40:01.000Z",
      },
    );
    expect(completed.availability).toBe("AVAILABLE");
    expect(completed.evidenceRefs).toEqual([]);
    expect(
      await repositories.capabilityEvidence.listEvidenceForExecution(
        brandId,
        completed.capabilityExecutionRef,
      ),
    ).toEqual([]);
    const replay = await repositories.capabilityExecutions.createOrGet({
      ...input,
      capabilityExecutionRef: asCapabilityExecutionRef(
        `capability-execution:${randomUUID()}`,
      ),
    });
    expect(replay.capabilityExecutionRef).toBe(execution.capabilityExecutionRef);
    expect(replay.availability).toBe("AVAILABLE");
  });

  it("Evidence exact replay returns same row and material mismatch conflicts", async () => {
    const brandId = await brand("evidence");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const capture = await createCompletedCapture(
      repositories,
      brandId,
      resource.resourceRef,
    );
    const fingerprint = `fingerprint:${randomUUID()}`;
    const record = evidenceRecord(
      brandId,
      resource.resourceRef,
      capture.captureRef,
      fingerprint,
    );
    const first = await repositories.evidenceItems.insertOrGetExact(record);
    const replay = await repositories.evidenceItems.insertOrGetExact({
      ...record,
      evidenceRef: asEvidenceRef(`evidence:${randomUUID()}`),
    });
    expect(replay.evidenceRef).toBe(first.evidenceRef);
    expect(
      await repositories.evidenceItems.listByCapture(brandId, capture.captureRef),
    ).toHaveLength(1);

    await expectCode(
      repositories.evidenceItems.insertOrGetExact({
        ...record,
        evidenceRef: asEvidenceRef(`evidence:${randomUUID()}`),
        contentHash: "c".repeat(64),
      }),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("repository guards reject cross-Brand lineage before database insertion", async () => {
    const a = await brand("tenant-a");
    const b = await brand("tenant-b");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, a);
    await expectCode(
      repositories.captures.create({
        brandId: b,
        captureRef: asCaptureRef(`capture:${randomUUID()}`),
        resourceRef: resource.resourceRef,
        acquisitionRequestKey: `capture-request:${randomUUID()}`,
        startedAt: "2026-08-25T12:50:00.000Z",
        acquisitionQuality: completeQuality,
      }),
      "TENANCY_VIOLATION",
    );
  });

  it("capability/resource and capability/Evidence attach are replay-safe without duplicates", async () => {
    const brandId = await brand("membership");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const capture = await createCompletedCapture(
      repositories,
      brandId,
      resource.resourceRef,
    );
    const execution = await createExecution(repositories, brandId);
    const evidence = await repositories.evidenceItems.insertOrGetExact(
      evidenceRecord(brandId, resource.resourceRef, capture.captureRef),
    );

    await repositories.capabilityResources.attach(
      brandId,
      execution.capabilityExecutionRef,
      resource.resourceRef,
    );
    await repositories.capabilityResources.attach(
      brandId,
      execution.capabilityExecutionRef,
      resource.resourceRef,
    );
    expect(
      await repositories.capabilityResources.listForExecution(
        brandId,
        execution.capabilityExecutionRef,
      ),
    ).toEqual([resource.resourceRef]);

    await repositories.capabilityEvidence.attach(
      brandId,
      execution.capabilityExecutionRef,
      evidence.evidenceRef,
    );
    await repositories.capabilityEvidence.attach(
      brandId,
      execution.capabilityExecutionRef,
      evidence.evidenceRef,
    );
    expect(
      await repositories.capabilityEvidence.listEvidenceForExecution(
        brandId,
        execution.capabilityExecutionRef,
      ),
    ).toEqual([evidence.evidenceRef]);
  });

  it("observation support replay does not inflate repetition and conflict preserves both observations", async () => {
    const brandId = await brand("observation");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const capture = await createCompletedCapture(
      repositories,
      brandId,
      resource.resourceRef,
    );
    const firstEvidence = await repositories.evidenceItems.insertOrGetExact(
      evidenceRecord(brandId, resource.resourceRef, capture.captureRef),
    );
    const secondEvidence = await repositories.evidenceItems.insertOrGetExact(
      evidenceRecord(brandId, resource.resourceRef, capture.captureRef),
    );
    const firstKey = asSemanticObservationKey(`observation:${randomUUID()}`);
    const secondKey = asSemanticObservationKey(`observation:${randomUUID()}`);
    await repositories.semanticObservations.createOrGet(
      brandId,
      firstKey,
      "owned_website.brand_messaging",
    );
    await repositories.semanticObservations.createOrGet(
      brandId,
      secondKey,
      "owned_website.brand_messaging",
    );

    await repositories.semanticObservations.attachSupport(
      brandId,
      firstKey,
      firstEvidence.evidenceRef,
    );
    const replay = await repositories.semanticObservations.attachSupport(
      brandId,
      firstKey,
      firstEvidence.evidenceRef,
    );
    expect(replay.repetitionCount).toBe(1);
    const twoSupports = await repositories.semanticObservations.attachSupport(
      brandId,
      firstKey,
      secondEvidence.evidenceRef,
    );
    expect(twoSupports.repetitionCount).toBe(2);

    await repositories.semanticObservations.relateConflict(
      brandId,
      firstKey,
      secondKey,
    );
    await repositories.semanticObservations.relateConflict(
      brandId,
      secondKey,
      firstKey,
    );
    const first = await repositories.semanticObservations.findByKey(
      brandId,
      firstKey,
    );
    const second = await repositories.semanticObservations.findByKey(
      brandId,
      secondKey,
    );
    expect(first?.conflictingObservationKeys).toContain(secondKey);
    expect(second?.conflictingObservationKeys).toContain(firstKey);
    expect("winner" in (first ?? {})).toBe(false);
    expect(
      await prisma.dataExtractionObservationRelation.count({
        where: { brandId, relationType: "CONFLICTS_WITH" },
      }),
    ).toBe(1);
  });

  it("equivalence is replay-safe without collapsing observations", async () => {
    const brandId = await brand("equivalence");
    const repositories = persistence.repositories();
    const firstKey = asSemanticObservationKey(`observation:${randomUUID()}`);
    const secondKey = asSemanticObservationKey(`observation:${randomUUID()}`);
    await repositories.semanticObservations.createOrGet(
      brandId,
      firstKey,
      "owned_website.brand_messaging",
    );
    await repositories.semanticObservations.createOrGet(
      brandId,
      secondKey,
      "owned_website.brand_messaging",
    );
    await repositories.semanticObservations.relateEquivalent(
      brandId,
      firstKey,
      secondKey,
    );
    await repositories.semanticObservations.relateEquivalent(
      brandId,
      secondKey,
      firstKey,
    );
    expect(
      await prisma.dataExtractionSemanticObservation.count({ where: { brandId } }),
    ).toBe(2);
    expect(
      await prisma.dataExtractionObservationRelation.count({
        where: { brandId, relationType: "EQUIVALENT_TO" },
      }),
    ).toBe(1);
  });

  it("freshness history is append-only and latestForTarget is deterministic", async () => {
    const brandId = await brand("freshness");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    await repositories.freshnessAssessments.record({
      brandId,
      targetType: "RESOURCE",
      targetRef: resource.resourceRef,
      state: "CURRENT",
      evaluatedAt: "2026-08-25T13:00:00.000Z",
      basis: "fresh capture",
    });
    await repositories.freshnessAssessments.record({
      brandId,
      targetType: "RESOURCE",
      targetRef: resource.resourceRef,
      state: "POSSIBLY_STALE",
      evaluatedAt: "2026-08-25T14:00:00.000Z",
      basis: "later bounded assessment",
    });
    const history = await repositories.freshnessAssessments.listForTarget(
      brandId,
      "RESOURCE",
      resource.resourceRef,
    );
    expect(history.map((item) => item.state)).toEqual([
      "CURRENT",
      "POSSIBLY_STALE",
    ]);
    expect(
      (
        await repositories.freshnessAssessments.latestForTarget(
          brandId,
          "RESOURCE",
          resource.resourceRef,
        )
      )?.state,
    ).toBe("POSSIBLY_STALE");
  });

  it("provider execution links remain append-only opaque operational provenance", async () => {
    const brandId = await brand("provider-link");
    const repositories = persistence.repositories();
    const resource = await createResource(repositories, brandId);
    const capture = await createCompletedCapture(
      repositories,
      brandId,
      resource.resourceRef,
    );
    const execution = await createExecution(repositories, brandId);
    const providerRef = asProviderExecutionRef(`provider-execution:${randomUUID()}`);
    await repositories.providerExecutionLinks.attachToCapture(
      brandId,
      capture.captureRef,
      providerRef,
      "PRIMARY_ATTEMPT",
    );
    await repositories.providerExecutionLinks.attachToCapabilityExecution(
      brandId,
      execution.capabilityExecutionRef,
      providerRef,
      "NORMALIZATION_INPUT",
    );
    const captureLinks = await repositories.providerExecutionLinks.listForCapture(
      brandId,
      capture.captureRef,
    );
    expect(captureLinks[0]?.providerExecutionRef).toBe(providerRef);
    expect(captureLinks[0]).not.toHaveProperty("providerPayload");
    expect(captureLinks[0]).not.toHaveProperty("modelId");
  });

  it("caller-owned acquisition transaction rolls back Resource + Capture + Artifact + Provider Link together", async () => {
    const brandId = await brand("tx-acquisition");
    const resourceRef = asResourceRef(`resource:${randomUUID()}`);
    await expectCode(
      persistence.withTransaction(async (repositories) => {
        const resource = await repositories.resources.createOrGet({
          brandId,
          resourceRef,
          sourceClass: "OWNED_WEBSITE",
          resourceType: "OWNED_WEB_PAGE",
          pageRole: "HOMEPAGE",
          canonicalResourceKey: `https://example.com/${randomUUID()}`,
          canonicalUrl: "https://example.com/tx-acquisition",
        });
        const capture = await repositories.captures.create({
          brandId,
          captureRef: asCaptureRef(`capture:${randomUUID()}`),
          resourceRef: resource.resourceRef,
          acquisitionRequestKey: `capture-request:${randomUUID()}`,
          startedAt: "2026-08-25T15:00:00.000Z",
          acquisitionQuality: completeQuality,
        });
        await repositories.contentArtifacts.insert({
          brandId,
          contentArtifactRef: asNormalizedContentRef(`content:${randomUUID()}`),
          captureRef: capture.captureRef,
          artifactKind: "ACQUIRED_SOURCE_BODY",
          mediaType: "text/html",
          contentHash: "d".repeat(64),
          byteLength: 13,
          inlineContent: "<html></html>",
          createdAt: "2026-08-25T15:00:00.000Z",
        });
        await repositories.providerExecutionLinks.attachToCapture(
          brandId,
          capture.captureRef,
          asProviderExecutionRef(`provider-execution:${randomUUID()}`),
          "PRIMARY_ATTEMPT",
        );
        throw new Error("force rollback");
      }),
      "PERSISTENCE_INVARIANT",
    );
    expect(
      await persistence.repositories().resources.findByRef(brandId, resourceRef),
    ).toBeNull();
  });

  it("caller-owned capability transaction rolls back execution + Evidence + membership + support together", async () => {
    const brandId = await brand("tx-capability");
    const root = persistence.repositories();
    const resource = await createResource(root, brandId);
    const capture = await createCompletedCapture(
      root,
      brandId,
      resource.resourceRef,
    );
    const executionRef = asCapabilityExecutionRef(
      `capability-execution:${randomUUID()}`,
    );
    const evidenceRef = asEvidenceRef(`evidence:${randomUUID()}`);
    const observationKey = asSemanticObservationKey(`observation:${randomUUID()}`);

    await expectCode(
      persistence.withTransaction(async (repositories) => {
        const execution = await repositories.capabilityExecutions.createOrGet({
          brandId,
          capabilityExecutionRef: executionRef,
          capabilityId: "owned_website.brand_messaging",
          normalizationContractVersion: "1.0",
          resourceScopeHash: randomUUID().replaceAll("-", ""),
          freshnessIntent: "REUSE_ALLOWED",
          requestKey: `capability-request:${randomUUID()}`,
          coverage: "SINGLE_RESOURCE",
        });
        const evidence = await repositories.evidenceItems.insertOrGetExact(
          evidenceRecord(
            brandId,
            resource.resourceRef,
            capture.captureRef,
            `fingerprint:${randomUUID()}`,
            evidenceRef,
          ),
        );
        await repositories.capabilityEvidence.attach(
          brandId,
          execution.capabilityExecutionRef,
          evidence.evidenceRef,
        );
        await repositories.semanticObservations.createOrGet(
          brandId,
          observationKey,
          "owned_website.brand_messaging",
        );
        await repositories.semanticObservations.attachSupport(
          brandId,
          observationKey,
          evidence.evidenceRef,
        );
        throw new Error("force rollback");
      }),
      "PERSISTENCE_INVARIANT",
    );

    expect(
      await root.capabilityExecutions.findByRef(brandId, executionRef),
    ).toBeNull();
    expect(await root.evidenceItems.findByRef(brandId, evidenceRef)).toBeNull();
    expect(
      await root.semanticObservations.findByKey(brandId, observationKey),
    ).toBeNull();
  });
});

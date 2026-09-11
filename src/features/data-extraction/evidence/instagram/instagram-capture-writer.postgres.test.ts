import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { PrismaService } from "../../../../prisma/prisma.service";
import { INSTAGRAM_DE_CONTRACT } from "../../../instagram-intelligence/contracts/instagram-intelligence.registry";
import { DataExtractionPersistenceError } from "../persistence/evidence-persistence.errors";
import {
  InstagramCaptureWriterService,
  type WriteInstagramCaptureInput,
} from "./instagram-capture-writer.service";

const databaseUrl = process.env.B1_INSTAGRAM_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

const complete = {
  state: "COMPLETE" as const,
  failureCategories: [] as const,
  detailCodes: [] as const,
};

describePostgres("B1 Instagram provider-neutral capture persistence", () => {
  const prisma = new PrismaService();
  const writer = new InstagramCaptureWriterService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function fixture(providerAccountId = `account-${randomUUID()}`) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `b1-${randomUUID()}.example.test`,
        name: "B1 isolated Brand",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    const integration = await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        currentPlatformHandle: "mutable-handle",
        authorizationGeneration: 7,
        credentialVersion: 4,
      },
    });
    return { brand, integration, providerAccountId };
  }

  function availableInput(
    fixture: Awaited<ReturnType<typeof fixture>>,
    overrides: Partial<WriteInstagramCaptureInput> = {},
  ): WriteInstagramCaptureInput {
    return {
      brandId: fixture.brand.id,
      providerAccountId: fixture.providerAccountId,
      authorizationGeneration: 7,
      resourceType: "INSTAGRAM_ACCOUNT",
      capabilityId: "instagram.account_profile",
      requestKey: `request-${randomUUID()}`,
      providerExecutionRef: `provider-execution-${randomUUID()}`,
      normalizationContractVersion: "1.0",
      startedAt: "2026-09-11T02:00:00.000Z",
      capturedAt: "2026-09-11T02:00:01.000Z",
      observedAt: "2026-09-11T01:59:59.000Z",
      completedAt: "2026-09-11T02:00:02.000Z",
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: [],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: complete,
      artifacts: [
        {
          artifactKey: "account-profile",
          payload: { accountType: "BUSINESS", followers: 12 },
        },
      ],
      evidence: [
        {
          evidenceKey: "account-profile",
          artifactKey: "account-profile",
          payload: { accountType: "BUSINESS", followers: 12 },
          freshness: "CURRENT",
          representativeness: "PERSISTENT_BRAND_LEVEL",
          semanticObservationKey: `instagram-observation:${randomUUID()}`,
        },
      ],
      ...overrides,
    };
  }

  async function counts(brandId: string) {
    const where = { brandId };
    const values = await Promise.all([
      prisma.dataExtractionResource.count({ where }),
      prisma.dataExtractionCapture.count({ where }),
      prisma.dataExtractionContentArtifact.count({ where }),
      prisma.dataExtractionCapabilityExecution.count({ where }),
      prisma.dataExtractionCapabilityResource.count({ where }),
      prisma.dataExtractionEvidenceItem.count({ where }),
      prisma.dataExtractionCapabilityEvidence.count({ where }),
      prisma.dataExtractionSemanticObservation.count({ where }),
      prisma.dataExtractionObservationSupport.count({ where }),
      prisma.dataExtractionProviderExecutionLink.count({ where }),
    ]);
    return values;
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

  it("persists exact account lineage and reuses an identical request", async () => {
    const state = await fixture();
    const input = availableInput(state);
    const first = await writer.write(input);
    const beforeReplay = await counts(state.brand.id);
    const replay = await writer.write(input);
    const afterReplay = await counts(state.brand.id);

    expect(replay).toEqual({ ...first, reused: true });
    expect(first.reused).toBe(false);
    expect(afterReplay).toEqual(beforeReplay);
    expect(beforeReplay).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);

    const [resource, capture, execution, artifact, evidence, observation] =
      await Promise.all([
        prisma.dataExtractionResource.findUniqueOrThrow({
          where: { resourceRef: first.resourceRef },
        }),
        prisma.dataExtractionCapture.findUniqueOrThrow({
          where: { captureRef: first.captureRef },
        }),
        prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
          where: { capabilityExecutionRef: first.capabilityExecutionRef },
        }),
        prisma.dataExtractionContentArtifact.findUniqueOrThrow({
          where: { contentArtifactRef: first.artifactRefs[0] },
        }),
        prisma.dataExtractionEvidenceItem.findUniqueOrThrow({
          where: { evidenceRef: first.evidenceRefs[0] },
        }),
        prisma.dataExtractionSemanticObservation.findFirstOrThrow({
          where: { brandId: state.brand.id },
        }),
      ]);
    expect(resource).toMatchObject({
      brandId: state.brand.id,
      sourceClass: "INSTAGRAM_OWNED",
      resourceType: "INSTAGRAM_ACCOUNT",
      providerAccountId: state.providerAccountId,
      canonicalResourceKey: `instagram:${state.providerAccountId}:account`,
    });
    expect(capture).toMatchObject({
      providerIntegrationId: state.integration.id,
      providerAccountId: state.providerAccountId,
      authorizationGeneration: 7,
      status: "COMPLETED",
    });
    expect(execution).toMatchObject({
      providerIntegrationId: state.integration.id,
      providerAccountId: state.providerAccountId,
      authorizationGeneration: 7,
      capabilityId: "instagram.account_profile",
      availability: "AVAILABLE",
    });
    expect(artifact.inlineContent).toContain('"followers":12');
    expect(evidence.boundedPayload).toEqual({
      accountType: "BUSINESS",
      followers: 12,
    });
    expect(observation.capabilityId).toBe("instagram.account_profile");
    expect(
      JSON.stringify({ resource, capture, execution, artifact, evidence }),
    ).not.toMatch(/accessToken|refreshToken|signedUrl|fbcdn|cdninstagram/i);
  });

  it("allows several Evidence records to reference one declared artifact", async () => {
    const state = await fixture();
    const result = await writer.write(
      availableInput(state, {
        evidence: [
          {
            evidenceKey: "account-type",
            artifactKey: "account-profile",
            payload: { accountType: "BUSINESS" },
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
          {
            evidenceKey: "followers",
            artifactKey: "account-profile",
            payload: { followers: 12 },
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
        ],
      }),
    );
    const evidence = await prisma.dataExtractionEvidenceItem.findMany({
      where: { evidenceRef: { in: [...result.evidenceRefs] } },
      orderBy: { evidenceRef: "asc" },
    });
    expect(result.artifactRefs).toHaveLength(1);
    expect(evidence).toHaveLength(2);
    expect(new Set(evidence.map((item) => item.contentArtifactRef))).toEqual(
      new Set([result.artifactRefs[0]]),
    );
  });

  it("rejects duplicate declarations, dangling references and malformed identities before writes", async () => {
    const cases: readonly Partial<WriteInstagramCaptureInput>[] = [
      {
        artifacts: [
          { artifactKey: "duplicate", payload: { value: 1 } },
          { artifactKey: "duplicate", payload: { value: 2 } },
        ],
        evidence: [],
      },
      {
        artifacts: [],
        evidence: [
          {
            evidenceKey: "dangling",
            artifactKey: "missing",
            payload: { value: 1 },
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
        ],
      },
      { artifacts: [{ artifactKey: "", payload: {} }], evidence: [] },
      {
        artifacts: [],
        evidence: [
          {
            evidenceKey: "",
            payload: {},
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
        ],
      },
      {
        artifacts: [],
        evidence: [
          {
            evidenceKey: "duplicate-evidence",
            payload: { value: 1 },
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
          {
            evidenceKey: "duplicate-evidence",
            payload: { value: 2 },
            freshness: "CURRENT",
            representativeness: "PERSISTENT_BRAND_LEVEL",
          },
        ],
      },
    ];
    for (const overrides of cases) {
      const state = await fixture();
      const before = await counts(state.brand.id);
      await expectCode(
        writer.write(availableInput(state, overrides)),
        "PERSISTENCE_INVARIANT",
      );
      expect(await counts(state.brand.id)).toEqual(before);
      expect(before).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
  });

  it("round trips media and all exact capabilities while preserving availability", async () => {
    const state = await fixture();
    const media = await writer.write(
      availableInput(state, {
        resourceType: "INSTAGRAM_MEDIA",
        mediaId: "carousel-1",
        capabilityId: "instagram.media_inventory",
        availability: "PARTIAL",
        acquisitionQuality: {
          state: "PARTIAL",
          failureCategories: ["PROVIDER_FIELD_UNAVAILABLE"],
          detailCodes: ["VIEWS_MISSING"],
        },
        reasonCodes: ["VIEWS_UNAVAILABLE"],
        artifacts: [
          {
            artifactKey: "carousel",
            payload: {
              mediaId: "carousel-1",
              childItems: [{ order: 0 }, { order: 1 }],
            },
          },
        ],
        evidence: [
          {
            evidenceKey: "carousel",
            artifactKey: "carousel",
            payload: { mediaId: "carousel-1", views: null },
            freshness: "UNKNOWN",
            representativeness: "CONTEXT_SPECIFIC",
          },
        ],
      }),
    );
    const resource = await prisma.dataExtractionResource.findUniqueOrThrow({
      where: { resourceRef: media.resourceRef },
    });
    const evidence = await prisma.dataExtractionEvidenceItem.findUniqueOrThrow({
      where: { evidenceRef: media.evidenceRefs[0] },
    });
    expect(resource.canonicalResourceKey).toBe(
      `instagram:${state.providerAccountId}:media:carousel-1`,
    );
    expect(evidence.boundedPayload).toEqual({
      mediaId: "carousel-1",
      views: null,
    });

    for (const capabilityId of INSTAGRAM_DE_CONTRACT.capabilities) {
      const unavailable = await writer.write(
        availableInput(state, {
          capabilityId,
          requestKey: `unavailable-${capabilityId}`,
          providerExecutionRef: `provider-${capabilityId}`,
          availability: "UNAVAILABLE",
          retryability: "RETRYABLE",
          reasonCodes: ["PROVIDER_UNAVAILABLE"],
          acquisitionQuality: {
            state: "UNAVAILABLE",
            failureCategories: ["PROVIDER_FAILURE"],
            detailCodes: ["NO_VALUE"],
          },
          capturedAt: undefined,
          observedAt: undefined,
          artifacts: [],
          evidence: [],
        }),
      );
      const [execution, capture] = await Promise.all([
        prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
          where: { capabilityExecutionRef: unavailable.capabilityExecutionRef },
        }),
        prisma.dataExtractionCapture.findUniqueOrThrow({
          where: { captureRef: unavailable.captureRef },
        }),
      ]);
      expect(execution.capabilityId).toBe(capabilityId);
      expect(execution.availability).toBe("UNAVAILABLE");
      expect(capture.status).toBe("FAILED");
      expect(capture.capturedAt).toBeNull();
      expect(capture.observedAt).toBeNull();
      expect(capture.sourceContentHash).toBeNull();
    }
  });

  it("atomically rejects stale generation, changed account and cross-Brand requests", async () => {
    const state = await fixture();
    const staleInput = availableInput(state);
    await prisma.brandIntegration.update({
      where: { id: state.integration.id },
      data: { authorizationGeneration: 8 },
    });
    const beforeStale = await counts(state.brand.id);
    await expectCode(
      writer.write(staleInput),
      "STALE_AUTHORIZATION_GENERATION",
    );
    expect(await counts(state.brand.id)).toEqual(beforeStale);

    await prisma.brandIntegration.update({
      where: { id: state.integration.id },
      data: { providerAccountId: "changed-account" },
    });
    const beforeAccount = await counts(state.brand.id);
    await expectCode(writer.write(staleInput), "PROVIDER_ACCOUNT_MISMATCH");
    expect(await counts(state.brand.id)).toEqual(beforeAccount);

    const other = await fixture("other-account");
    const beforeOther = await counts(other.brand.id);
    await expectCode(
      writer.write(
        availableInput(other, {
          providerAccountId: state.providerAccountId,
        }),
      ),
      "PROVIDER_ACCOUNT_MISMATCH",
    );
    expect(await counts(other.brand.id)).toEqual(beforeOther);
  });

  it("rolls back Capture completion when later Evidence lineage fails", async () => {
    const state = await fixture();
    const before = await counts(state.brand.id);
    await expect(
      writer.write(
        availableInput(state, {
          evidence: [
            {
              evidenceKey: "late-failure",
              artifactKey: "account-profile",
              payload: { accountType: "BUSINESS" },
              freshness: "CURRENT",
              representativeness: "PERSISTENT_BRAND_LEVEL",
              semanticObservationKey: `instagram:${"x".repeat(300)}`,
            },
          ],
        }),
      ),
    ).rejects.toBeTruthy();
    expect(await counts(state.brand.id)).toEqual(before);
    expect(before).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("rejects token, signed URL and raw media-shaped payloads before persistence", async () => {
    const state = await fixture();
    const before = await counts(state.brand.id);
    await expectCode(
      writer.write(
        availableInput(state, {
          artifacts: [
            {
              artifactKey: "unsafe",
              payload: { signedMediaUrl: "https://example.test/ephemeral" },
            },
          ],
          evidence: [],
        }),
      ),
      "UNSAFE_INSTAGRAM_PAYLOAD",
    );
    expect(await counts(state.brand.id)).toEqual(before);
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramC2FoundationsService } from "./instagram-c2-foundations.service";

const databaseUrl = process.env.C2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;
const capturedAt = "2026-09-12T00:00:00.000Z";

describePostgres("C2 deterministic foundations PostgreSQL", () => {
  const prisma = new PrismaService();
  const writer = new InstagramCaptureWriterService(prisma);
  const service = new InstagramC2FoundationsService(prisma);
  const purge = new InstagramDerivedDataPurgeService(
    new InstagramImageTemporaryStore("c2-unused-images"),
  );
  let brandId = "";
  let otherBrandId = "";

  beforeAll(async () => {
    await prisma.$connect();
    brandId = await createBrand("primary", "account-a", 7);
    otherBrandId = await createBrand("other", "account-b", 2);
    await seedInstagramEvidence(brandId, "account-a", 7);
    await write(
      otherBrandId,
      "account-b",
      2,
      "instagram.account_profile",
      "other-profile",
      {
        providerAccountId: "account-b",
        followersCount: { state: "OBSERVED", value: 99 },
      },
    );
  });

  afterAll(async () => {
    for (const id of [brandId, otherBrandId]) {
      if (!id) continue;
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, id),
      );
      await prisma.brandProfile.delete({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("projects source-scoped mixed Evidence and persists complete Observation support exactly once", async () => {
    const request = {
      brandId,
      providerAccountId: "account-a",
      authorizationGeneration: 7,
      executionCutoff: new Date("2026-09-12T00:00:01.000Z"),
      windowEnd: new Date(capturedAt),
    };
    const projected = await service.project(request);
    expect(projected.sourceClass).toBe("INSTAGRAM_OWNED");
    expect(projected.windowStart).toBe("2026-08-13T00:00:00.000Z");
    expect(projected.evidence).toHaveLength(8);

    const first = await service.execute(request);
    expect(first.corpus.eligibleMediaCount).toBe(4);
    expect(first.corpus.formats.map((row) => row.format)).toEqual([
      "CAROUSEL_ALBUM",
      "IMAGE",
      "REEL",
      "VIDEO",
    ]);
    const reach = first.metricAggregates.find(
      (row) => row.cohort === "ALL_ELIGIBLE" && row.metric === "reach",
    );
    expect(reach).toMatchObject({
      eligibleSampleSize: 4,
      availableSampleSize: 3,
      unsupportedCount: 1,
      observedZeroCount: 1,
      sum: "30",
    });
    expect(reach?.arithmeticMean?.decimal).toBe("10.000000");
    expect(first.observations).toHaveLength(4);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBe(10);
    expect(
      first.snapshotFoundations.find((row) => row.metric === "followersCount"),
    ).toMatchObject({
      validSnapshotCount: 3,
      elapsedDays: 14,
      trendInterpretationEligible: true,
      authorizationGenerationLineage: [5, 6, 7],
    });
    const counts = await rowCounts();
    const replay = await service.execute(request);
    expect(await rowCounts()).toEqual(counts);
    expect(replay.observations).toEqual(first.observations);
    for (const observation of first.observations) {
      const supports = await prisma.dataExtractionObservationSupport.findMany({
        where: {
          brandId,
          semanticObservationKey: observation.semanticObservationKey,
        },
      });
      expect(supports.map((row) => row.evidenceRef).sort()).toEqual(
        observation.supportEvidenceRefs,
      );
    }
  });

  it("rejects provider and generation mismatches and admits no other tenant", async () => {
    const base = {
      brandId,
      providerAccountId: "account-a",
      authorizationGeneration: 7,
      executionCutoff: new Date("2026-09-12T00:00:01.000Z"),
      windowEnd: new Date(capturedAt),
    };
    await expect(
      service.project({ ...base, providerAccountId: "account-b" }),
    ).rejects.toMatchObject({ code: "PROVIDER_ACCOUNT_MISMATCH" });
    await expect(
      service.project({ ...base, authorizationGeneration: 6 }),
    ).rejects.toMatchObject({ code: "STALE_AUTHORIZATION_GENERATION" });
    const other = await service.project({
      ...base,
      brandId: otherBrandId,
      providerAccountId: "account-b",
      authorizationGeneration: 2,
    });
    expect(other.evidence).toHaveLength(1);
    expect(
      other.evidence.every((row) => !row.evidenceRef.includes(brandId)),
    ).toBe(true);
  });

  it("Settings-owned deletion removes C2 rows for the target Brand and preserves the other Brand", async () => {
    const otherBefore = await prisma.dataExtractionEvidenceItem.count({
      where: { brandId: otherBrandId },
    });
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brandId),
    );
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionSemanticObservation.count({
        where: { brandId },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: { brandId: otherBrandId },
      }),
    ).toBe(otherBefore);
  });

  async function createBrand(
    label: string,
    providerAccountId: string,
    generation: number,
  ) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `c2-${label}-${randomUUID()}.example.test`,
        name: `C2 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: label,
        authorizationGeneration: generation,
        credentialVersion: 1,
      },
    });
    return brand.id;
  }

  async function seedInstagramEvidence(
    id: string,
    account: string,
    generation: number,
  ) {
    await prisma.brandIntegration.updateMany({
      where: { brandProfileId: id, provider: "INSTAGRAM" },
      data: { authorizationGeneration: 5 },
    });
    await write(
      id,
      account,
      5,
      "instagram.account_profile",
      "profile-old-1",
      {
        providerAccountId: account,
        followersCount: { state: "OBSERVED", value: 10 },
      },
      undefined,
      "2026-08-29T00:00:00.000Z",
    );
    await prisma.brandIntegration.updateMany({
      where: { brandProfileId: id, provider: "INSTAGRAM" },
      data: { authorizationGeneration: 6 },
    });
    await write(
      id,
      account,
      6,
      "instagram.account_profile",
      "profile-old-2",
      {
        providerAccountId: account,
        followersCount: { state: "OBSERVED", value: 15 },
      },
      undefined,
      "2026-09-05T00:00:00.000Z",
    );
    await prisma.brandIntegration.updateMany({
      where: { brandProfileId: id, provider: "INSTAGRAM" },
      data: { authorizationGeneration: generation },
    });
    await write(
      id,
      account,
      generation,
      "instagram.account_profile",
      "profile",
      {
        providerAccountId: account,
        followersCount: { state: "OBSERVED", value: 20 },
      },
    );
    await write(
      id,
      account,
      generation,
      "instagram.media_inventory",
      "inventory",
      {
        coverage: {
          rowsReturned: 4,
          rowsMissingTimestamp: 0,
          stopReason: "EXHAUSTED",
        },
      },
    );
    const formats = ["IMAGE", "CAROUSEL_ALBUM", "REEL", "VIDEO"];
    for (const [index, format] of formats.entries()) {
      await write(
        id,
        account,
        generation,
        "instagram.media_inventory",
        `media-${index}`,
        {
          providerMediaId: `media-${index}`,
          mediaType: { state: "OBSERVED", value: format },
          publishedTimestamp: {
            state: "OBSERVED",
            value: new Date(
              Date.parse(capturedAt) - index * 86_400_000,
            ).toISOString(),
          },
          caption: { state: index === 0 ? "EXPLICIT_EMPTY" : "OBSERVED" },
          visualInspection: index === 3 ? "NOT_INSPECTED" : "INSPECTED",
          selection: { selectionRank: index === 3 ? null : index + 1 },
          metrics: {
            reach:
              index === 0
                ? { state: "OBSERVED_ZERO", value: 0 }
                : index === 3
                  ? { state: "UNSUPPORTED" }
                  : { state: "OBSERVED", value: index * 10 },
            likes: { state: "OBSERVED", value: index + 1 },
            total_interactions:
              index === 3
                ? { state: "UNAVAILABLE" }
                : { state: "OBSERVED", value: index + 2 },
          },
        },
        `media-${index}`,
      );
    }
    for (const capabilityId of [
      "instagram.audience_followers",
      "instagram.audience_engaged",
    ] as const) {
      await write(id, account, generation, capabilityId, capabilityId, {
        population: capabilityId.endsWith("followers")
          ? "FOLLOWERS"
          : "ENGAGED_AUDIENCE",
        breakdown: "AGE",
        timeframe: "THIS_MONTH",
        unit: "COUNT",
        limitation: null,
        partitionComplete: true,
        values: [
          { dimension: "18-24", value: 40 },
          { dimension: "25-34", value: 60 },
        ],
      });
    }
  }

  async function write(
    id: string,
    account: string,
    generation: number,
    capabilityId: Parameters<
      InstagramCaptureWriterService["write"]
    >[0]["capabilityId"],
    key: string,
    payload: Record<string, unknown>,
    mediaId?: string,
    eventAt = capturedAt,
  ) {
    await writer.write({
      brandId: id,
      providerAccountId: account,
      authorizationGeneration: generation,
      resourceType: mediaId ? "INSTAGRAM_MEDIA" : "INSTAGRAM_ACCOUNT",
      ...(mediaId ? { mediaId } : {}),
      capabilityId,
      requestKey: `c2:${key}`,
      providerExecutionRef: `provider-execution:c2:${key}:${id}`,
      normalizationContractVersion: "c2-source-fixture-v1",
      startedAt: eventAt,
      completedAt: eventAt,
      capturedAt: eventAt,
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["C2_FIXTURE"],
      coverage: mediaId ? "SINGLE_RESOURCE" : "SITE_WIDE_BOUNDED",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: [{ artifactKey: key, payload }],
      evidence: [
        {
          evidenceKey: key,
          artifactKey: key,
          payload,
          freshness: "CURRENT",
          representativeness: mediaId
            ? "CONTEXT_SPECIFIC"
            : "PERSISTENT_BRAND_LEVEL",
        },
      ],
    });
  }

  async function rowCounts() {
    return {
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId },
      }),
      observations: await prisma.dataExtractionSemanticObservation.count({
        where: { brandId },
      }),
      support: await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    };
  }
});

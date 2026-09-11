import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramB3aImagePipelineService } from "./instagram-b3a-image-pipeline.service";
import { InstagramB3aVisualModelPort } from "./instagram-b3a-visual-observation";
import { InstagramB3bMediaCompletionService } from "./instagram-b3b-media-completion.service";

const databaseUrl = process.env.B3B_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;
const observed = <T>(value: T) => ({ state: "OBSERVED" as const, value });

class FixtureVisualModel extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "fixture-still-observer";
  readonly modelProfileVersion = "fixture-v1";
  observe = vi.fn().mockResolvedValue({
    description: "A bounded geometric still image.",
    visibleElements: ["rectangle"],
    dominantColors: ["blue"],
    composition: "Centered still composition.",
  });
}

describePostgres("B3B PostgreSQL mixed-media completion", () => {
  const prisma = new PrismaService();
  let root: string;
  let store: InstagramImageTemporaryStore;
  let purge: InstagramDerivedDataPurgeService;
  let brandId: string;

  beforeAll(async () => {
    await prisma.$connect();
    root = await mkdtemp(join(tmpdir(), "instagram-b3b-postgres-"));
    store = new InstagramImageTemporaryStore(join(root, "owned"));
    purge = new InstagramDerivedDataPurgeService(store);
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `b3b-${randomUUID()}.example.test`,
        name: "B3B fixture",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    brandId = brand.id;
    await prisma.brandIntegration.create({
      data: {
        brandProfileId: brandId,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId: "b3b-account",
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: "fixture",
        authorizationGeneration: 7,
        credentialVersion: 1,
      },
    });
  });

  afterAll(async () => {
    if (brandId) {
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, brandId),
      );
      await prisma.brandProfile.delete({ where: { id: brandId } });
    }
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  it("persists parent-owned IMAGE/CAROUSEL/REEL/VIDEO lineage and replays with stable row counts", async () => {
    const types = ["IMAGE", "CAROUSEL_ALBUM", "REEL", "VIDEO"];
    const items = types.map((mediaType, index) => ({
      providerMediaId: `mixed-${index}`,
      mediaType: observed(mediaType),
      mediaProductType: observed("FEED"),
      permalink: { state: "UNAVAILABLE" as const, reason: "FIELD_ABSENT" },
      caption:
        index === 0
          ? { state: "EXPLICIT_EMPTY" as const, value: "" as const }
          : observed(`caption-${index}`),
      timestamp: observed(
        new Date(Date.UTC(2026, 8, 11) - index * 3_600_000).toISOString(),
      ),
    }));
    const reads = {
      execute: vi.fn(async ({ command }) => {
        if (command.kind === "MEDIA_INVENTORY")
          return {
            result: {
              availability: "AVAILABLE",
              items,
              coverage: {
                windowStart: "2026-08-12T00:00:00.000Z",
                windowEnd: "2026-09-11T00:00:00.000Z",
                pagesAttempted: 1,
                pagesCompleted: 1,
                rowsReturned: 4,
                rowsEligible: 4,
                rowsMissingTimestamp: 0,
                duplicatesDiscarded: 0,
                oldestObservedTimestamp: items[3].timestamp.value,
                newestObservedTimestamp: items[0].timestamp.value,
                stopReason: "EXHAUSTED",
              },
            },
          };
        if (command.kind === "CAROUSEL_CHILDREN")
          return {
            result: {
              availability: "AVAILABLE",
              stopReason: "EXHAUSTED",
              children: [
                {
                  providerMediaId: "carousel-child",
                  ordinal: 0,
                  mediaType: observed("IMAGE"),
                  mediaProductType: observed("FEED"),
                },
              ],
            },
          };
        return {
          result: {
            availability: "AVAILABLE",
            mediaType: command.mediaType,
            metrics: { reach: { state: "OBSERVED_ZERO", value: 0 } },
          },
        };
      }),
    };
    const acquisition = {
      acquire: vi.fn(async (input) => {
        const created = await store.create(input.brandProfileId);
        const bytes = Buffer.from(`fixture-${input.mediaId}`);
        await created.handle.writeFile(bytes);
        await created.handle.close();
        return {
          artifact: {
            temporaryPath: created.path,
            mediaType: "image/png",
            byteLength: bytes.length,
            width: 2,
            height: 2,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            acquiredAt: "2026-09-11T00:00:00.000Z",
          },
          providerMediaId: input.mediaId,
          providerObservedAt: "2026-09-11T00:00:00.000Z",
        };
      }),
    };
    const writer = new InstagramCaptureWriterService(prisma);
    const pipeline = new InstagramB3aImagePipelineService(
      acquisition as never,
      new FixtureVisualModel(),
      writer,
      store,
    );
    const service = new InstagramB3bMediaCompletionService(
      reads as never,
      writer,
      pipeline,
    );
    const input = {
      brandProfileId: brandId,
      integrationId: "unused-by-fixture",
      providerAccountId: "b3b-account",
      authorizationGeneration: 7,
      windowEnd: new Date("2026-09-11T00:00:00.000Z"),
      now: () => new Date("2026-09-11T00:00:01.000Z"),
    };

    await service.execute(input);
    const count = async () => ({
      resources: await prisma.dataExtractionResource.count({
        where: { brandId },
      }),
      captures: await prisma.dataExtractionCapture.count({
        where: { brandId },
      }),
      artifacts: await prisma.dataExtractionContentArtifact.count({
        where: { brandId },
      }),
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId },
      }),
    });
    const first = await count();
    await service.execute(input);
    expect(await count()).toEqual(first);
    expect(first).toEqual({
      resources: 5,
      captures: 9,
      artifacts: 13,
      evidence: 9,
    });
    const resources = await prisma.dataExtractionResource.findMany({
      where: { brandId, resourceType: "INSTAGRAM_MEDIA" },
      orderBy: { canonicalResourceKey: "asc" },
    });
    expect(resources).toHaveLength(4);
    expect(resources.map((row) => row.canonicalResourceKey)).not.toContain(
      "carousel-child",
    );
    const payloads = await prisma.dataExtractionContentArtifact.findMany({
      where: { brandId },
      select: { inlineContent: true },
    });
    const serialized = payloads.map((row) => row.inlineContent).join("\n");
    expect(serialized).toContain("CAROUSEL_REPRESENTATIVE_ONLY");
    expect(serialized).toContain("COVER_ONLY");
    expect(serialized).toContain("VIDEO_NOT_ANALYZED");
    expect(serialized).not.toMatch(
      /temporaryPath|media_url|thumbnail_url|accessToken|rawVideoBytes|transcriptContent/i,
    );
  }, 20_000);
});

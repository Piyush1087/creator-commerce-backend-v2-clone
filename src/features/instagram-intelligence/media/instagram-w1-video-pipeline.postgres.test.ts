import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramVideoTemporaryStore } from "../../instagram/media/video/instagram-video-temporary-store";
import type { InstagramExtractedFrame } from "../../instagram/media/video/instagram-video.types";
import { InstagramW1VideoFrameModelPort } from "./instagram-w1-video-frame-observation";
import { InstagramW1VideoPipelineService } from "./instagram-w1-video-pipeline.service";

const databaseUrl = process.env.W1_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class FixtureFrameModel extends InstagramW1VideoFrameModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity: string;
  readonly modelProfileVersion: string;
  readonly failAll: boolean;
  readonly observe = vi.fn(
    async ({ frame }: { frame: InstagramExtractedFrame }) => {
      if (this.failAll) throw new Error("fixture model unavailable");
      return {
        description: `Sampled frame ${frame.ordinal} with a centered package`,
        visibleElements: ["package"],
        dominantColors: ["blue"],
        composition: "Centered object",
      };
    },
  );

  constructor(profile = "fixture-v1", failAll = false) {
    super();
    this.modelIdentity = `fixture-video-${profile}`;
    this.modelProfileVersion = profile;
    this.failAll = failAll;
  }
}

describePostgres("Week 1 video PostgreSQL lineage and preservation", () => {
  const prisma = new PrismaService();
  let root = "";
  let videoStore: InstagramVideoTemporaryStore;
  let purge: InstagramDerivedDataPurgeService;
  let brandId = "";
  let otherBrandId = "";
  let integrationId = "";
  const providerAccountId = "account-w1-primary";

  beforeAll(async () => {
    await prisma.$connect();
    root = await mkdtemp(join(tmpdir(), "instagram-w1-postgres-"));
    videoStore = new InstagramVideoTemporaryStore(join(root, "video"));
    purge = new InstagramDerivedDataPurgeService(
      new InstagramImageTemporaryStore(join(root, "image")),
      videoStore,
    );
    ({ brandId, integrationId } = await createBrand(
      "primary",
      providerAccountId,
      7,
    ));
    ({ brandId: otherBrandId } = await createBrand(
      "other",
      "account-w1-other",
      2,
    ));
  });

  afterAll(async () => {
    for (const id of [brandId, otherBrandId]) {
      if (!id) continue;
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, id),
      );
      await prisma.dataExtractionResource.deleteMany({
        where: { brandId: id },
      });
      await prisma.brandProfile.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("persists completed frame lineage, replays exact identity, preserves prior evidence after changed-profile failure, and fences substitutions", async () => {
    const firstFixture = pipeline(new FixtureFrameModel());
    const first = await firstFixture.service.execute(input());
    expect(first).toMatchObject({
      visualInspection: "INSPECTED",
      visualSemanticResult: "AVAILABLE",
      framesRequested: 6,
      framesExtracted: 2,
      framesObserved: 2,
      reused: false,
    });
    const evidence = await prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        normalizationContractVersion:
          "instagram.media_visual_observations.video-frames.w1.v1",
      },
      include: { capture: true },
      orderBy: { evidenceRef: "asc" },
    });
    expect(evidence).toHaveLength(2);
    expect(evidence.every((row) => row.capture.status === "COMPLETED")).toBe(
      true,
    );
    expect(new Set(evidence.map((row) => row.captureRef)).size).toBe(1);
    expect(
      JSON.stringify(evidence).match(
        /temporaryPath|media_url|cdninstagram|fbcdn|base64/i,
      ),
    ).toBeNull();
    const counts = await rowCounts(brandId);
    const replay = await firstFixture.service.execute(input());
    expect(replay).toMatchObject({ reused: true, framesObserved: 2 });
    expect(firstFixture.decoder.probe).toHaveBeenCalledTimes(1);
    expect(firstFixture.model.observe).toHaveBeenCalledTimes(2);
    expect(await rowCounts(brandId)).toEqual(counts);

    const changed = pipeline(new FixtureFrameModel("fixture-v2", true));
    const failedChangedProfile = await changed.service.execute(input());
    expect(failedChangedProfile).toMatchObject({
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      framesObserved: 0,
    });
    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: {
          brandId,
          normalizationContractVersion:
            "instagram.media_visual_observations.video-frames.w1.v1",
        },
      }),
    ).toBe(2);

    const beforeFence = await rowCounts(brandId);
    await expect(
      firstFixture.service.execute({
        ...input(),
        providerAccountId: "account-w1-other",
      }),
    ).resolves.toMatchObject({ reasonCode: "FINAL_FENCE_REJECTED" });
    await expect(
      firstFixture.service.execute({ ...input(), authorizationGeneration: 6 }),
    ).resolves.toMatchObject({ reasonCode: "FINAL_FENCE_REJECTED" });
    expect(await rowCounts(brandId)).toEqual(beforeFence);
    expect(await temporaryArtifactCount(join(root, "video"))).toBe(0);
  }, 20_000);

  it("Settings deletion removes target video Evidence and temporary files while preserving another tenant and website source", async () => {
    const other = await prisma.brandIntegration.findFirstOrThrow({
      where: { brandProfileId: otherBrandId, provider: "INSTAGRAM" },
    });
    const otherFixture = pipeline(new FixtureFrameModel());
    await otherFixture.service.execute({
      ...input(),
      brandProfileId: otherBrandId,
      integrationId: other.id,
      providerAccountId: "account-w1-other",
      authorizationGeneration: 2,
      mediaId: "media-other",
      sourceCaptureRef: "capture:instagram:other-light",
      sourceEvidenceRefs: ["evidence:instagram:other-light"],
    });
    const websiteRef = `resource:website:${randomUUID()}`;
    await prisma.dataExtractionResource.create({
      data: {
        resourceRef: websiteRef,
        brandId,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        canonicalResourceKey: `https://w1-${randomUUID()}.example.test/`,
        canonicalResourceKeyHash: createHash("sha256")
          .update(websiteRef)
          .digest("hex"),
        canonicalUrl: "https://example.test/",
      },
    });
    const pending = await videoStore.createVideo(brandId);
    await pending.handle.writeFile("task-owned temporary bytes");
    await pending.handle.close();
    const otherBefore = await prisma.dataExtractionEvidenceItem.count({
      where: { brandId: otherBrandId },
    });
    expect(await purge.purgeTemporaryScope(brandId)).toBe(1);
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brandId),
    );
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionResource.count({
        where: { resourceRef: websiteRef },
      }),
    ).toBe(1);
    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: { brandId: otherBrandId },
      }),
    ).toBe(otherBefore);
    expect(await temporaryArtifactCount(join(root, "video"))).toBe(0);
  }, 20_000);

  function pipeline(model: FixtureFrameModel) {
    const acquisition = {
      acquire: vi.fn(
        async ({ brandProfileId: scope }: { brandProfileId: string }) => {
          const created = await videoStore.createVideo(scope);
          const bytes = Buffer.from("deterministic-w1-video-fixture");
          await created.handle.writeFile(bytes);
          await created.handle.close();
          return {
            artifact: {
              temporaryPath: created.path,
              mediaType: "video/mp4",
              byteLength: bytes.length,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              acquiredAt: "2026-09-13T00:00:00.000Z",
            },
            providerObservedAt: "2026-09-12T00:00:00.000Z",
            locatorAvailability: "AVAILABLE",
          };
        },
      ),
    };
    const decoder = {
      probe: vi.fn().mockResolvedValue({
        container: "mp4",
        codec: "h264",
        durationMilliseconds: 10_000,
        width: 1_920,
        height: 1_080,
      }),
      extractFrames: vi.fn(
        async ({ isolationScope }: { isolationScope: string }) => {
          const output: InstagramExtractedFrame[] = [];
          for (const ordinal of [0, 1]) {
            const created = await videoStore.createFrame(isolationScope);
            const bytes = Buffer.from(`frame-${ordinal}`);
            await created.handle.writeFile(bytes);
            await created.handle.close();
            output.push({
              temporaryPath: created.path,
              ordinal,
              requestedTimestampMilliseconds: ordinal * 1_500,
              actualTimestampMilliseconds: null,
              mediaType: "image/jpeg",
              byteLength: bytes.length,
              width: 1_280,
              height: 720,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            });
          }
          return output;
        },
      ),
    };
    return {
      model,
      decoder,
      service: new InstagramW1VideoPipelineService(
        { get: vi.fn().mockReturnValue("true") } as never,
        prisma,
        acquisition as never,
        decoder as never,
        model,
        new InstagramCaptureWriterService(prisma),
        videoStore,
      ),
    };
  }

  function input() {
    return {
      brandProfileId: brandId,
      integrationId,
      providerAccountId,
      authorizationGeneration: 7,
      mediaId: "media-primary",
      windowEnd: new Date("2026-09-13T00:00:00.000Z"),
      sourceCaptureRef: "capture:instagram:primary-light",
      sourceEvidenceRefs: ["evidence:instagram:primary-light"],
      now: () => new Date("2026-09-13T00:00:01.000Z"),
    };
  }

  async function createBrand(
    label: string,
    account: string,
    generation: number,
  ) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `w1-${label}-${randomUUID()}.example.test`,
        name: `W1 ${label}`,
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
        providerAccountId: account,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: label,
        authorizationGeneration: generation,
        credentialVersion: 1,
      },
    });
    return { brandId: brand.id, integrationId: integration.id };
  }

  async function rowCounts(id: string) {
    return {
      resources: await prisma.dataExtractionResource.count({
        where: { brandId: id },
      }),
      captures: await prisma.dataExtractionCapture.count({
        where: { brandId: id },
      }),
      artifacts: await prisma.dataExtractionContentArtifact.count({
        where: { brandId: id },
      }),
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId: id },
      }),
      observations: await prisma.dataExtractionSemanticObservation.count({
        where: { brandId: id },
      }),
    };
  }
});

async function temporaryArtifactCount(root: string) {
  let count = 0;
  for (const scope of await readdir(root, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (!scope.isDirectory()) continue;
    count += (
      await readdir(join(root, scope.name), { withFileTypes: true })
    ).filter((entry) => entry.isFile()).length;
  }
  return count;
}

import { createHash, randomUUID } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramVideoTemporaryStore } from "../../instagram/media/video/instagram-video-temporary-store";
import { InstagramW4SpeechPipelineService } from "./instagram-w4-speech-pipeline.service";

const databaseUrl = process.env.W4_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("Week 4 speech PostgreSQL lineage and replay", () => {
  const prisma = new PrismaService();
  const writer = new InstagramCaptureWriterService(prisma);
  const brandIds: string[] = [];
  let root = "";
  let store: InstagramVideoTemporaryStore;
  let purge: InstagramDerivedDataPurgeService;

  beforeAll(async () => {
    await prisma.$connect();
    root = await mkdtemp(join(tmpdir(), "instagram-w4-postgres-"));
    store = new InstagramVideoTemporaryStore(join(root, "owned"));
    purge = new InstagramDerivedDataPurgeService(store);
  });

  afterAll(async () => {
    for (const brandId of brandIds) {
      await purge.purgeTemporaryScope(brandId);
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, brandId),
      );
    }
    await prisma.offering.deleteMany({
      where: { brandProfileId: { in: brandIds } },
    });
    await prisma.brandProfile.deleteMany({ where: { id: { in: brandIds } } });
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  async function fixture(label: string) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `w4-${label}-${randomUUID()}.example.test`,
        name: `W4 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    brandIds.push(brand.id);
    const providerAccountId = `account-${randomUUID()}`;
    const integration = await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: "fixture-handle",
        authorizationGeneration: 4,
        credentialVersion: 1,
      },
    });
    await prisma.offering.create({
      data: {
        brandProfileId: brand.id,
        type: "PRODUCT",
        name: "Launch Kit",
        url: "https://example.test/launch-kit",
        locationIds: [],
      },
    });
    return { brand, integration, providerAccountId };
  }

  function pipeline(state: Awaited<ReturnType<typeof fixture>>) {
    const authorization = {
      assertReplayAuthorized: vi.fn().mockResolvedValue(undefined),
      acquire: vi.fn(async () => {
        const created = await store.createVideo(state.brand.id);
        const bytes = Buffer.from("bounded-video");
        await created.handle.writeFile(bytes);
        await created.handle.close();
        return {
          artifact: {
            temporaryPath: created.path,
            mediaType: "video/mp4" as const,
            byteLength: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            acquiredAt: "2026-09-14T00:00:01.000Z",
          },
        };
      }),
    };
    const decoder = {
      probe: vi.fn().mockResolvedValue({ durationMilliseconds: 12_000 }),
    };
    const extractor = {
      extract: vi.fn(async () => {
        const created = await store.createAudio(state.brand.id);
        const bytes = Buffer.from("RIFF----WAVEbounded-audio");
        await created.handle.writeFile(bytes);
        await created.handle.close();
        return {
          temporaryPath: created.path,
          mediaType: "audio/wav" as const,
          byteLength: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          channels: 1 as const,
          sampleRateHz: 16000 as const,
          sampleFormat: "signed-16-bit PCM" as const,
        };
      }),
    };
    const transcription = {
      providerIdentity: "DETERMINISTIC_FIXTURE",
      modelIdentity: "w4-speech-fixture",
      modelProfileVersion: "w4-speech-fixture-v1",
      transcribe: vi.fn().mockResolvedValue({
        state: "OBSERVED",
        segments: [
          {
            ordinal: 0,
            startMs: 0,
            endMs: 2200,
            text: "Launch Kit. Shop now.",
          },
          {
            ordinal: 1,
            startMs: 4000,
            endMs: 6000,
            text: "Preserve source language.",
          },
        ],
      }),
    };
    const persistence = { write: vi.fn(writer.write.bind(writer)) };
    return {
      authorization,
      decoder,
      extractor,
      transcription,
      persistence,
      service: new InstagramW4SpeechPipelineService(
        { get: vi.fn().mockReturnValue("true") } as never,
        prisma,
        authorization as never,
        decoder as never,
        extractor as never,
        transcription as never,
        persistence as never,
        store,
      ),
    };
  }

  async function counts(brandId: string) {
    return {
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
      observations: await prisma.dataExtractionSemanticObservation.count({
        where: { brandId },
      }),
      supports: await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    };
  }

  it("persists bounded speech lineage, replays without work, isolates tenants, and purges target only", async () => {
    const target = await fixture("target");
    const other = await fixture("other");
    const targetPipeline = pipeline(target);
    const otherPipeline = pipeline(other);
    const input = {
      brandProfileId: target.brand.id,
      integrationId: target.integration.id,
      providerAccountId: target.providerAccountId,
      authorizationGeneration: 4,
      mediaId: "reel-1",
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
      sourceCaptureRef: "capture:instagram:source:1",
      sourceEvidenceRefs: ["evidence:instagram:source:1"],
      now: () => new Date("2026-09-14T00:00:02.000Z"),
    };
    const first = await targetPipeline.service.execute(input);
    const otherFirst = await otherPipeline.service.execute({
      ...input,
      brandProfileId: other.brand.id,
      integrationId: other.integration.id,
      providerAccountId: other.providerAccountId,
    });
    if (first.state === "UNKNOWN") {
      const pending = targetPipeline.persistence.write.mock.results[0]?.value;
      if (pending) await pending;
    }
    expect(first).toMatchObject({
      state: "OBSERVED",
      segmentCount: 2,
      reused: false,
    });
    expect(otherFirst.state).toBe("OBSERVED");
    const stable = await counts(target.brand.id);
    expect(stable).toEqual({
      resources: 1,
      captures: 1,
      artifacts: 1,
      evidence: 2,
      observations: 1,
      supports: 1,
    });
    const replay = await targetPipeline.service.execute(input);
    expect(replay).toMatchObject({
      state: "OBSERVED",
      segmentCount: 2,
      reused: true,
    });
    expect(replay.evidenceRefs).toEqual(first.evidenceRefs);
    expect(await counts(target.brand.id)).toEqual(stable);
    expect(
      targetPipeline.authorization.assertReplayAuthorized,
    ).toHaveBeenCalledTimes(2);
    expect(targetPipeline.authorization.acquire).toHaveBeenCalledOnce();
    expect(targetPipeline.decoder.probe).toHaveBeenCalledOnce();
    expect(targetPipeline.extractor.extract).toHaveBeenCalledOnce();
    expect(targetPipeline.transcription.transcribe).toHaveBeenCalledOnce();

    targetPipeline.transcription.transcribe.mockRejectedValueOnce(
      new Error("TRANSCRIPTION_FAILURE"),
    );
    const changedFailure = await targetPipeline.service.execute({
      ...input,
      sourceEvidenceRefs: ["evidence:instagram:changed-source"],
    });
    expect(changedFailure).toMatchObject({
      state: "UNKNOWN",
      evidenceRefs: [],
    });
    expect(await counts(target.brand.id)).toEqual(stable);

    const evidence = await prisma.dataExtractionEvidenceItem.findMany({
      where: { brandId: target.brand.id },
      include: { capture: true },
      orderBy: { evidenceRef: "asc" },
    });
    expect(evidence.map((row) => row.captureMethodClass).sort()).toEqual([
      "MODEL_DERIVATION",
      "PROVIDER_MEDIATED_FETCH",
    ]);
    const derived = evidence.find(
      (row) => row.captureMethodClass === "MODEL_DERIVATION",
    );
    const source = evidence.find(
      (row) => row.captureMethodClass === "PROVIDER_MEDIATED_FETCH",
    );
    expect(derived?.parentEvidenceRefs).toEqual([source?.evidenceRef]);
    expect(
      evidence.every(
        (row) =>
          row.capture.status === "COMPLETED" && row.capture.capturedAt !== null,
      ),
    ).toBe(true);
    expect(JSON.stringify(evidence)).not.toMatch(
      /temporaryPath|accessToken|refreshToken|media_url|cdninstagram|fbcdn|base64|system prompt|developer message|reasoning/i,
    );
    expect(await counts(other.brand.id)).toMatchObject({ evidence: 2 });

    const temp = await store.createAudio(target.brand.id);
    await temp.handle.writeFile("delete");
    await temp.handle.close();
    await purge.purgeTemporaryScope(target.brand.id);
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, target.brand.id),
    );
    await expect(access(temp.path)).rejects.toThrow();
    expect(await counts(target.brand.id)).toEqual({
      resources: 0,
      captures: 0,
      artifacts: 0,
      evidence: 0,
      observations: 0,
      supports: 0,
    });
    expect(await counts(other.brand.id)).toMatchObject({ evidence: 2 });
  });
});

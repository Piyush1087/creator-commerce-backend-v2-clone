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

  async function sourceLineage(
    state: Awaited<ReturnType<typeof fixture>>,
    mediaId: string,
    evidenceCount = 1,
  ) {
    return writer.write({
      brandId: state.brand.id,
      providerAccountId: state.providerAccountId,
      authorizationGeneration: 4,
      resourceType: "INSTAGRAM_MEDIA",
      mediaId,
      capabilityId: "instagram.media_inventory",
      requestKey: `w4-source:${mediaId}:${randomUUID()}`,
      providerExecutionRef: `provider-execution:w4-source:${randomUUID()}`,
      normalizationContractVersion: "instagram-w4-source-fixture-v1",
      startedAt: "2026-09-13T23:59:58.000Z",
      capturedAt: "2026-09-14T00:00:00.000Z",
      completedAt: "2026-09-14T00:00:00.500Z",
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["SOURCE_MEDIA_ADMITTED"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: [],
      evidence: Array.from({ length: evidenceCount }, (_, index) => ({
        evidenceKey: `admitted-source-media-${index}`,
        payload: { providerMediaId: mediaId, admitted: true, index },
        freshness: "CURRENT",
        representativeness: "CONTEXT_SPECIFIC",
      })),
    });
  }

  it("persists bounded speech lineage, replays without work, isolates tenants, and purges target only", async () => {
    const target = await fixture("target");
    const other = await fixture("other");
    const targetSource = await sourceLineage(target, "reel-1", 2);
    const otherSource = await sourceLineage(other, "reel-1");
    const websiteResourceRef = `resource:website:w4-preserved:${randomUUID()}`;
    await prisma.dataExtractionResource.create({
      data: {
        resourceRef: websiteResourceRef,
        brandId: other.brand.id,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        canonicalResourceKey: "https://example.test/w4-preserved",
        canonicalResourceKeyHash: createHash("sha256")
          .update("https://example.test/w4-preserved")
          .digest("hex"),
        canonicalUrl: "https://example.test/w4-preserved",
      },
    });
    const targetPipeline = pipeline(target);
    const otherPipeline = pipeline(other);
    const input = {
      brandProfileId: target.brand.id,
      integrationId: target.integration.id,
      providerAccountId: target.providerAccountId,
      authorizationGeneration: 4,
      mediaId: "reel-1",
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
      sourceCaptureRef: targetSource.captureRef,
      sourceEvidenceRefs: [
        targetSource.evidenceRefs[1]!,
        targetSource.evidenceRefs[0]!,
        targetSource.evidenceRefs[1]!,
      ],
      now: () => new Date("2026-09-14T00:00:02.000Z"),
    };
    const first = await targetPipeline.service.execute(input);
    const otherFirst = await otherPipeline.service.execute({
      ...input,
      brandProfileId: other.brand.id,
      integrationId: other.integration.id,
      providerAccountId: other.providerAccountId,
      sourceCaptureRef: otherSource.captureRef,
      sourceEvidenceRefs: otherSource.evidenceRefs,
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
      captures: 2,
      artifacts: 1,
      evidence: 4,
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
      "DETERMINISTIC_DERIVATION",
      "MODEL_DERIVATION",
      "PROVIDER_MEDIATED_FETCH",
      "PROVIDER_MEDIATED_FETCH",
    ]);
    const transcript = evidence.find(
      (row) => row.captureMethodClass === "MODEL_DERIVATION",
    );
    const audio = evidence.find(
      (row) => row.captureMethodClass === "DETERMINISTIC_DERIVATION",
    );
    const source = evidence.find(
      (row) => row.captureMethodClass === "PROVIDER_MEDIATED_FETCH",
    );
    expect(audio?.parentEvidenceRefs).toEqual(
      [...targetSource.evidenceRefs].sort(),
    );
    expect(transcript?.parentEvidenceRefs).toEqual([audio?.evidenceRef]);
    expect(audio?.captureRef).not.toBe(source?.captureRef);
    expect(transcript?.captureRef).toBe(audio?.captureRef);
    expect(source?.capture.capturedAt!.getTime()).toBeLessThanOrEqual(
      audio?.capture.capturedAt!.getTime() ?? 0,
    );
    expect(
      evidence.every(
        (row) =>
          row.capture.status === "COMPLETED" && row.capture.capturedAt !== null,
      ),
    ).toBe(true);
    expect(
      evidence.every((row) => /^[a-f0-9]{64}$/u.test(row.contentHash)),
    ).toBe(true);
    const artifact =
      await prisma.dataExtractionContentArtifact.findFirstOrThrow({
        where: { brandId: target.brand.id },
      });
    expect(artifact.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(artifact.byteLength).toBeGreaterThan(0);
    expect(JSON.stringify(evidence)).not.toMatch(
      /temporaryPath|accessToken|refreshToken|media_url|cdninstagram|fbcdn|base64|system prompt|developer message|reasoning/i,
    );
    expect(await counts(other.brand.id)).toMatchObject({ evidence: 3 });

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
    expect(await counts(other.brand.id)).toMatchObject({ evidence: 3 });
    await expect(
      prisma.dataExtractionResource.findUniqueOrThrow({
        where: { resourceRef: websiteResourceRef },
      }),
    ).resolves.toMatchObject({ sourceClass: "OWNED_WEBSITE" });
  });

  it("atomically rejects every invalid external source-parent substitution", async () => {
    const execute = async (
      state: Awaited<ReturnType<typeof fixture>>,
      source: Awaited<ReturnType<typeof sourceLineage>>,
      overrides: Partial<{
        mediaId: string;
        sourceCaptureRef: string;
        sourceEvidenceRefs: readonly string[];
      }> = {},
    ) => {
      const subject = pipeline(state);
      const before = await counts(state.brand.id);
      const result = await subject.service.execute({
        brandProfileId: state.brand.id,
        integrationId: state.integration.id,
        providerAccountId: state.providerAccountId,
        authorizationGeneration: 4,
        mediaId: "reel-invalid-parent",
        windowEnd: new Date("2026-09-14T00:00:00.000Z"),
        sourceCaptureRef: source.captureRef,
        sourceEvidenceRefs: source.evidenceRefs,
        now: () => new Date("2026-09-14T00:00:02.000Z"),
        ...overrides,
      });
      expect(result).toMatchObject({ state: "UNKNOWN", evidenceRefs: [] });
      expect(await counts(state.brand.id)).toEqual(before);
    };

    const nonexistent = await fixture("nonexistent-parent");
    const nonexistentSource = await sourceLineage(
      nonexistent,
      "reel-invalid-parent",
    );
    await execute(nonexistent, nonexistentSource, {
      sourceEvidenceRefs: ["evidence:instagram:missing-parent"],
    });

    const crossBrand = await fixture("cross-brand-parent-target");
    const crossBrandSourceOwner = await fixture("cross-brand-parent-owner");
    const crossBrandSource = await sourceLineage(
      crossBrandSourceOwner,
      "reel-invalid-parent",
    );
    await execute(crossBrand, crossBrandSource);

    const account = await fixture("account-parent");
    const accountSource = await sourceLineage(account, "reel-invalid-parent");
    await prisma.dataExtractionCapture.update({
      where: { captureRef: accountSource.captureRef },
      data: { providerAccountId: "different-account" },
    });
    await execute(account, accountSource);

    const generation = await fixture("generation-parent");
    const generationSource = await sourceLineage(
      generation,
      "reel-invalid-parent",
    );
    await prisma.dataExtractionCapture.update({
      where: { captureRef: generationSource.captureRef },
      data: { authorizationGeneration: 3 },
    });
    await execute(generation, generationSource);

    const media = await fixture("media-parent");
    const mediaSource = await sourceLineage(media, "different-reel");
    await execute(media, mediaSource);

    const capture = await fixture("capture-parent");
    const captureSource = await sourceLineage(capture, "reel-invalid-parent");
    await execute(capture, captureSource, {
      sourceCaptureRef: "capture:instagram:different-source",
    });

    const circular = await fixture("circular-parent");
    const circularSource = await sourceLineage(circular, "reel-invalid-parent");
    const successful = pipeline(circular);
    const successfulResult = await successful.service.execute({
      brandProfileId: circular.brand.id,
      integrationId: circular.integration.id,
      providerAccountId: circular.providerAccountId,
      authorizationGeneration: 4,
      mediaId: "reel-invalid-parent",
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
      sourceCaptureRef: circularSource.captureRef,
      sourceEvidenceRefs: circularSource.evidenceRefs,
      now: () => new Date("2026-09-14T00:00:02.000Z"),
    });
    const audio = await prisma.dataExtractionEvidenceItem.findFirstOrThrow({
      where: {
        evidenceRef: { in: [...successfulResult.evidenceRefs] },
        captureMethodClass: "DETERMINISTIC_DERIVATION",
      },
    });
    await execute(circular, circularSource, {
      sourceCaptureRef: audio.captureRef,
      sourceEvidenceRefs: [audio.evidenceRef],
    });
  });
});

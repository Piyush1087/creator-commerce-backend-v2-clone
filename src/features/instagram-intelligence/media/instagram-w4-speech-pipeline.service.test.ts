import { describe, expect, it, vi } from "vitest";

import { InstagramW4SpeechPipelineService } from "./instagram-w4-speech-pipeline.service";

describe("InstagramW4SpeechPipelineService", () => {
  it("persists exact audio/transcript lineage and replays before expensive work", async () => {
    let saved: any;
    const config = {
      get: vi.fn((name: string) =>
        name === "INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED" ? "true" : undefined,
      ),
    };
    const prisma = {
      offering: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "off-1", name: "Glow Serum" }]),
      },
      dataExtractionEvidenceItem: {
        findMany: vi.fn(async (query: any) =>
          saved &&
          query.where.boundedPayload.equals ===
            saved.payloads[0].preAcquisitionReplayIdentity
            ? saved.refs.map((evidenceRef: string, index: number) => ({
                evidenceRef,
                boundedPayload: saved.payloads[index],
                captureMethodClass:
                  index === 0 ? "PROVIDER_MEDIATED_FETCH" : "MODEL_DERIVATION",
              }))
            : [],
        ),
      },
    };
    const acquisition = {
      assertReplayAuthorized: vi.fn().mockResolvedValue(undefined),
      acquire: vi.fn().mockResolvedValue({
        artifact: {
          temporaryPath: "owned.video",
          mediaType: "video/mp4",
          byteLength: 100,
          sha256: "a".repeat(64),
          acquiredAt: "2026-09-14T00:00:00.000Z",
        },
        providerObservedAt: null,
      }),
    };
    const decoder = {
      probe: vi.fn().mockResolvedValue({
        container: "mp4",
        codec: "h264",
        durationMilliseconds: 5000,
        width: 10,
        height: 10,
      }),
    };
    const extractor = {
      extract: vi.fn().mockResolvedValue({
        temporaryPath: "owned.wav",
        mediaType: "audio/wav",
        byteLength: 1000,
        sha256: "b".repeat(64),
        channels: 1,
        sampleRateHz: 16000,
        sampleFormat: "signed-16-bit PCM",
      }),
    };
    const transcription = {
      providerIdentity: "FIXTURE",
      modelIdentity: "fixture-model",
      modelProfileVersion: "fixture-v1",
      transcribe: vi.fn().mockResolvedValue({
        state: "OBSERVED",
        segments: [
          {
            ordinal: 0,
            startMs: 0,
            endMs: 2000,
            text: "Glow Serum shop now",
            language: "en",
          },
        ],
      }),
    };
    const writer = {
      write: vi.fn(async (input: any) => {
        const refs = ["evidence:audio", "evidence:transcript"];
        saved = {
          refs,
          payloads: input.evidence.map((row: any) => row.payload),
        };
        return { evidenceRefs: refs, reused: false };
      }),
    };
    const store = { remove: vi.fn().mockResolvedValue(undefined) };
    const service = new InstagramW4SpeechPipelineService(
      config as never,
      prisma as never,
      acquisition as never,
      decoder as never,
      extractor as never,
      transcription as never,
      writer as never,
      store as never,
    );
    const input = {
      brandProfileId: "brand-1",
      integrationId: "integration-1",
      providerAccountId: "account-1",
      authorizationGeneration: 7,
      mediaId: "reel-1",
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
      sourceCaptureRef: "capture:source",
      sourceEvidenceRefs: ["evidence:source"],
      now: () => new Date("2026-09-14T00:00:00.000Z"),
    };
    const first = await service.execute(input);
    const replay = await service.execute(input);
    expect(first).toMatchObject({
      state: "OBSERVED",
      segmentCount: 1,
      reused: false,
    });
    expect(replay).toMatchObject({
      state: "OBSERVED",
      segmentCount: 1,
      reused: true,
      reasonCode: "EXACT_SPEECH_EXECUTION_REUSED",
    });
    expect(acquisition.assertReplayAuthorized).toHaveBeenCalledTimes(2);
    expect(acquisition.acquire).toHaveBeenCalledTimes(1);
    expect(decoder.probe).toHaveBeenCalledTimes(1);
    expect(extractor.extract).toHaveBeenCalledTimes(1);
    expect(transcription.transcribe).toHaveBeenCalledTimes(1);
    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(writer.write.mock.calls[0]![0].evidence[1]).toMatchObject({
      derivationParentEvidenceKey: "audio-technical",
    });
    expect(JSON.stringify(writer.write.mock.calls[0]![0])).not.toMatch(
      /temporaryPath|base64|accessToken|media_url/iu,
    );
    expect(store.remove).toHaveBeenCalledWith("owned.wav");
    expect(store.remove).toHaveBeenCalledWith("owned.video");

    const changed = await service.execute({
      ...input,
      sourceEvidenceRefs: ["evidence:changed-source"],
    });
    expect(changed.reused).toBe(false);
    expect(acquisition.acquire).toHaveBeenCalledTimes(2);
    expect(transcription.transcribe).toHaveBeenCalledTimes(2);

    acquisition.assertReplayAuthorized.mockRejectedValueOnce(
      new Error("STALE_OR_CROSS_BRAND"),
    );
    await expect(service.execute(input)).resolves.toMatchObject({
      state: "UNKNOWN",
      evidenceRefs: [],
    });
    expect(acquisition.acquire).toHaveBeenCalledTimes(2);
  });

  it("fails closed without Evidence and still cleans temporary media", async () => {
    const service = new InstagramW4SpeechPipelineService(
      { get: vi.fn() } as never,
      {
        offering: { findMany: vi.fn().mockResolvedValue([]) },
        dataExtractionEvidenceItem: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
      {
        assertReplayAuthorized: vi.fn(),
        acquire: vi.fn().mockResolvedValue({
          artifact: {
            temporaryPath: "owned.video",
            mediaType: "video/mp4",
            byteLength: 1,
            sha256: "a".repeat(64),
            acquiredAt: "2026-09-14T00:00:00.000Z",
          },
        }),
      } as never,
      {
        probe: vi.fn().mockResolvedValue({ durationMilliseconds: 1000 }),
      } as never,
      {
        extract: vi.fn().mockRejectedValue(new Error("NO_AUDIO_TRACK")),
      } as never,
      {
        providerIdentity: "FIXTURE",
        modelIdentity: "fixture",
        modelProfileVersion: "v1",
      } as never,
      { write: vi.fn() } as never,
      { remove: vi.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(
      service.execute({
        brandProfileId: "b",
        integrationId: "i",
        providerAccountId: "a",
        authorizationGeneration: 1,
        mediaId: "m",
        windowEnd: new Date(),
        sourceCaptureRef: "c",
        sourceEvidenceRefs: ["e"],
      }),
    ).resolves.toMatchObject({ state: "UNKNOWN", evidenceRefs: [] });
  });
});

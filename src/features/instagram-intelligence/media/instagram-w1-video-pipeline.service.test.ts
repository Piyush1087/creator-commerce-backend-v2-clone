import { describe, expect, it, vi } from "vitest";

import type { InstagramExtractedFrame } from "../../instagram/media/video/instagram-video.types";
import { InstagramW1VideoPipelineService } from "./instagram-w1-video-pipeline.service";

const sha = "a".repeat(64);

describe("InstagramW1VideoPipelineService", () => {
  it("persists exact successful frame evidence and explicit partial coverage", async () => {
    const fixture = createFixture({ failOrdinal: 1 });
    const result = await fixture.service.execute(request());

    expect(result).toMatchObject({
      visualInspection: "INSPECTED",
      visualSemanticResult: "AVAILABLE",
      reasonCode: "PARTIAL_FRAME_INSPECTION",
      framesRequested: 6,
      framesExtracted: 3,
      framesObserved: 2,
    });
    const write = fixture.writer.write.mock.calls[0]![0];
    expect(write.availability).toBe("PARTIAL");
    expect(write.evidence).toHaveLength(2);
    expect(
      write.evidence.map(
        (value: { payload: { frame: { frameOrdinal: number } } }) =>
          value.payload.frame.frameOrdinal,
      ),
    ).toEqual([0, 2]);
    expect(JSON.stringify(write)).not.toContain("temporaryPath");
    expect(fixture.store.remove).toHaveBeenCalledTimes(4);
  });

  it("reuses exact successful identity before acquisition with original partial coverage", async () => {
    const fixture = createFixture({ failOrdinal: 1 });
    const first = await fixture.service.execute(request());
    const result = await fixture.service.execute(request());
    expect(first).toMatchObject({
      framesRequested: 6,
      framesExtracted: 3,
      framesObserved: 2,
      reused: false,
    });
    expect(result).toMatchObject({
      reasonCode: "EXACT_VIDEO_EXECUTION_REUSED",
      reused: true,
      framesRequested: 6,
      framesExtracted: 3,
      framesObserved: 2,
    });
    expect(result.evidenceRefs).toEqual(first.evidenceRefs);
    expect(fixture.acquisition.assertReplayAuthorized).toHaveBeenCalledTimes(2);
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(1);
    expect(fixture.decoder.probe).toHaveBeenCalledTimes(1);
    expect(fixture.decoder.extractFrames).toHaveBeenCalledTimes(1);
    expect(fixture.model.observe).toHaveBeenCalledTimes(3);
    expect(fixture.writer.write).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a zero-Evidence failure", async () => {
    const fixture = createFixture({ failAll: true });
    await fixture.service.execute(request());
    const second = await fixture.service.execute(request());
    expect(second.reused).toBe(false);
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(2);
    expect(fixture.decoder.probe).toHaveBeenCalledTimes(2);
  });

  it("does not collide changed source, window, media, or model identity", async () => {
    const fixture = createFixture({});
    await fixture.service.execute(request());
    await fixture.service.execute({
      ...request(),
      sourceCaptureRef: "capture:instagram:light:2",
    });
    await fixture.service.execute({
      ...request(),
      windowEnd: new Date("2026-09-14T00:00:00.000Z"),
    });
    await fixture.service.execute({ ...request(), mediaId: "media-2" });
    fixture.model.modelProfileVersion = "fixture-v2";
    await fixture.service.execute(request());
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(5);
    expect(fixture.decoder.probe).toHaveBeenCalledTimes(5);
  });

  it("rejects cross-Brand, account, generation, and current authorization loss before replay", async () => {
    const fixture = createFixture({});
    await fixture.service.execute(request());
    for (const invalid of [
      { ...request(), brandProfileId: "brand-2" },
      { ...request(), providerAccountId: "account-2" },
      { ...request(), authorizationGeneration: 2 },
    ]) {
      await expect(fixture.service.execute(invalid)).resolves.toMatchObject({
        reasonCode: "FINAL_FENCE_REJECTED",
        reused: false,
      });
    }
    fixture.setAuthorized(false);
    await expect(fixture.service.execute(request())).resolves.toMatchObject({
      reasonCode: "FINAL_FENCE_REJECTED",
      reused: false,
    });
    expect(fixture.acquisition.acquire).toHaveBeenCalledTimes(1);
  });

  it("fails closed when every frame model observation fails", async () => {
    const fixture = createFixture({ failAll: true });
    const result = await fixture.service.execute(request());
    expect(result).toMatchObject({
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      reasonCode: "MODEL_FAILURE",
      framesObserved: 0,
    });
    expect(fixture.writer.write.mock.calls[0]![0].evidence).toEqual([]);
  });

  it("rejects an out-of-contract decoder frame before model execution", async () => {
    const fixture = createFixture({ invalidFrame: true });
    const result = await fixture.service.execute(request());
    expect(result.reasonCode).toBe("INVALID_FRAME");
    expect(fixture.model.observe).not.toHaveBeenCalled();
    expect(fixture.writer.write).toHaveBeenCalledWith(
      expect.objectContaining({ availability: "PARTIAL", evidence: [] }),
    );
  });

  it("defaults the rollout switch to fail closed", () => {
    const fixture = createFixture({ enabled: undefined });
    expect(fixture.service.isEnabled()).toBe(false);
  });
});

function createFixture(options: {
  failOrdinal?: number;
  failAll?: boolean;
  invalidFrame?: boolean;
  enabled?: string;
}) {
  const config = {
    get: vi.fn((name: string) =>
      name === "INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED"
        ? options.enabled
        : undefined,
    ),
  };
  let authorized = true;
  let persisted:
    | {
        metadata: Record<string, unknown>;
        payloads: readonly Record<string, unknown>[];
        evidenceRefs: readonly string[];
      }
    | undefined;
  const prisma = {
    dataExtractionEvidenceItem: {
      findMany: vi.fn(
        async (query: {
          where: {
            boundedPayload: { path: [string]; equals: string };
          };
        }) => {
          if (!persisted) return [];
          const field = query.where.boundedPayload.path[0];
          if (persisted.metadata[field] !== query.where.boundedPayload.equals)
            return [];
          return persisted.evidenceRefs.map((evidenceRef, index) => ({
            evidenceRef,
            captureRef: "capture:instagram:w1",
            boundedPayload: persisted!.payloads[index],
            capture: {
              createdAt: new Date("2026-09-13T00:00:00.000Z"),
              contentArtifacts: [
                { inlineContent: JSON.stringify(persisted!.metadata) },
              ],
            },
          }));
        },
      ),
    },
  };
  const acquisition = {
    assertReplayAuthorized: vi.fn(
      async (input: {
        brandProfileId: string;
        expectedProviderAccountId: string;
        expectedAuthorizationGeneration: number;
      }) => {
        if (
          !authorized ||
          input.brandProfileId !== "brand-1" ||
          input.expectedProviderAccountId !== "account-1" ||
          input.expectedAuthorizationGeneration !== 1
        )
          throw new Error("authorization fence rejected");
      },
    ),
    acquire: vi.fn().mockResolvedValue({
      artifact: {
        temporaryPath: "task-owned.video",
        mediaType: "video/mp4",
        byteLength: 12,
        sha256: sha,
        acquiredAt: "2026-09-13T00:00:00.000Z",
      },
      providerObservedAt: "2026-09-12T00:00:00.000Z",
      locatorAvailability: "AVAILABLE",
    }),
  };
  const frames = [0, 1, 2].map(frame);
  if (options.invalidFrame) frames[0] = { ...frames[0]!, width: 1_281 };
  const decoder = {
    probe: vi.fn().mockResolvedValue({
      container: "mp4",
      codec: "h264",
      durationMilliseconds: 3_500,
      width: 1_080,
      height: 1_920,
    }),
    extractFrames: vi.fn().mockResolvedValue(frames),
  };
  const model = {
    providerIdentity: "FIXTURE",
    modelIdentity: "fixture-model",
    modelProfileVersion: "fixture-v1",
    observe: vi.fn(
      async ({ frame: value }: { frame: InstagramExtractedFrame }) => {
        if (options.failAll || value.ordinal === options.failOrdinal)
          throw new Error("fixture failure");
        return {
          description: `Frame ${value.ordinal}`,
          visibleElements: ["package"],
          dominantColors: ["blue"],
          composition: "Centered object",
        };
      },
    ),
  };
  const writer = {
    write: vi.fn(
      async (input: {
        artifacts: readonly Readonly<{
          artifactKey: string;
          payload: Record<string, unknown>;
        }>[];
        evidence: readonly Readonly<{ payload: Record<string, unknown> }>[];
      }) => {
        const evidenceRefs = input.evidence.map(
          (_value, index) => `evidence:${index}`,
        );
        const metadata = input.artifacts.find(
          (artifact) => artifact.artifactKey === "verified-video-metadata",
        )?.payload;
        if (metadata && evidenceRefs.length > 0) {
          persisted = {
            metadata,
            payloads: input.evidence.map((evidence) => evidence.payload),
            evidenceRefs,
          };
        }
        return { reused: false, evidenceRefs };
      },
    ),
  };
  const store = { remove: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new InstagramW1VideoPipelineService(
      config as never,
      prisma as never,
      acquisition as never,
      decoder as never,
      model as never,
      writer as never,
      store as never,
    ),
    decoder,
    acquisition,
    model,
    writer,
    store,
    setAuthorized(value: boolean) {
      authorized = value;
    },
  };
}

function frame(ordinal: number): InstagramExtractedFrame {
  return {
    temporaryPath: `frame-${ordinal}.jpg`,
    ordinal,
    requestedTimestampMilliseconds: ordinal * 1_500,
    actualTimestampMilliseconds: null,
    mediaType: "image/jpeg",
    byteLength: 1_024,
    width: 1_280,
    height: 720,
    sha256: String(ordinal + 1).repeat(64),
  };
}

function request() {
  return {
    brandProfileId: "brand-1",
    integrationId: "integration-1",
    providerAccountId: "account-1",
    authorizationGeneration: 1,
    mediaId: "media-1",
    windowEnd: new Date("2026-09-13T00:00:00.000Z"),
    sourceCaptureRef: "capture:instagram:light:1",
    sourceEvidenceRefs: ["evidence:instagram:light:1"],
    now: () => new Date("2026-09-13T00:00:00.000Z"),
  };
}

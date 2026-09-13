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

  it("reuses exact successful identity without probe, extraction, or model work", async () => {
    const fixture = createFixture({ replay: ["evidence:a", "evidence:b"] });
    const result = await fixture.service.execute(request());
    expect(result).toMatchObject({
      reasonCode: "EXACT_VIDEO_EXECUTION_REUSED",
      reused: true,
      framesObserved: 2,
    });
    expect(fixture.decoder.probe).not.toHaveBeenCalled();
    expect(fixture.decoder.extractFrames).not.toHaveBeenCalled();
    expect(fixture.model.observe).not.toHaveBeenCalled();
    expect(fixture.writer.write).not.toHaveBeenCalled();
    expect(fixture.store.remove).toHaveBeenCalledTimes(1);
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
  replay?: string[];
  enabled?: string;
}) {
  const config = {
    get: vi.fn((name: string) =>
      name === "INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED"
        ? options.enabled
        : undefined,
    ),
  };
  const prisma = {
    dataExtractionEvidenceItem: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          (options.replay ?? []).map((evidenceRef) => ({ evidenceRef })),
        ),
    },
  };
  const acquisition = {
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
    write: vi.fn().mockResolvedValue({
      reused: false,
      evidenceRefs: ["evidence:0", "evidence:2"],
    }),
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
    model,
    writer,
    store,
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

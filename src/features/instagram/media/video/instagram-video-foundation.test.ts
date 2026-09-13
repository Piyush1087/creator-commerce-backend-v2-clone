import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  InstagramPinnedResponse,
  InstagramResolvedAddress,
} from "../instagram-secure-image-downloader";
import { InstagramSecureVideoDownloader } from "./instagram-secure-video-downloader";
import { runBounded } from "./instagram-video-decoder";
import { InstagramVideoTemporaryStore } from "./instagram-video-temporary-store";
import {
  INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES,
  InstagramVideoError,
  selectInstagramVideoFrameTimestamps,
} from "./instagram-video.types";

const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Week 1 shared video foundation", () => {
  it("selects the six canonical normalized timestamps", () => {
    expect(selectInstagramVideoFrameTimestamps(10_000)).toEqual([
      0, 1_500, 3_000, 5_000, 8_000, 9_750,
    ]);
  });

  it("deduplicates short-video timestamps without inventing replacements", () => {
    expect(selectInstagramVideoFrameTimestamps(250)).toEqual([0, 125, 200]);
    expect(selectInstagramVideoFrameTimestamps(1)).toEqual([0]);
  });

  it("accepts 180 seconds and rejects durations above the frozen maximum", () => {
    expect(selectInstagramVideoFrameTimestamps(180_000)).toHaveLength(6);
    expect(() => selectInstagramVideoFrameTimestamps(180_001)).toThrowError(
      expect.objectContaining({ code: "DURATION_EXCEEDED" }),
    );
  });

  it("uses argv execution without shell interpretation and bounds output", async () => {
    const inert = "media;echo injected";
    const result = await runBounded(process.execPath, [
      "-e",
      "process.stdout.write(process.argv[1])",
      inert,
    ]);
    expect(result.stdout).toBe(inert);
    await expect(
      runBounded(process.execPath, [
        "-e",
        "process.stdout.write('x'.repeat(70000))",
      ]),
    ).rejects.toMatchObject({ code: "DECODER_FAILURE" });
  });

  it("terminates an aborted decoder process", async () => {
    await expect(
      runBounded(
        process.execPath,
        ["-e", "setTimeout(()=>{},10000)"],
        AbortSignal.timeout(20),
      ),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it.each([
    "http://video.cdninstagram.com/a.mp4",
    "https://example.com/a.mp4",
    "https://127.0.0.1/a.mp4",
  ])("rejects unsafe locator %s", async (locator) => {
    const { downloader } = await harness();
    await expect(
      downloader.download({ locator, isolationScope: "scope" }),
    ).rejects.toBeInstanceOf(InstagramVideoError);
  });

  it("rejects private DNS answers", async () => {
    const { downloader } = await harness({
      addresses: [{ address: "127.0.0.1", family: 4 }],
    });
    await expect(
      downloader.download({
        locator: "https://video.cdninstagram.com/a.mp4",
        isolationScope: "scope",
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DNS" });
  });

  it("revalidates redirects and rejects a redirect that resolves privately", async () => {
    let requestCount = 0;
    const { downloader } = await harness({
      resolve: (hostname) =>
        hostname === "video.fbcdn.net"
          ? [{ address: "10.0.0.1", family: 4 }]
          : [{ address: "8.8.8.8", family: 4 }],
      response: () => {
        requestCount += 1;
        return response(
          302,
          { location: "https://video.fbcdn.net/redirect.mp4" },
          [],
        );
      },
    });
    await expect(
      downloader.download({
        locator: "https://video.cdninstagram.com/a.mp4",
        isolationScope: "scope",
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DNS" });
    expect(requestCount).toBe(1);
  });

  it("rejects oversized declared, chunked, and dishonest lengths and cleans up", async () => {
    const declared = await harness({
      response: () =>
        response(
          200,
          {
            "content-type": "video/mp4",
            "content-length": String(INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES + 1),
          },
          [mp4()],
        ),
    });
    await expectDownload(declared.downloader, "OVERSIZED_VIDEO");

    const dishonest = await harness({
      response: () =>
        response(200, { "content-type": "video/mp4", "content-length": "13" }, [
          mp4(),
        ]),
    });
    await expectDownload(dishonest.downloader, "INVALID_VIDEO");

    const chunked = await harness({
      response: () =>
        response(200, { "content-type": "video/mp4" }, oversizedChunks()),
    });
    await expectDownload(chunked.downloader, "OVERSIZED_VIDEO");
    expect(await countArtifacts(chunked.root)).toBe(0);
  });

  it("validates MP4 signature and removes corrupt artifacts", async () => {
    const { downloader, root } = await harness({
      response: () =>
        response(200, { "content-type": "video/mp4" }, [Buffer.alloc(12)]),
    });
    await expectDownload(downloader, "UNSUPPORTED_VIDEO_TYPE");
    expect(await countArtifacts(root)).toBe(0);
  });

  it("persists a bounded valid source atomically until explicit cleanup", async () => {
    const { downloader, store, root } = await harness();
    const artifact = await downloader.download({
      locator: "https://video.cdninstagram.com/a.mp4",
      isolationScope: "scope",
    });
    expect(artifact.byteLength).toBe(12);
    expect(artifact.mediaType).toBe("video/mp4");
    expect(await countArtifacts(root)).toBe(1);
    await store.remove(artifact.temporaryPath);
    expect(await countArtifacts(root)).toBe(0);
  });
});

async function harness(options?: {
  addresses?: readonly InstagramResolvedAddress[];
  resolve?: (hostname: string) => readonly InstagramResolvedAddress[];
  response?: () => InstagramPinnedResponse;
}) {
  const root = await mkdtemp(join(tmpdir(), "instagram-w1-video-test-"));
  roots.push(root);
  const store = new InstagramVideoTemporaryStore(root);
  const resolver = {
    resolve: async (hostname: string) =>
      options?.resolve?.(hostname) ??
      options?.addresses ?? [{ address: "8.8.8.8", family: 4 }],
  };
  const transport = {
    request: async () =>
      options?.response?.() ??
      response(200, { "content-type": "video/mp4", "content-length": "12" }, [
        mp4(),
      ]),
  };
  return {
    root,
    store,
    downloader: new InstagramSecureVideoDownloader(
      resolver as never,
      transport as never,
      store,
    ),
  };
}

function response(
  statusCode: number,
  headers: Record<string, string>,
  chunks: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): InstagramPinnedResponse {
  return {
    statusCode,
    headers,
    body: chunks as AsyncIterable<Uint8Array>,
    dispose: vi.fn(),
  };
}

function mp4() {
  return Buffer.from([
    0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
}

async function* oversizedChunks() {
  yield mp4();
  for (let index = 0; index <= 100; index += 1) yield Buffer.alloc(1024 * 1024);
}

async function expectDownload(
  downloader: InstagramSecureVideoDownloader,
  code: string,
) {
  await expect(
    downloader.download({
      locator: "https://video.cdninstagram.com/a.mp4",
      isolationScope: "scope",
    }),
  ).rejects.toMatchObject({ code });
}

async function countArtifacts(root: string) {
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

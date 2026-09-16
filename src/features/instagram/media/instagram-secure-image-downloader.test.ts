import { createHash } from "node:crypto";
import {
  access,
  mkdtemp,
  readdir,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  INSTAGRAM_IMAGE_MAX_BYTES,
  INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS,
  InstagramImageAcquisitionError,
} from "./instagram-image-acquisition.types";
import { InstagramImageTemporaryStore } from "./instagram-image-temporary-store";
import {
  InstagramSecureImageDownloader,
  NodeInstagramImageDnsResolver,
  NodeInstagramPinnedHttpsTransport,
  type InstagramPinnedResponse,
  type InstagramResolvedAddress,
} from "./instagram-secure-image-downloader";

class FixtureResolver extends NodeInstagramImageDnsResolver {
  calls: string[] = [];
  answers: InstagramResolvedAddress[] = [
    { address: "93.184.216.34", family: 4 },
  ];
  async resolve(hostname: string) {
    this.calls.push(hostname);
    return this.answers;
  }
}

class FixtureTransport extends NodeInstagramPinnedHttpsTransport {
  calls: Array<{
    url: string;
    pinnedAddress: InstagramResolvedAddress;
    headers: Readonly<Record<string, string>>;
  }> = [];
  responses: InstagramPinnedResponse[] = [];
  error: Error | null = null;

  async request(
    input: Parameters<NodeInstagramPinnedHttpsTransport["request"]>[0],
  ) {
    this.calls.push({
      url: input.url.toString(),
      pinnedAddress: input.pinnedAddress,
      headers: input.headers,
    });
    if (this.error) throw this.error;
    const response = this.responses.shift();
    if (!response) throw new Error("Missing fixture response");
    return response;
  }
}

describe("B3A secure Instagram image downloader", () => {
  let root: string;
  let store: InstagramImageTemporaryStore;
  let resolver: FixtureResolver;
  let transport: FixtureTransport;
  let downloader: InstagramSecureImageDownloader;
  let png: Buffer;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "instagram-b3a-downloader-"));
    store = new InstagramImageTemporaryStore(join(root, "owned"));
    resolver = new FixtureResolver();
    transport = new FixtureTransport();
    downloader = new InstagramSecureImageDownloader(resolver, transport, store);
    png = await sharp({
      create: {
        width: 2,
        height: 3,
        channels: 3,
        background: { r: 12, g: 34, b: 56 },
      },
    })
      .png()
      .toBuffer();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("accepts a pinned allowlisted HTTPS image and returns deterministic verified metadata", async () => {
    transport.responses.push(response(200, "image/png", [png]));
    const result = await downloader.download({
      locator: "https://scontent.cdninstagram.com/path/image.png?opaque=value",
      isolationScope: "brand-a",
      now: () => new Date("2026-09-11T10:00:00.000Z"),
    });

    expect(result).toMatchObject({
      mediaType: "image/png",
      byteLength: png.length,
      width: 2,
      height: 3,
      sha256: createHash("sha256").update(png).digest("hex"),
      acquiredAt: "2026-09-11T10:00:00.000Z",
    });
    expect(transport.calls[0].pinnedAddress).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
    expect(transport.calls[0].headers).not.toHaveProperty("Authorization");
    expect(JSON.stringify(transport.calls[0].headers)).not.toContain("token");
    await store.remove(result.temporaryPath);
    await expect(access(result.temporaryPath)).rejects.toThrow();
  });

  it.each([
    "http://scontent.cdninstagram.com/image.png",
    "ftp://scontent.cdninstagram.com/image.png",
    "https://user:pass@scontent.cdninstagram.com/image.png",
    "https://scontent.cdninstagram.com:8443/image.png",
    "https://cdninstagram.com.attacker.example/image.png",
    "https://127.0.0.1/image.png",
  ])("rejects an unsafe URL before DNS or transport: %s", async (locator) => {
    await expect(
      downloader.download({ locator, isolationScope: "brand-a" }),
    ).rejects.toMatchObject({ code: "UNSAFE_URL" });
    expect(resolver.calls).toHaveLength(0);
    expect(transport.calls).toHaveLength(0);
  });

  it.each([
    ["0.0.0.0", 4],
    ["10.0.0.1", 4],
    ["100.64.0.1", 4],
    ["127.0.0.1", 4],
    ["169.254.1.1", 4],
    ["192.0.2.1", 4],
    ["192.168.1.1", 4],
    ["198.18.0.1", 4],
    ["198.51.100.1", 4],
    ["203.0.113.1", 4],
    ["224.0.0.1", 4],
    ["240.0.0.1", 4],
    ["::", 6],
    ["::1", 6],
    ["fc00::1", 6],
    ["fe80::1", 6],
    ["2001:db8::1", 6],
    ["ff00::1", 6],
    ["::ffff:10.0.0.1", 6],
  ])("rejects non-public DNS answer %s", async (address, family) => {
    resolver.answers = [{ address: String(address), family: family as 4 | 6 }];
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/image.png",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DNS" });
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects mixed public/private DNS answers instead of selecting the public one", async () => {
    resolver.answers = [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ];
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/image.png",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DNS" });
  });

  it("revalidates every redirect and rejects hostname and DNS escape", async () => {
    transport.responses.push(redirect("https://attacker.example/image.png"));
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/start",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "REDIRECT_REJECTED" });

    transport.responses.push(redirect("https://other.fbcdn.net/image.png"));
    resolver.answers = [{ address: "93.184.216.34", family: 4 }];
    const originalResolve = resolver.resolve.bind(resolver);
    resolver.resolve = async (host) => {
      if (host === "other.fbcdn.net") {
        return [{ address: "169.254.169.254", family: 4 }];
      }
      return originalResolve(host);
    };
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/start",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DNS" });
  });

  it("rejects a redirect loop at the bounded redirect limit", async () => {
    for (let index = 0; index < 4; index += 1) {
      transport.responses.push(redirect("/loop"));
    }
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/loop",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "REDIRECT_LIMIT" });
    expect(transport.calls).toHaveLength(4);
  });

  it("propagates a bounded transport timeout without creating an artifact", async () => {
    transport.error = new InstagramImageAcquisitionError("TIMEOUT");
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/image.png",
        isolationScope: "brand-a",
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(await ownedFiles(store)).toHaveLength(0);
  });

  it("aborts an in-flight stream on cancellation and removes the partial artifact", async () => {
    const controller = new AbortController();
    transport.responses.push({
      statusCode: 200,
      headers: { "content-type": "image/png" },
      dispose: () => undefined,
      body: (async function* () {
        yield png.subarray(0, 8);
        controller.abort();
        throw new Error("fixture stream cancelled");
      })(),
    });
    await expect(
      downloader.download({
        locator: "https://scontent.cdninstagram.com/image.png",
        isolationScope: "brand-a",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(await ownedFiles(store)).toHaveLength(0);
  });

  it("rejects oversized declared and dishonest streamed responses and cleans temporary files", async () => {
    transport.responses.push({
      ...response(200, "image/png", [png]),
      headers: {
        "content-type": "image/png",
        "content-length": String(INSTAGRAM_IMAGE_MAX_BYTES + 1),
      },
    });
    await expect(validDownload(downloader)).rejects.toMatchObject({
      code: "OVERSIZED_IMAGE",
    });

    transport.responses.push(
      response(200, "image/png", [
        Buffer.alloc(INSTAGRAM_IMAGE_MAX_BYTES),
        Buffer.from([1]),
      ]),
    );
    await expect(validDownload(downloader)).rejects.toMatchObject({
      code: "OVERSIZED_IMAGE",
    });
    expect(await ownedFiles(store)).toHaveLength(0);
  });

  it.each([
    ["image/jpeg", () => png],
    ["text/html", () => Buffer.from("<html>not an image</html>")],
    ["image/svg+xml", () => Buffer.from("<svg></svg>")],
    ["image/png", () => Buffer.from("malformed")],
    ["application/octet-stream", () => png],
  ])(
    "rejects MIME/signature/malformed/unsupported content: %s",
    async (type, body) => {
      transport.responses.push(response(200, type, [body()]));
      await expect(validDownload(downloader)).rejects.toBeInstanceOf(
        InstagramImageAcquisitionError,
      );
      expect(await ownedFiles(store)).toHaveLength(0);
    },
  );

  it("rejects executable/polyglot-shaped trailing data", async () => {
    transport.responses.push(
      response(200, "image/png", [
        png,
        Buffer.from("<html><script>x</script>"),
      ]),
    );
    await expect(validDownload(downloader)).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    expect(await ownedFiles(store)).toHaveLength(0);
  });

  it("rejects excessive dimensions and decoded-pixel counts", async () => {
    const tooWide = await sharp({
      create: {
        width: 8_193,
        height: 1,
        channels: 3,
        background: "black",
      },
    })
      .png()
      .toBuffer();
    transport.responses.push(response(200, "image/png", [tooWide]));
    await expect(validDownload(downloader)).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });

    const tooManyPixels = await sharp({
      create: {
        width: 6_000,
        height: 4_200,
        channels: 3,
        background: "black",
      },
    })
      .png()
      .toBuffer();
    transport.responses.push(response(200, "image/png", [tooManyPixels]));
    await expect(validDownload(downloader)).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    expect(await ownedFiles(store)).toHaveLength(0);
  });

  it("cleans stale owned files at the boundary while preserving fresh and unrelated files", async () => {
    const stale = await store.create("brand-a");
    await stale.handle.close();
    const fresh = await store.create("brand-a");
    await fresh.handle.close();
    const now = Date.now();
    await utimes(
      stale.path,
      new Date(now - INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS),
      new Date(now - INSTAGRAM_IMAGE_STALE_TEMP_MAX_AGE_MS),
    );
    const unrelated = join(store.getRootForDiagnostics(), "unrelated.txt");
    await writeFile(unrelated, "untouched");

    expect(await store.cleanupStale(now)).toBe(1);
    await expect(access(stale.path)).rejects.toThrow();
    await expect(access(fresh.path)).resolves.toBeUndefined();
    await expect(access(unrelated)).resolves.toBeUndefined();
  });

  it("rejects path escape and removes a symlink without following it", async () => {
    await expect(store.remove(join(root, "outside.img"))).rejects.toMatchObject(
      {
        code: "TEMPORARY_STORAGE_FAILURE",
      },
    );
    const target = join(root, "target-directory");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(target));
    const preserved = join(target, "preserve.txt");
    await writeFile(preserved, "preserve");
    const link = await store.create("brand-a");
    await link.handle.close();
    await rm(link.path);
    await symlink(target, link.path, "junction");
    expect(await store.cleanupStale(Date.now())).toBe(1);
    await expect(access(preserved)).resolves.toBeUndefined();
    await expect(access(link.path)).rejects.toThrow();
  });
});

function response(
  statusCode: number,
  contentType: string,
  chunks: Buffer[],
): InstagramPinnedResponse {
  return {
    statusCode,
    headers: { "content-type": contentType },
    dispose: () => undefined,
    body: (async function* () {
      for (const chunk of chunks) yield chunk;
    })(),
  };
}

function redirect(location: string): InstagramPinnedResponse {
  return {
    statusCode: 302,
    headers: { location },
    dispose: () => undefined,
    body: (async function* () {})(),
  };
}

function validDownload(downloader: InstagramSecureImageDownloader) {
  return downloader.download({
    locator: "https://scontent.cdninstagram.com/image.png",
    isolationScope: "brand-a",
  });
}

async function ownedFiles(
  store: InstagramImageTemporaryStore,
): Promise<string[]> {
  try {
    const scopes = await readdir(store.getRootForDiagnostics());
    const nested = await Promise.all(
      scopes
        .filter((entry) => entry.startsWith("scope-"))
        .map((entry) => readdir(join(store.getRootForDiagnostics(), entry))),
    );
    return nested.flat();
  } catch {
    return [];
  }
}

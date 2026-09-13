import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import type { IncomingHttpHeaders } from "node:http";
import { isIP } from "node:net";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import ipaddr from "ipaddr.js";

import {
  NodeInstagramImageDnsResolver,
  NodeInstagramPinnedHttpsTransport,
  type InstagramPinnedResponse,
  type InstagramResolvedAddress,
} from "../instagram-secure-image-downloader";
import { InstagramVideoTemporaryStore } from "./instagram-video-temporary-store";
import {
  INSTAGRAM_VIDEO_CDN_SUFFIX_ALLOWLIST,
  INSTAGRAM_VIDEO_CONNECT_TIMEOUT_MS,
  INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES,
  INSTAGRAM_VIDEO_MAX_REDIRECTS,
  INSTAGRAM_VIDEO_READ_TIMEOUT_MS,
  INSTAGRAM_VIDEO_TOTAL_TIMEOUT_MS,
  type InstagramTemporaryVideoArtifact,
  InstagramVideoError,
} from "./instagram-video.types";

@Injectable()
export class InstagramSecureVideoDownloader {
  constructor(
    private readonly resolver: NodeInstagramImageDnsResolver,
    private readonly transport: NodeInstagramPinnedHttpsTransport,
    private readonly store: InstagramVideoTemporaryStore,
  ) {}

  async download(input: {
    locator: string;
    isolationScope: string;
    now?: () => Date;
    signal?: AbortSignal;
  }): Promise<InstagramTemporaryVideoArtifact> {
    const startedAt = Date.now();
    let current = parseAndValidateVideoUrl(input.locator);
    for (let redirects = 0; ; redirects += 1) {
      if (redirects > INSTAGRAM_VIDEO_MAX_REDIRECTS)
        throw new InstagramVideoError("REDIRECT_LIMIT");
      const addresses = await withinDeadline(
        this.resolver.resolve(current.hostname),
        startedAt,
        input.signal,
      );
      if (!addresses.length || addresses.some((row) => !isPublicAddress(row)))
        throw new InstagramVideoError("UNSAFE_DNS");
      const pinnedAddress = [...addresses].sort((a, b) =>
        `${a.family}:${a.address}`.localeCompare(`${b.family}:${b.address}`),
      )[0]!;
      const response = await withinDeadline(
        this.transport.request({
          url: current,
          pinnedAddress,
          connectTimeoutMs: INSTAGRAM_VIDEO_CONNECT_TIMEOUT_MS,
          readTimeoutMs: INSTAGRAM_VIDEO_READ_TIMEOUT_MS,
          headers: {
            Accept: "video/mp4",
            "User-Agent": "CreatorShop-Instagram-Video-Acquisition/1.0",
          },
          ...(input.signal ? { signal: input.signal } : {}),
        }),
        startedAt,
        input.signal,
      );
      if (isRedirect(response.statusCode)) {
        response.dispose();
        if (redirects === INSTAGRAM_VIDEO_MAX_REDIRECTS)
          throw new InstagramVideoError("REDIRECT_LIMIT");
        const location = singleHeader(response.headers.location);
        if (!location) throw new InstagramVideoError("REDIRECT_REJECTED");
        try {
          current = parseAndValidateVideoUrl(
            new URL(location, current).toString(),
          );
        } catch {
          throw new InstagramVideoError("REDIRECT_REJECTED");
        }
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.dispose();
        throw new InstagramVideoError("HTTP_FAILURE");
      }
      return this.persist(
        response,
        input.isolationScope,
        input.now ?? (() => new Date()),
        startedAt,
        input.signal,
      );
    }
  }

  private async persist(
    response: InstagramPinnedResponse,
    isolationScope: string,
    now: () => Date,
    startedAt: number,
    signal?: AbortSignal,
  ): Promise<InstagramTemporaryVideoArtifact> {
    let declared: number | null;
    try {
      declared = parseContentLength(response.headers);
      if (declared !== null && declared > INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES)
        throw new InstagramVideoError("OVERSIZED_VIDEO");
      assertVideoMediaType(response.headers);
    } catch (error) {
      response.dispose();
      throw error;
    }
    const created = await this.store.createVideo(isolationScope);
    const hash = createHash("sha256");
    let length = 0;
    let closed = false;
    try {
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          length += chunk.length;
          if (length > INSTAGRAM_VIDEO_MAX_DOWNLOAD_BYTES) {
            callback(new InstagramVideoError("OVERSIZED_VIDEO"));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      const controller = new AbortController();
      const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;
      const remaining = remainingMilliseconds(startedAt);
      const timer = setTimeout(() => controller.abort(), remaining);
      try {
        await pipeline(
          Readable.from(response.body),
          limiter,
          created.handle.createWriteStream(),
          { signal: combined },
        );
      } catch (error) {
        if (combined.aborted) throw new InstagramVideoError("TIMEOUT");
        throw error;
      } finally {
        clearTimeout(timer);
      }
      closed = true;
      if (!length || (declared !== null && declared !== length))
        throw new InstagramVideoError("INVALID_VIDEO");
      await assertMp4Signature(created.path);
      return {
        temporaryPath: created.path,
        mediaType: "video/mp4",
        byteLength: length,
        sha256: hash.digest("hex"),
        acquiredAt: now().toISOString(),
      };
    } catch (error) {
      if (!closed) await created.handle.close().catch(() => undefined);
      await this.store.remove(created.path).catch(() => undefined);
      if (error instanceof InstagramVideoError) throw error;
      throw new InstagramVideoError("INVALID_VIDEO");
    }
  }
}

export function parseAndValidateVideoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InstagramVideoError("UNSAFE_URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(hostname) !== 0 ||
    !INSTAGRAM_VIDEO_CDN_SUFFIX_ALLOWLIST.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  )
    throw new InstagramVideoError("UNSAFE_URL");
  url.hostname = hostname;
  url.hash = "";
  return url;
}

function isPublicAddress(address: InstagramResolvedAddress) {
  try {
    let parsed = ipaddr.parse(address.address);
    if (
      parsed.kind() === "ipv6" &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    )
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function singleHeader(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function parseContentLength(headers: IncomingHttpHeaders) {
  const raw = singleHeader(headers["content-length"]);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) throw new InstagramVideoError("INVALID_VIDEO");
  const value = Number(raw);
  if (!Number.isSafeInteger(value))
    throw new InstagramVideoError("OVERSIZED_VIDEO");
  return value;
}

function assertVideoMediaType(headers: IncomingHttpHeaders) {
  const raw = singleHeader(headers["content-type"])
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (raw !== "video/mp4" && raw !== "application/octet-stream")
    throw new InstagramVideoError("UNSUPPORTED_VIDEO_TYPE");
}

async function assertMp4Signature(path: string) {
  const handle = await open(path, "r");
  try {
    const bytes = Buffer.alloc(12);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead < 12 || bytes.subarray(4, 8).toString("ascii") !== "ftyp")
      throw new InstagramVideoError("UNSUPPORTED_VIDEO_TYPE");
    const whole = await readFile(path);
    if (whole.length < 12) throw new InstagramVideoError("INVALID_VIDEO");
  } finally {
    await handle.close();
  }
}

function remainingMilliseconds(startedAt: number) {
  const remaining = INSTAGRAM_VIDEO_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
  if (remaining <= 0) throw new InstagramVideoError("TIMEOUT");
  return remaining;
}

async function withinDeadline<T>(
  promise: Promise<T>,
  startedAt: number,
  signal?: AbortSignal,
) {
  if (signal?.aborted) throw new InstagramVideoError("TIMEOUT");
  const remaining = remainingMilliseconds(startedAt);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new InstagramVideoError("TIMEOUT")),
          remaining,
        );
      }),
      ...(signal
        ? [
            new Promise<never>((_resolve, reject) =>
              signal.addEventListener(
                "abort",
                () => reject(new InstagramVideoError("TIMEOUT")),
                { once: true },
              ),
            ),
          ]
        : []),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import type { LookupAddress } from "node:dns";
import type { IncomingHttpHeaders } from "node:http";
import { isIP } from "node:net";
import { pipeline } from "node:stream/promises";
import { Readable, Transform, type Writable } from "node:stream";
import ipaddr from "ipaddr.js";
import sharp from "sharp";

import {
  INSTAGRAM_IMAGE_CDN_SUFFIX_ALLOWLIST,
  INSTAGRAM_IMAGE_CONNECT_TIMEOUT_MS,
  INSTAGRAM_IMAGE_MAX_BYTES,
  INSTAGRAM_IMAGE_MAX_HEIGHT,
  INSTAGRAM_IMAGE_MAX_PIXELS,
  INSTAGRAM_IMAGE_MAX_REDIRECTS,
  INSTAGRAM_IMAGE_MAX_WIDTH,
  INSTAGRAM_IMAGE_READ_TIMEOUT_MS,
  INSTAGRAM_IMAGE_TOTAL_TIMEOUT_MS,
  InstagramImageAcquisitionError,
  type InstagramTemporaryImageArtifact,
} from "./instagram-image-acquisition.types";
import { InstagramImageTemporaryStore } from "./instagram-image-temporary-store";

export type InstagramResolvedAddress = Readonly<{
  address: string;
  family: 4 | 6;
}>;

export abstract class InstagramImageDnsResolver {
  abstract resolve(
    hostname: string,
  ): Promise<readonly InstagramResolvedAddress[]>;
}

export type InstagramPinnedResponse = Readonly<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Uint8Array>;
  dispose: () => void;
}>;

export abstract class InstagramPinnedHttpsTransport {
  abstract request(
    input: Readonly<{
      url: URL;
      pinnedAddress: InstagramResolvedAddress;
      headers: Readonly<Record<string, string>>;
      connectTimeoutMs: number;
      signal?: AbortSignal;
    }>,
  ): Promise<InstagramPinnedResponse>;
}

@Injectable()
export class NodeInstagramImageDnsResolver extends InstagramImageDnsResolver {
  async resolve(
    hostname: string,
  ): Promise<readonly InstagramResolvedAddress[]> {
    const rows = (await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    })) as LookupAddress[];
    return rows.map((row) => ({
      address: row.address,
      family: row.family as 4 | 6,
    }));
  }
}

@Injectable()
export class NodeInstagramPinnedHttpsTransport extends InstagramPinnedHttpsTransport {
  request(
    input: Readonly<{
      url: URL;
      pinnedAddress: InstagramResolvedAddress;
      headers: Readonly<Record<string, string>>;
      connectTimeoutMs: number;
      signal?: AbortSignal;
    }>,
  ): Promise<InstagramPinnedResponse> {
    return new Promise((resolveRequest, reject) => {
      const request = httpsRequest(
        input.url,
        {
          method: "GET",
          headers: input.headers,
          servername: input.url.hostname,
          lookup: (_hostname, _options, callback) =>
            callback(
              null,
              input.pinnedAddress.address,
              input.pinnedAddress.family,
            ),
        },
        (response) => {
          response.setTimeout(INSTAGRAM_IMAGE_READ_TIMEOUT_MS, () => {
            response.destroy(new InstagramImageAcquisitionError("TIMEOUT"));
          });
          resolveRequest({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: response,
            dispose: () => response.destroy(),
          });
        },
      );
      request.setTimeout(input.connectTimeoutMs, () => {
        request.destroy(new InstagramImageAcquisitionError("TIMEOUT"));
      });
      const cancel = () =>
        request.destroy(new InstagramImageAcquisitionError("TIMEOUT"));
      if (input.signal?.aborted) cancel();
      input.signal?.addEventListener("abort", cancel, { once: true });
      request.once("close", () =>
        input.signal?.removeEventListener("abort", cancel),
      );
      request.once("error", reject);
      request.end();
    });
  }
}

@Injectable()
export class InstagramSecureImageDownloader {
  constructor(
    private readonly resolver: NodeInstagramImageDnsResolver,
    private readonly transport: NodeInstagramPinnedHttpsTransport,
    private readonly temporaryStore: InstagramImageTemporaryStore,
  ) {}

  async download(input: {
    locator: string;
    isolationScope: string;
    now?: () => Date;
    signal?: AbortSignal;
  }): Promise<InstagramTemporaryImageArtifact> {
    const startedAt = Date.now();
    let current = parseAndValidateUrl(input.locator);
    for (let redirects = 0; ; redirects += 1) {
      if (redirects > INSTAGRAM_IMAGE_MAX_REDIRECTS) {
        throw new InstagramImageAcquisitionError("REDIRECT_LIMIT");
      }
      const addresses = await withinDeadline(
        this.resolver.resolve(current.hostname),
        startedAt,
        input.signal,
      );
      if (!addresses.length || addresses.some((row) => !isPublicAddress(row))) {
        throw new InstagramImageAcquisitionError("UNSAFE_DNS");
      }
      const pinnedAddress = [...addresses].sort((a, b) =>
        `${a.family}:${a.address}`.localeCompare(`${b.family}:${b.address}`),
      )[0];
      const response = await withinDeadline(
        this.transport.request({
          url: current,
          pinnedAddress,
          connectTimeoutMs: INSTAGRAM_IMAGE_CONNECT_TIMEOUT_MS,
          ...(input.signal ? { signal: input.signal } : {}),
          headers: {
            Accept: "image/jpeg,image/png,image/webp",
            "User-Agent": "CreatorShop-Instagram-Image-Acquisition/1.0",
          },
        }),
        startedAt,
        input.signal,
      );
      if (isRedirect(response.statusCode)) {
        response.dispose();
        if (redirects === INSTAGRAM_IMAGE_MAX_REDIRECTS) {
          throw new InstagramImageAcquisitionError("REDIRECT_LIMIT");
        }
        const location = singleHeader(response.headers.location);
        if (!location) {
          throw new InstagramImageAcquisitionError("REDIRECT_REJECTED");
        }
        try {
          current = parseAndValidateUrl(new URL(location, current).toString());
        } catch {
          throw new InstagramImageAcquisitionError("REDIRECT_REJECTED");
        }
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.dispose();
        throw new InstagramImageAcquisitionError("HTTP_FAILURE");
      }
      return this.persistAndValidate(
        response,
        input.isolationScope,
        input.now ?? (() => new Date()),
        startedAt,
        input.signal,
      );
    }
  }

  private async persistAndValidate(
    response: InstagramPinnedResponse,
    isolationScope: string,
    now: () => Date,
    startedAt: number,
    signal?: AbortSignal,
  ): Promise<InstagramTemporaryImageArtifact> {
    let declaredLength: number | null;
    let declaredMediaType: InstagramTemporaryImageArtifact["mediaType"];
    try {
      declaredLength = parseContentLength(response.headers["content-length"]);
      if (
        declaredLength !== null &&
        declaredLength > INSTAGRAM_IMAGE_MAX_BYTES
      ) {
        throw new InstagramImageAcquisitionError("OVERSIZED_IMAGE");
      }
      declaredMediaType = parseMediaType(response.headers["content-type"]);
    } catch (error) {
      response.dispose();
      throw error;
    }
    const created = await this.temporaryStore.create(isolationScope);
    const hash = createHash("sha256");
    let byteLength = 0;
    let closed = false;
    try {
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          byteLength += chunk.length;
          if (byteLength > INSTAGRAM_IMAGE_MAX_BYTES) {
            callback(new InstagramImageAcquisitionError("OVERSIZED_IMAGE"));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipelineWithinDeadline(
        Readable.from(response.body),
        limiter,
        created.handle.createWriteStream(),
        startedAt,
        signal,
      );
      closed = true;
      if (
        byteLength === 0 ||
        (declaredLength !== null && declaredLength !== byteLength)
      ) {
        throw new InstagramImageAcquisitionError("INVALID_IMAGE");
      }
      const signatureMediaType = await readSignatureMediaType(created.path);
      if (!signatureMediaType || signatureMediaType !== declaredMediaType) {
        throw new InstagramImageAcquisitionError("UNSUPPORTED_IMAGE_TYPE");
      }
      const boundedBytes = await readFile(created.path);
      assertCanonicalImageEnvelope(boundedBytes, declaredMediaType);
      const image = sharp(created.path, {
        failOn: "error",
        limitInputPixels: INSTAGRAM_IMAGE_MAX_PIXELS,
      });
      const metadata = await image.metadata();
      const decodedMediaType = sharpFormatToMediaType(metadata.format);
      if (
        decodedMediaType !== declaredMediaType ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > INSTAGRAM_IMAGE_MAX_WIDTH ||
        metadata.height > INSTAGRAM_IMAGE_MAX_HEIGHT ||
        metadata.width * metadata.height > INSTAGRAM_IMAGE_MAX_PIXELS
      ) {
        throw new InstagramImageAcquisitionError("INVALID_IMAGE");
      }
      await image.clone().resize(1, 1, { fit: "fill" }).raw().toBuffer();
      return {
        temporaryPath: created.path,
        mediaType: declaredMediaType,
        byteLength,
        width: metadata.width,
        height: metadata.height,
        sha256: hash.digest("hex"),
        acquiredAt: now().toISOString(),
      };
    } catch (error) {
      if (!closed) await created.handle.close().catch(() => undefined);
      await this.temporaryStore.remove(created.path).catch(() => undefined);
      if (error instanceof InstagramImageAcquisitionError) throw error;
      if ((error as Error).message?.includes("pixel limit")) {
        throw new InstagramImageAcquisitionError("INVALID_IMAGE");
      }
      throw new InstagramImageAcquisitionError("INVALID_IMAGE");
    }
  }
}

function parseAndValidateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InstagramImageAcquisitionError("UNSAFE_URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(hostname) !== 0 ||
    !INSTAGRAM_IMAGE_CDN_SUFFIX_ALLOWLIST.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    )
  ) {
    throw new InstagramImageAcquisitionError("UNSAFE_URL");
  }
  url.hostname = hostname;
  url.hash = "";
  return url;
}

function isPublicAddress(address: InstagramResolvedAddress): boolean {
  try {
    let parsed = ipaddr.parse(address.address);
    if (
      parsed.kind() === "ipv6" &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    ) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function singleHeader(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function parseContentLength(
  value: string | string[] | undefined,
): number | null {
  const raw = singleHeader(value);
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) {
    throw new InstagramImageAcquisitionError("INVALID_IMAGE");
  }
  const length = Number(raw);
  if (!Number.isSafeInteger(length)) {
    throw new InstagramImageAcquisitionError("OVERSIZED_IMAGE");
  }
  return length;
}

function parseMediaType(
  value: string | string[] | undefined,
): InstagramTemporaryImageArtifact["mediaType"] {
  const raw = singleHeader(value)?.split(";", 1)[0].trim().toLowerCase();
  if (raw === "image/jpeg" || raw === "image/png" || raw === "image/webp") {
    return raw;
  }
  throw new InstagramImageAcquisitionError("UNSUPPORTED_IMAGE_TYPE");
}

async function readSignatureMediaType(
  path: string,
): Promise<InstagramTemporaryImageArtifact["mediaType"] | null> {
  const handle = await import("node:fs/promises").then(({ open }) =>
    open(path, "r"),
  );
  try {
    const bytes = Buffer.alloc(16);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const value = bytes.subarray(0, bytesRead);
    if (
      value.length >= 3 &&
      value[0] === 0xff &&
      value[1] === 0xd8 &&
      value[2] === 0xff
    )
      return "image/jpeg";
    if (
      value.length >= 8 &&
      value
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return "image/png";
    if (
      value.length >= 12 &&
      value.subarray(0, 4).toString("ascii") === "RIFF" &&
      value.subarray(8, 12).toString("ascii") === "WEBP"
    )
      return "image/webp";
    return null;
  } finally {
    await handle.close();
  }
}

function sharpFormatToMediaType(
  format: string | undefined,
): InstagramTemporaryImageArtifact["mediaType"] | null {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return null;
}

function assertCanonicalImageEnvelope(
  bytes: Buffer,
  mediaType: InstagramTemporaryImageArtifact["mediaType"],
): void {
  const pngEnd = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  const valid =
    mediaType === "image/png"
      ? bytes.length >= pngEnd.length &&
        bytes.subarray(-pngEnd.length).equals(pngEnd)
      : mediaType === "image/jpeg"
        ? bytes.length >= 2 &&
          bytes[bytes.length - 2] === 0xff &&
          bytes[bytes.length - 1] === 0xd9
        : bytes.length >= 12 && bytes.readUInt32LE(4) + 8 === bytes.length;
  if (!valid) throw new InstagramImageAcquisitionError("INVALID_IMAGE");
}

async function withinDeadline<T>(
  promise: Promise<T>,
  startedAt: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new InstagramImageAcquisitionError("TIMEOUT");
  const remaining = INSTAGRAM_IMAGE_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
  if (remaining <= 0) throw new InstagramImageAcquisitionError("TIMEOUT");
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new InstagramImageAcquisitionError("TIMEOUT")),
          remaining,
        );
      }),
      ...(signal
        ? [
            new Promise<never>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => reject(new InstagramImageAcquisitionError("TIMEOUT")),
                { once: true },
              );
            }),
          ]
        : []),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function pipelineWithinDeadline(
  input: Readable,
  limiter: Transform,
  output: Writable,
  startedAt: number,
  signal?: AbortSignal,
): Promise<void> {
  const remaining = INSTAGRAM_IMAGE_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
  if (remaining <= 0) throw new InstagramImageAcquisitionError("TIMEOUT");
  const controller = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([controller.signal, signal])
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    await pipeline(input, limiter, output, { signal: combinedSignal });
  } catch (error) {
    if (combinedSignal.aborted) {
      throw new InstagramImageAcquisitionError("TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

import { Injectable } from "@nestjs/common";

import { instagramGraphUrl } from "../instagram-provider.config";
import type { InstagramProviderCredential } from "../instagram-intelligence-provider.types";
import {
  InstagramImageAcquisitionError,
  type InstagramContainedImageAcquisitionResult,
} from "./instagram-image-acquisition.types";
import { InstagramSecureImageDownloader } from "./instagram-secure-image-downloader";

type InstagramImageLocator = Readonly<{
  providerMediaId: string;
  locator: string;
  providerObservedAt: string | null;
}>;

export const INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES = 65_536;

export type InstagramLocatorKind = "IMAGE" | "CAROUSEL_CHILD" | "VIDEO_COVER";

@Injectable()
export class InstagramImageLocatorClient {
  async read(
    credential: InstagramProviderCredential,
    mediaId: string,
    kind: InstagramLocatorKind = "IMAGE",
  ): Promise<InstagramImageLocator> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(mediaId)) {
      throw new InstagramImageAcquisitionError("LOCATOR_UNAVAILABLE");
    }
    const url = instagramGraphUrl(mediaId);
    url.searchParams.set(
      "fields",
      kind === "VIDEO_COVER"
        ? "id,media_type,thumbnail_url,timestamp"
        : "id,media_type,media_url,timestamp",
    );
    url.searchParams.set("access_token", credential.accessToken);
    let response: Response;
    const signal = AbortSignal.timeout(10_000);
    try {
      response = await fetch(url, { signal });
    } catch {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    if (!response.ok) {
      throw new InstagramImageAcquisitionError(
        response.status === 400 || response.status === 404
          ? "LOCATOR_UNAVAILABLE"
          : "PROVIDER_FAILURE",
      );
    }
    let body: unknown;
    try {
      body = await readBoundedLocatorJson(response, signal);
    } catch {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    const row = body as Record<string, unknown>;
    const mediaType = String(row.media_type ?? "").toUpperCase();
    const supported =
      kind === "VIDEO_COVER"
        ? ["REEL", "REELS", "VIDEO"].includes(mediaType)
        : mediaType === "IMAGE";
    if (row.id !== mediaId || !supported) {
      throw new InstagramImageAcquisitionError("UNSUPPORTED_MEDIA_TYPE");
    }
    const locator = kind === "VIDEO_COVER" ? row.thumbnail_url : row.media_url;
    if (typeof locator !== "string" || !locator.trim()) {
      throw new InstagramImageAcquisitionError("LOCATOR_UNAVAILABLE");
    }
    return {
      providerMediaId: mediaId,
      locator,
      providerObservedAt:
        typeof row.timestamp === "string" &&
        Number.isFinite(Date.parse(row.timestamp))
          ? new Date(row.timestamp).toISOString()
          : null,
    };
  }
}

@Injectable()
export class InstagramContainedImageAcquisitionService {
  constructor(
    private readonly locatorClient: InstagramImageLocatorClient,
    private readonly downloader: InstagramSecureImageDownloader,
  ) {}

  async acquire(input: {
    credential: InstagramProviderCredential;
    mediaId: string;
    isolationScope: string;
    now?: () => Date;
    signal?: AbortSignal;
    locatorKind?: InstagramLocatorKind;
  }): Promise<InstagramContainedImageAcquisitionResult> {
    const located = await this.locatorClient.read(
      input.credential,
      input.mediaId,
      input.locatorKind,
    );
    const artifact = await this.downloader.download({
      locator: located.locator,
      isolationScope: input.isolationScope,
      ...(input.now ? { now: input.now } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return {
      artifact,
      providerMediaId: located.providerMediaId,
      providerObservedAt: located.providerObservedAt,
    };
  }
}

export async function readBoundedLocatorJson(
  response: Response,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared))
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    const length = Number(declared);
    if (
      !Number.isSafeInteger(length) ||
      length > INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES
    ) {
      await response.body?.cancel().catch(() => undefined);
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
  }
  if (!response.body)
    throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let abort: (() => void) | undefined;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    await reader.cancel().catch(() => undefined);
  };
  try {
    if (signal?.aborted)
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    const aborted = signal
      ? new Promise<never>((_resolve, reject) => {
          abort = () =>
            reject(new InstagramImageAcquisitionError("PROVIDER_FAILURE"));
          signal.addEventListener("abort", abort, { once: true });
        })
      : null;
    while (true) {
      const next = await (aborted
        ? Promise.race([reader.read(), aborted])
        : reader.read());
      if (next.done) break;
      total += next.value.byteLength;
      if (total > INSTAGRAM_LOCATOR_MAX_RESPONSE_BYTES) {
        await cancel();
        throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
      }
      chunks.push(next.value);
    }
  } catch (error) {
    await cancel();
    if (error instanceof InstagramImageAcquisitionError) throw error;
    throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
  } finally {
    if (signal && abort) signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  if (declared !== null && Number(declared) !== total) {
    throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
  }
  return parsed as Record<string, unknown>;
}

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

@Injectable()
export class InstagramImageLocatorClient {
  async read(
    credential: InstagramProviderCredential,
    mediaId: string,
  ): Promise<InstagramImageLocator> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(mediaId)) {
      throw new InstagramImageAcquisitionError("LOCATOR_UNAVAILABLE");
    }
    const url = instagramGraphUrl(mediaId);
    url.searchParams.set("fields", "id,media_type,media_url,timestamp");
    url.searchParams.set("access_token", credential.accessToken);
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
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
    const length = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > 65_536) {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new InstagramImageAcquisitionError("PROVIDER_FAILURE");
    }
    const row = body as Record<string, unknown>;
    if (
      row.id !== mediaId ||
      String(row.media_type ?? "").toUpperCase() !== "IMAGE"
    ) {
      throw new InstagramImageAcquisitionError("UNSUPPORTED_MEDIA_TYPE");
    }
    if (typeof row.media_url !== "string" || !row.media_url.trim()) {
      throw new InstagramImageAcquisitionError("LOCATOR_UNAVAILABLE");
    }
    return {
      providerMediaId: mediaId,
      locator: row.media_url,
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
  }): Promise<InstagramContainedImageAcquisitionResult> {
    const located = await this.locatorClient.read(
      input.credential,
      input.mediaId,
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

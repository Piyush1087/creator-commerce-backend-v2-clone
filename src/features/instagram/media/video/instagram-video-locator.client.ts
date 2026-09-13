import { Injectable } from "@nestjs/common";

import { instagramGraphUrl } from "../../instagram-provider.config";
import type { InstagramProviderCredential } from "../../instagram-intelligence-provider.types";
import { readBoundedLocatorJson } from "../instagram-contained-image-acquisition.service";
import {
  type InstagramVideoLocatorTruth,
  InstagramVideoError,
} from "./instagram-video.types";

@Injectable()
export class InstagramVideoLocatorClient {
  async read(
    credential: InstagramProviderCredential,
    mediaId: string,
  ): Promise<InstagramVideoLocatorTruth> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(mediaId)) {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason: "LOCATOR_UNAVAILABLE",
      };
    }
    const url = instagramGraphUrl(mediaId);
    url.searchParams.set("fields", "id,media_type,media_url,timestamp");
    url.searchParams.set("access_token", credential.accessToken);
    const signal = AbortSignal.timeout(10_000);
    let response: Response;
    try {
      response = await fetch(url, { signal });
    } catch {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason: "PROVIDER_FAILURE",
      };
    }
    if (!response.ok) {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason:
          response.status === 400 || response.status === 404
            ? "LOCATOR_UNAVAILABLE"
            : "PROVIDER_FAILURE",
      };
    }
    let body: Record<string, unknown>;
    try {
      body = await readBoundedLocatorJson(response, signal);
    } catch {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason: "PROVIDER_FAILURE",
      };
    }
    const mediaType = String(body.media_type ?? "").toUpperCase();
    if (
      body.id !== mediaId ||
      !["REEL", "REELS", "VIDEO"].includes(mediaType)
    ) {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason: "UNSUPPORTED_MEDIA_TYPE",
      };
    }
    if (typeof body.media_url !== "string" || !body.media_url.trim()) {
      return {
        availability: "UNAVAILABLE",
        providerMediaId: mediaId,
        reason: "LOCATOR_UNAVAILABLE",
      };
    }
    return {
      availability:
        typeof body.timestamp === "string" &&
        Number.isFinite(Date.parse(body.timestamp))
          ? "AVAILABLE"
          : "PARTIAL",
      providerMediaId: mediaId,
      mediaType: mediaType as "REEL" | "REELS" | "VIDEO",
      locator: body.media_url,
      providerObservedAt:
        typeof body.timestamp === "string" &&
        Number.isFinite(Date.parse(body.timestamp))
          ? new Date(body.timestamp).toISOString()
          : null,
    };
  }
}

export function requireAvailableVideoLocator(
  truth: InstagramVideoLocatorTruth,
) {
  if (truth.availability === "UNAVAILABLE") {
    throw new InstagramVideoError(truth.reason);
  }
  return truth;
}

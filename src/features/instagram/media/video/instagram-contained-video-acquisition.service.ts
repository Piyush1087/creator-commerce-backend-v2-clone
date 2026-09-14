import { Injectable } from "@nestjs/common";

import type { InstagramProviderCredential } from "../../instagram-intelligence-provider.types";
import { InstagramSecureVideoDownloader } from "./instagram-secure-video-downloader";
import {
  InstagramVideoLocatorClient,
  requireAvailableVideoLocator,
} from "./instagram-video-locator.client";

@Injectable()
export class InstagramContainedVideoAcquisitionService {
  constructor(
    private readonly locator: InstagramVideoLocatorClient,
    private readonly downloader: InstagramSecureVideoDownloader,
  ) {}

  async acquire(input: {
    credential: InstagramProviderCredential;
    mediaId: string;
    isolationScope: string;
    now?: () => Date;
    signal?: AbortSignal;
  }) {
    const located = requireAvailableVideoLocator(
      await this.locator.read(input.credential, input.mediaId),
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
      locatorAvailability: located.availability,
    } as const;
  }
}

import { Module } from "@nestjs/common";

import { InstagramIntelligenceProviderClient } from "./instagram-intelligence-provider.client";
import { INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT } from "./instagram-intelligence-provider.types";
import {
  InstagramContainedImageAcquisitionService,
  InstagramImageLocatorClient,
} from "./media/instagram-contained-image-acquisition.service";
import { InstagramImageTemporaryStore } from "./media/instagram-image-temporary-store";
import {
  InstagramSecureImageDownloader,
  NodeInstagramImageDnsResolver,
  NodeInstagramPinnedHttpsTransport,
} from "./media/instagram-secure-image-downloader";
import {
  FfmpegInstagramAudioExtractor,
  InstagramAudioExtractorPort,
} from "./media/video/instagram-audio-extractor";
import { InstagramContainedVideoAcquisitionService } from "./media/video/instagram-contained-video-acquisition.service";
import { InstagramSecureVideoDownloader } from "./media/video/instagram-secure-video-downloader";
import {
  FfmpegInstagramVideoDecoder,
  InstagramVideoDecoderPort,
} from "./media/video/instagram-video-decoder";
import { InstagramVideoLocatorClient } from "./media/video/instagram-video-locator.client";
import { InstagramVideoTemporaryStore } from "./media/video/instagram-video-temporary-store";

/**
 * Provider-read and contained-media capabilities for explicitly authorized
 * Intelligence consumers. Lifecycle OAuth/Graph clients are intentionally not
 * imported or re-exported from this boundary.
 */
@Module({
  providers: [
    InstagramIntelligenceProviderClient,
    InstagramImageLocatorClient,
    InstagramImageTemporaryStore,
    NodeInstagramImageDnsResolver,
    NodeInstagramPinnedHttpsTransport,
    InstagramSecureImageDownloader,
    InstagramContainedImageAcquisitionService,
    InstagramVideoLocatorClient,
    InstagramVideoTemporaryStore,
    InstagramSecureVideoDownloader,
    InstagramContainedVideoAcquisitionService,
    FfmpegInstagramVideoDecoder,
    FfmpegInstagramAudioExtractor,
    {
      provide: InstagramVideoDecoderPort,
      useExisting: FfmpegInstagramVideoDecoder,
    },
    {
      provide: InstagramAudioExtractorPort,
      useExisting: FfmpegInstagramAudioExtractor,
    },
    {
      provide: INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
      useExisting: InstagramIntelligenceProviderClient,
    },
  ],
  exports: [
    INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
    InstagramContainedImageAcquisitionService,
    InstagramImageTemporaryStore,
    InstagramContainedVideoAcquisitionService,
    InstagramVideoTemporaryStore,
    InstagramVideoDecoderPort,
    InstagramAudioExtractorPort,
  ],
})
export class InstagramIntelligenceProviderModule {}

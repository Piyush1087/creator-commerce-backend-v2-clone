import { Module } from "@nestjs/common";

import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramIntelligenceProviderClient } from "./instagram-intelligence-provider.client";
import { INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT } from "./instagram-intelligence-provider.types";
import { InstagramOAuthClient } from "./instagram-oauth.client";
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

/**
 * Stateless Instagram provider clients shared by Creator Entry and Settings.
 * Provider configuration and behavior remain owned by the existing clients.
 */
@Module({
  providers: [
    InstagramOAuthClient,
    InstagramGraphClient,
    InstagramIntelligenceProviderClient,
    InstagramImageLocatorClient,
    InstagramImageTemporaryStore,
    NodeInstagramImageDnsResolver,
    NodeInstagramPinnedHttpsTransport,
    InstagramSecureImageDownloader,
    InstagramContainedImageAcquisitionService,
    {
      provide: INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
      useExisting: InstagramIntelligenceProviderClient,
    },
  ],
  exports: [
    InstagramOAuthClient,
    InstagramGraphClient,
    INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
    InstagramContainedImageAcquisitionService,
    InstagramImageTemporaryStore,
  ],
})
export class InstagramProviderClientModule {}

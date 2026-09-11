import { Module } from "@nestjs/common";

import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramIntelligenceProviderClient } from "./instagram-intelligence-provider.client";
import { INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT } from "./instagram-intelligence-provider.types";
import { InstagramOAuthClient } from "./instagram-oauth.client";

/**
 * Stateless Instagram provider clients shared by Creator Entry and Settings.
 * Provider configuration and behavior remain owned by the existing clients.
 */
@Module({
  providers: [
    InstagramOAuthClient,
    InstagramGraphClient,
    InstagramIntelligenceProviderClient,
    {
      provide: INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
      useExisting: InstagramIntelligenceProviderClient,
    },
  ],
  exports: [
    InstagramOAuthClient,
    InstagramGraphClient,
    INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  ],
})
export class InstagramProviderClientModule {}

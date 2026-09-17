import { Module } from "@nestjs/common";

import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramOAuthClient } from "./instagram-oauth.client";

/**
 * Narrow Instagram account-lifecycle clients shared by Entry and Settings.
 * Intelligence reads and contained media acquisition belong to the separate
 * InstagramIntelligenceProviderModule capability boundary.
 */
@Module({
  providers: [InstagramOAuthClient, InstagramGraphClient],
  exports: [InstagramOAuthClient, InstagramGraphClient],
})
export class InstagramProviderClientModule {}

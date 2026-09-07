import { Module } from "@nestjs/common";

import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramOAuthClient } from "./instagram-oauth.client";

/**
 * Stateless Instagram provider clients shared by Creator Entry and Settings.
 * Provider configuration and behavior remain owned by the existing clients.
 */
@Module({
  providers: [InstagramOAuthClient, InstagramGraphClient],
  exports: [InstagramOAuthClient, InstagramGraphClient],
})
export class InstagramProviderClientModule {}

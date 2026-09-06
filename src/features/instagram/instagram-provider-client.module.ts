import { Module } from "@nestjs/common";

import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramOAuthClient } from "./instagram-oauth.client";

/**
 * Stateless Instagram provider clients shared without importing the legacy
 * creator-facing Instagram feature and its Creator Settings dependency.
 */
@Module({
  providers: [InstagramOAuthClient, InstagramGraphClient],
  exports: [InstagramOAuthClient, InstagramGraphClient],
})
export class InstagramProviderClientModule {}

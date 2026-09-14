import { Module } from "@nestjs/common";
import { CampaignOpportunityContextModule } from "../campaign-opportunities/campaign-opportunity-context.module";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { InstagramModule } from "../instagram/instagram.module";
import { InstagramSyncCoordinatorModule } from "../instagram-intelligence/sync/instagram-sync-coordinator.module";
import { InstagramSyncCoordinatorRepository } from "../instagram-intelligence/sync/instagram-sync-coordinator.repository";
import { ProviderOAuthModule } from "../provider-oauth/provider-oauth.module";
import { CreatorEntryController } from "./creator-entry.controller";
import { CreatorCampaignApplyContinuationService } from "./creator-campaign-apply-continuation.service";
import { CreatorEntryContinuationStore } from "./creator-entry-continuation.store";
import { CreatorInstagramConnectionService } from "./creator-instagram-connection.service";
import { CreatorCanonicalContextService } from "./creator-canonical-context.service";
import { CreatorInstagramContinuityService } from "./creator-instagram-continuity.service";
import { CreatorInstagramTokenRefreshScheduler } from "./creator-instagram-token-refresh.scheduler";
import { CreatorInstagramTokenRefreshService } from "./creator-instagram-token-refresh.service";
import { CreatorEntryProvisioningService } from "./creator-entry-provisioning.service";
import { CreatorEntryRegistrationService } from "./creator-entry-registration.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorPlatformAccessGuard } from "./creator-platform-access.guard";
import { CREATOR_INSTAGRAM_AUDIENCE_PROCESSING_PORT } from "./creator-instagram-audience-processing.port";

@Module({
  imports: [
    CampaignOpportunityContextModule,
    PrismaModule,
    AuthModule,
    CreatorSettingsModule,
    InstagramModule,
    InstagramSyncCoordinatorModule,
    ProviderOAuthModule,
  ],
  controllers: [CreatorEntryController],
  providers: [
    CreatorEntryProvisioningService,
    CreatorEntryRegistrationService,
    CreatorEntryStateService,
    CreatorEntryContinuationStore,
    CreatorCampaignApplyContinuationService,
    CreatorCanonicalContextService,
    CreatorInstagramConnectionService,
    CreatorInstagramContinuityService,
    CreatorInstagramTokenRefreshService,
    CreatorInstagramTokenRefreshScheduler,
    CreatorPlatformAccessGuard,
    {
      provide: CREATOR_INSTAGRAM_AUDIENCE_PROCESSING_PORT,
      useExisting: InstagramSyncCoordinatorRepository,
    },
  ],
  exports: [
    CreatorEntryStateService,
    CreatorCampaignApplyContinuationService,
    CreatorPlatformAccessGuard,
    CreatorInstagramTokenRefreshService,
  ],
})
export class CreatorEntryModule {}

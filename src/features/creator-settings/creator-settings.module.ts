import { Module } from "@nestjs/common";

import { CreatorPayoutProfileModule } from "../brand-escrow/creator-payout-profile.module";
import { InstagramProviderClientModule } from "../instagram/instagram-provider-client.module";
import { ProviderOAuthModule } from "../provider-oauth/provider-oauth.module";
import { CreatorProfileContactController } from "./creator-profile-contact.controller";
import { CreatorSettingsController } from "./creator-settings.controller";
import { CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT } from "./instagram/creator-instagram-settings-actor.port";
import { CreatorInstagramSettingsController } from "./instagram/creator-instagram-settings.controller";
import { CreatorInstagramSettingsService } from "./instagram/creator-instagram-settings.service";
import { CreatorPayoutActorGuard } from "./payouts/creator-payout-actor.guard";
import { CreatorPayoutReadinessCompatibilityAdapter } from "./payouts/creator-payout-readiness.compatibility-adapter";
import { CreatorPayoutSettingsController } from "./payouts/creator-payout-settings.controller";
import { CreatorPayoutSettingsService } from "./payouts/creator-payout-settings.service";
import {
  CREATOR_PAYOUT_READINESS_INVALIDATOR,
  CREATOR_PAYOUT_SETTINGS_REPOSITORY,
  CREATOR_WORKSPACE_ACTOR_RESOLVER,
} from "./payouts/creator-payout-settings.types";
import { PrismaCreatorPayoutSettingsRepository } from "./payouts/prisma-creator-payout-settings.repository";
import { CreatorProfileContactService } from "./services/creator-profile-contact.service";
import { CreatorSettingsAccessService } from "./services/creator-settings-access.service";
import { CreatorTeamModule } from "./team/creator-team.module";
import { CreatorWorkspaceActorService } from "./team/creator-workspace-actor.service";

@Module({
  imports: [
    CreatorPayoutProfileModule,
    CreatorTeamModule,
    InstagramProviderClientModule,
    ProviderOAuthModule,
  ],
  controllers: [
    CreatorProfileContactController,
    CreatorSettingsController,
    CreatorInstagramSettingsController,
    CreatorPayoutSettingsController,
  ],
  providers: [
    CreatorSettingsAccessService,
    CreatorProfileContactService,
    CreatorInstagramSettingsService,
    CreatorPayoutActorGuard,
    CreatorPayoutSettingsService,
    PrismaCreatorPayoutSettingsRepository,
    CreatorPayoutReadinessCompatibilityAdapter,
    {
      provide: CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT,
      useExisting: CreatorWorkspaceActorService,
    },
    {
      provide: CREATOR_WORKSPACE_ACTOR_RESOLVER,
      useExisting: CreatorWorkspaceActorService,
    },
    {
      provide: CREATOR_PAYOUT_SETTINGS_REPOSITORY,
      useExisting: PrismaCreatorPayoutSettingsRepository,
    },
    {
      provide: CREATOR_PAYOUT_READINESS_INVALIDATOR,
      useExisting: CreatorPayoutReadinessCompatibilityAdapter,
    },
  ],
  exports: [
    CreatorSettingsAccessService,
    CreatorProfileContactService,
    CreatorTeamModule,
  ],
})
export class CreatorSettingsModule {}

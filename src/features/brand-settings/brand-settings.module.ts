import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MailModule } from "../../mail/mail.module";
import { BrandTeamInvitationsController } from "./brand-team-invitations.controller";
import { BrandTeamInvitationsService } from "./services/brand-team-invitations.service";
import { BrandTeamService } from "./services/brand-team.service";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { InstagramModule } from "../instagram/instagram.module";
import { BrandSettingsController } from "./brand-settings.controller";
import { BrandIntegrationTokenExpiryScheduler } from "./schedulers/brand-integration-token-expiry.scheduler";
import { BrandSettingsAccessService } from "./services/brand-settings-access.service";
import { BrandSettingsIntegrationsService } from "./services/brand-settings-integrations.service";
import { BrandSettingsService } from "./services/brand-settings.service";
import { BrandInstagramOAuthStateService } from "./services/brand-instagram-oauth-state.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { MetaInstagramDeletionController } from "./meta-instagram-deletion.controller";
import { BrandInstagramDeletionScheduler } from "./schedulers/brand-instagram-deletion.scheduler";
import { BrandInstagramDeletionService } from "./services/brand-instagram-deletion.service";
import { MetaInstagramDeletionCallbackService } from "./services/meta-instagram-deletion-callback.service";
import { ProviderOAuthModule } from "../provider-oauth/provider-oauth.module";

@Module({
  imports: [
    BrandCentreModule,
    InstagramModule,
    AuthModule,
    MailModule,
    ProviderOAuthModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [
    BrandSettingsController,
    BrandTeamInvitationsController,
    MetaInstagramDeletionController,
  ],
  providers: [
    BrandTeamService,
    BrandTeamInvitationsService,
    BrandSettingsAccessService,
    BrandSettingsService,
    BrandSettingsIntegrationsService,
    BrandInstagramOAuthStateService,
    BrandIntegrationTokenExpiryScheduler,
    BrandInstagramDeletionScheduler,
    BrandInstagramDeletionService,
    MetaInstagramDeletionCallbackService,
  ],
  exports: [
    BrandSettingsService,
    BrandSettingsAccessService,
    BrandSettingsIntegrationsService,
  ],
})
export class BrandSettingsModule {}

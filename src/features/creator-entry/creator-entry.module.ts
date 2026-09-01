import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { InstagramModule } from "../instagram/instagram.module";
import { ProviderOAuthModule } from "../provider-oauth/provider-oauth.module";
import { CreatorEntryController } from "./creator-entry.controller";
import { CreatorInstagramConnectionService } from "./creator-instagram-connection.service";
import { CreatorEntryProvisioningService } from "./creator-entry-provisioning.service";
import { CreatorEntryRegistrationService } from "./creator-entry-registration.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorPlatformAccessGuard } from "./creator-platform-access.guard";

@Module({
  imports: [PrismaModule, AuthModule, InstagramModule, ProviderOAuthModule],
  controllers: [CreatorEntryController],
  providers: [
    CreatorEntryProvisioningService,
    CreatorEntryRegistrationService,
    CreatorEntryStateService,
    CreatorInstagramConnectionService,
    CreatorPlatformAccessGuard,
  ],
  exports: [CreatorEntryStateService, CreatorPlatformAccessGuard],
})
export class CreatorEntryModule {}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";
import { CreatorMarketplaceController } from "./creator-marketplace.controller";
import { PublicMarketplaceController } from "./public-marketplace.controller";
import { CreatorCampaignsController } from "./creator-campaigns.controller";
import { CreatorAffinityService } from "./services/creator-affinity.service";
import { CreatorEligibilityService } from "./services/creator-eligibility.service";
import { CreatorInvitationService } from "./services/creator-invitation.service";
import { CreatorMarketplaceService } from "./services/creator-marketplace.service";
import { CreatorCampaignsWorkspaceService } from "./services/creator-campaigns-workspace.service";
import { CreatorCampaignsPanicService } from "./services/creator-campaigns-panic.service";
import { CreatorCampaignsCommandService } from "./services/creator-campaigns-command.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorEntryModule],
  controllers: [
    CreatorMarketplaceController,
    PublicMarketplaceController,
    CreatorCampaignsController,
  ],
  providers: [
    CreatorMarketplaceService,
    CreatorEligibilityService,
    CreatorAffinityService,
    CreatorInvitationService,
    CreatorCampaignsWorkspaceService,
    CreatorCampaignsPanicService,
    CreatorCampaignsCommandService,
  ],
  exports: [CreatorEligibilityService, CreatorAffinityService],
})
export class CreatorMarketplaceModule {}

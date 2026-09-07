import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { CreatorCentreModule } from "../creator-centre/creator-centre.module";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";

import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";

import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";

import { PrismaModule } from "../../prisma/prisma.module";

import { CreatorCoPilotController } from "./creator-co-pilot.controller";

import { CreatorCoPilotFeedbackService } from "./services/creator-co-pilot-feedback.service";

import { CreatorCoPilotHitlService } from "./services/creator-co-pilot-hitl.service";

import { CreatorCoPilotIntentService } from "./services/creator-co-pilot-intent.service";

import { CreatorCoPilotModerationService } from "./services/creator-co-pilot-moderation.service";

import { CreatorCoPilotOrchestratorService } from "./services/creator-co-pilot-orchestrator.service";

import { CreatorCoPilotSlotSessionService } from "./services/creator-co-pilot-slot-session.service";

import { CreatorCoPilotThreadService } from "./services/creator-co-pilot-thread.service";

import { CreatorCoPilotUsageService } from "./services/creator-co-pilot-usage.service";

import { CreatorCoPilotToolsService } from "./tools/creator-centre.tools";

@Module({
  imports: [
    PrismaModule,

    AuthModule,

    CreatorSettingsModule,

    CreatorCentreModule,
    CreatorEntryModule,
  ],

  controllers: [CreatorCoPilotController],

  providers: [
    CreatorCoPilotThreadService,

    CreatorCoPilotOrchestratorService,

    CreatorCoPilotUsageService,

    CreatorCoPilotModerationService,

    CreatorCoPilotFeedbackService,

    CreatorCoPilotHitlService,

    CreatorCoPilotIntentService,

    CreatorCoPilotSlotSessionService,

    CreatorCoPilotToolsService,

    GeminiJsonClient,
  ],

  exports: [CreatorCoPilotThreadService, CreatorCoPilotOrchestratorService],
})
export class CreatorCoPilotModule {}

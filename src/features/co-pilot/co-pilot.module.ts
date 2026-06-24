import { Module } from "@nestjs/common";



import { PrismaModule } from "../../prisma/prisma.module";

import { AuthModule } from "../auth/auth.module";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandUceModule } from "../brand-uce/brand-uce.module";
import { BrandCentreUceBridgeModule } from "../brand-centre-uce-bridge/brand-centre-uce-bridge.module";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";
import { CollaborationModule } from "../collaboration/collaboration.module";

import { PricingModule } from "../pricing/pricing.module";

import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";

import { CoPilotController } from "./co-pilot.controller";

import { GeminiStreamClient } from "./integrations/gemini-stream.client";

import { CoPilotFeedbackService } from "./services/co-pilot-feedback.service";

import { CoPilotHitlService } from "./services/co-pilot-hitl.service";

import { CoPilotIntentService } from "./services/co-pilot-intent.service";

import { CoPilotModerationService } from "./services/co-pilot-moderation.service";

import { CoPilotOrchestratorService } from "./services/co-pilot-orchestrator.service";

import { CoPilotResponseGroundingService } from "./services/co-pilot-response-grounding.service";

import { CoPilotScopeRouterService } from "./services/co-pilot-scope-router.service";

import { CoPilotSlotSessionService } from "./services/co-pilot-slot-session.service";

import { CoPilotUsageService } from "./services/co-pilot-usage.service";

import {

  CoPilotInteractionLogService,

  CoPilotThreadService,

} from "./services/co-pilot-thread.service";

import { BrandCentreCoPilotToolsService } from "./tools/brand-centre.tools";
import { PlannerCoPilotToolsService } from "./tools/planner.tools";
import { CoPilotBrandCentreJobService } from "./services/co-pilot-brand-centre-job.service";

import { CollaborationCoPilotToolsService } from "./tools/collaboration.tools";

import { EscrowCoPilotToolsService } from "./tools/escrow.tools";



@Module({

  imports: [

    PrismaModule,

    AuthModule,

    BrandCentreModule,

    BrandUceModule,

    BrandCentreUceBridgeModule,

    BrandEscrowModule,

    CollaborationModule,

    PricingModule,

  ],

  controllers: [CoPilotController],

  providers: [

    CoPilotThreadService,

    CoPilotInteractionLogService,

    CoPilotSlotSessionService,

    CoPilotIntentService,

    CoPilotHitlService,

    CoPilotModerationService,

    CoPilotUsageService,

    CoPilotFeedbackService,

    CoPilotScopeRouterService,

    CoPilotResponseGroundingService,

    CoPilotOrchestratorService,

    BrandCentreCoPilotToolsService,

    PlannerCoPilotToolsService,

    CoPilotBrandCentreJobService,

    EscrowCoPilotToolsService,

    CollaborationCoPilotToolsService,

    GeminiJsonClient,

    GeminiStreamClient,

  ],

})

export class CoPilotModule {}



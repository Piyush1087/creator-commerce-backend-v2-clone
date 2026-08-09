import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";
import { MailModule } from "../../mail/mail.module";
import { InstagramModule } from "../instagram/instagram.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorOnboardingController } from "./creator-onboarding.controller";
import { CreatorOnboardingPurgeScheduler } from "./creator-onboarding-purge.scheduler";
import { CreatorOnboardingPurgeService } from "./creator-onboarding-purge.service";
import { CreatorOnboardingService } from "./creator-onboarding.service";
import { GeminiHandleEligibilityService } from "./eligibility/gemini-handle-eligibility.service";
import { CreatorAiSyncService } from "./services/creator-ai-sync.service";
import { CreatorSignupOtpService } from "./verification/creator-signup-otp.service";

@Module({
  imports: [PrismaModule, AuthModule, InstagramModule, MailModule],
  controllers: [CreatorOnboardingController],
  providers: [
    CreatorOnboardingService,
    CreatorOnboardingPurgeService,
    CreatorOnboardingPurgeScheduler,
    GeminiHandleEligibilityService,
    CreatorSignupOtpService,
    CreatorAiSyncService,
    GeminiJsonClient,
  ],
  exports: [CreatorOnboardingService, CreatorAiSyncService],
})
export class CreatorOnboardingModule {}

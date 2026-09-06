import { Module } from "@nestjs/common";

import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandSettingsConsumerModule } from "../brand-settings/brand-settings-consumer.module";
import { BrandCampaignConsumerModule } from "../brand-uce/consumer/brand-campaign-consumer.module";
import { BrandWorkspaceReadinessModule } from "../brand-workspace-readiness/brand-workspace-readiness.module";
import { CollaborationConsumerModule } from "../collaboration/collaboration-consumer.module";
import { IntelligenceConsumerModule } from "../intelligence-consumer/intelligence-consumer.module";
import { BrandHomeAggregationService } from "./brand-home-aggregation.service";
import { BrandHomeClassifierService } from "./brand-home-classifier.service";
import { BrandHomeClock } from "./brand-home.clock";
import { BrandHomeController } from "./brand-home.controller";
import { BrandHomeDuplicateSuppressor } from "./brand-home-duplicate-suppressor.service";
import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";

@Module({
  imports: [
    BrandCentreModule,
    BrandSettingsConsumerModule,
    BrandCampaignConsumerModule,
    BrandWorkspaceReadinessModule,
    CollaborationConsumerModule,
    IntelligenceConsumerModule,
  ],
  controllers: [BrandHomeController],
  providers: [
    BrandHomeAggregationService,
    BrandHomeClassifierService,
    BrandHomeClock,
    BrandHomeDuplicateSuppressor,
    BrandHomePrioritizer,
  ],
  exports: [BrandHomeAggregationService],
})
export class BrandHomeModule {}

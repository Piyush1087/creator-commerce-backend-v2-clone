import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCanonicalStateModule } from "../brand-canonical-state/brand-canonical-state.module";
import { BrandIntelligenceModule } from "../brand-intelligence/brand-intelligence.module";
import { GeminiJsonClient } from "../brand-onboarding/integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "../brand-onboarding/integrations/parallel/parallel-extract.client";
import { BrandCentreAuthService } from "./brand-centre-auth.service";
import { BrandCentreController } from "./brand-centre.controller";
import { BrandConsumerController } from "./consumer/brand-consumer.controller";
import { BrandConsumerService } from "./consumer/brand-consumer.service";
import { ProcessorRuntimeProjectionService } from "./consumer/processor-runtime-projection.service";
import { BrandCentreBudgetService } from "./services/brand-centre-budget.service";
import { BrandCentreColdStartService } from "./services/brand-centre-cold-start.service";
import { BrandCentreDnaService } from "./services/brand-centre-dna.service";
import { BrandCentreIntelligenceService } from "./services/brand-centre-intelligence.service";
import { BrandCentreJobDispatcherService } from "./services/brand-centre-job-dispatcher.service";
import { BrandCentrePlannerService } from "./services/brand-centre-planner.service";
import { BrandCentreRoutingService } from "./services/brand-centre-routing.service";
import { BrandCentreScanService } from "./services/brand-centre-scan.service";
import { BrandCentreSessionEvictionService } from "./services/brand-centre-session-eviction.service";
import { DeepScanWorker } from "./workers/deep-scan.worker";
import { IntelligenceRefreshWorker } from "./workers/intelligence-refresh.worker";
import { PlannerAggregateWorker } from "./workers/planner-aggregate.worker";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCanonicalStateModule,
    BrandIntelligenceModule,
  ],
  controllers: [BrandCentreController, BrandConsumerController],
  providers: [
    BrandConsumerService,
    ProcessorRuntimeProjectionService,
    BrandCentreAuthService,
    BrandCentreRoutingService,
    BrandCentreScanService,
    BrandCentreColdStartService,
    BrandCentreBudgetService,
    BrandCentreDnaService,
    BrandCentreIntelligenceService,
    BrandCentrePlannerService,
    BrandCentreSessionEvictionService,
    BrandCentreJobDispatcherService,
    GeminiJsonClient,
    ParallelExtractClient,
    DeepScanWorker,
    IntelligenceRefreshWorker,
    PlannerAggregateWorker,
  ],
  exports: [
    BrandCentreAuthService,
    BrandCentreColdStartService,
    BrandCentreScanService,
    BrandCentreDnaService,
    BrandCentreIntelligenceService,
    BrandCentrePlannerService,
  ],
})
export class BrandCentreModule {}

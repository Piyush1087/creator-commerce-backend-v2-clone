import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { MailModule } from "../../mail/mail.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { S3Module } from "../../shared/s3/s3.module";
import { BrandOnboardingPurgeScheduler } from "./brand-onboarding-purge.scheduler";
import { BrandOnboardingPurgeService } from "./brand-onboarding-purge.service";
import { BrandScanGateService } from "./brand-scan-gate.service";
import { BrandController } from "./brand.controller";
import { BrandOnboardingController } from "./brand-onboarding.controller";
import { BrandOnboardingService } from "./brand-onboarding.service";
import { BrandProfileService } from "./brand-profile.service";
import { GeminiJsonClient } from "./integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "./integrations/parallel/parallel-extract.client";
import { ParallelSearchClient } from "./integrations/parallel/parallel-search.client";
import { GeminiIndustryClassifier } from "./industry/gemini-industry-classifier.service";
import { INDUSTRY_CLASSIFIER } from "./industry/industry-classifier.token";
import { StubIndustryClassifier } from "./industry/stub-industry-classifier.service";
import { BRAND_SURFACE_SCAN_RUNNER } from "./surface-scan/brand-surface-scan.runner.token";
import { BrandScanAssetMirrorService } from "./surface-scan/brand-scan-asset-mirror.service";
import { HttpBrandSurfaceScanRunner } from "./surface-scan/http-brand-surface-scan.runner";
import { UnconfiguredBrandSurfaceScanRunner } from "./surface-scan/unconfigured-brand-surface-scan.runner";
import { BrandVerificationService } from "./verification/brand-verification.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    S3Module,
    BrandCentreModule,
  ],
  controllers: [BrandOnboardingController, BrandController],
  providers: [
    BrandScanGateService,
    BrandOnboardingPurgeService,
    BrandOnboardingPurgeScheduler,
    BrandOnboardingService,
    BrandProfileService,
    BrandVerificationService,
    ParallelExtractClient,
    ParallelSearchClient,
    GeminiJsonClient,
    BrandScanAssetMirrorService,
    HttpBrandSurfaceScanRunner,
    UnconfiguredBrandSurfaceScanRunner,
    {
      provide: BRAND_SURFACE_SCAN_RUNNER,
      useFactory: (
        config: ConfigService,
        http: HttpBrandSurfaceScanRunner,
        unconfigured: UnconfiguredBrandSurfaceScanRunner,
      ) => {
        const hasParallel = Boolean(
          config.get<string>("PARALLEL_API_KEY")?.trim(),
        );
        const hasGemini = Boolean(config.get<string>("GEMINI_API_KEY")?.trim());
        if (hasParallel && hasGemini) {
          return http;
        }
        return unconfigured;
      },
      inject: [
        ConfigService,
        HttpBrandSurfaceScanRunner,
        UnconfiguredBrandSurfaceScanRunner,
      ],
    },
    StubIndustryClassifier,
    GeminiIndustryClassifier,
    {
      provide: INDUSTRY_CLASSIFIER,
      useFactory: (
        config: ConfigService,
        gemini: GeminiIndustryClassifier,
        stub: StubIndustryClassifier,
      ) => {
        const hasParallel = Boolean(
          config.get<string>("PARALLEL_API_KEY")?.trim(),
        );
        const hasGemini = Boolean(config.get<string>("GEMINI_API_KEY")?.trim());
        if (hasParallel && hasGemini) {
          return gemini;
        }
        return stub;
      },
      inject: [ConfigService, GeminiIndustryClassifier, StubIndustryClassifier],
    },
  ],
})
export class BrandOnboardingModule {}

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaModule } from "../../prisma/prisma.module";
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
import { HttpBrandSurfaceScanRunner } from "./surface-scan/http-brand-surface-scan.runner";
import { UnconfiguredBrandSurfaceScanRunner } from "./surface-scan/unconfigured-brand-surface-scan.runner";

@Module({
  imports: [PrismaModule],
  controllers: [BrandOnboardingController, BrandController],
  providers: [
    BrandOnboardingService,
    BrandProfileService,
    ParallelExtractClient,
    ParallelSearchClient,
    GeminiJsonClient,
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

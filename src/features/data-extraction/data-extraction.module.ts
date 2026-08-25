import { Module } from "@nestjs/common";

import { ParallelSearchClient } from "../brand-onboarding/integrations/parallel/parallel-search.client";
import { TextContextBuilderService } from "../brand-onboarding/surface-scan/stage1b/text-context-builder.service";
import { ZyteHomepageStrategy } from "../brand-onboarding/surface-scan/stage1a/zyte-homepage.strategy";
import {
  ExistingOwnedWebsiteAcquisitionMechanics,
  OwnedWebsiteWave1AcquisitionService,
} from "./evidence/acquisition/owned-website-wave1-acquisition.service";
import { OwnedWebsiteWave1NormalizationService } from "./evidence/normalization/owned-website-wave1-normalization.service";
import { DataExtractionPersistenceService } from "./evidence/persistence/prisma-evidence-repositories";
import { GeminiGatekeeperProvider } from "./providers/gemini-gatekeeper.provider";
import { GeminiStructuredProvider } from "./providers/gemini-structured.provider";
import { OpenAIStructuredProvider } from "./providers/openai-structured.provider";
import { ParallelCompanyResearchProvider } from "./providers/parallel-company-research.provider";
import { StructuredEvidenceExecutionService } from "./services/structured-evidence-execution.service";

@Module({
  providers: [
    ParallelSearchClient,
    GeminiGatekeeperProvider,
    GeminiStructuredProvider,
    ParallelCompanyResearchProvider,
    OpenAIStructuredProvider,
    StructuredEvidenceExecutionService,
    DataExtractionPersistenceService,
    TextContextBuilderService,
    ZyteHomepageStrategy,
    ExistingOwnedWebsiteAcquisitionMechanics,
    OwnedWebsiteWave1AcquisitionService,
    OwnedWebsiteWave1NormalizationService,
  ],
  exports: [
    GeminiGatekeeperProvider,
    GeminiStructuredProvider,
    ParallelCompanyResearchProvider,
    OpenAIStructuredProvider,
    StructuredEvidenceExecutionService,
    OwnedWebsiteWave1AcquisitionService,
    OwnedWebsiteWave1NormalizationService,
  ],
})
export class DataExtractionModule {}

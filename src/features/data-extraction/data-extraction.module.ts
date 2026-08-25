import { Module } from "@nestjs/common";

import { ParallelSearchClient } from "../brand-onboarding/integrations/parallel/parallel-search.client";
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
  ],
  exports: [
    GeminiGatekeeperProvider,
    GeminiStructuredProvider,
    ParallelCompanyResearchProvider,
    OpenAIStructuredProvider,
    StructuredEvidenceExecutionService,
  ],
})
export class DataExtractionModule {}

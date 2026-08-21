import { Module } from "@nestjs/common";

import { ParallelSearchClient } from "../brand-onboarding/integrations/parallel/parallel-search.client";
import { GeminiGatekeeperProvider } from "./providers/gemini-gatekeeper.provider";
import { OpenAIStructuredProvider } from "./providers/openai-structured.provider";
import { ParallelCompanyResearchProvider } from "./providers/parallel-company-research.provider";

@Module({
  providers: [
    ParallelSearchClient,
    GeminiGatekeeperProvider,
    ParallelCompanyResearchProvider,
    OpenAIStructuredProvider,
  ],
  exports: [
    GeminiGatekeeperProvider,
    ParallelCompanyResearchProvider,
    OpenAIStructuredProvider,
  ],
})
export class DataExtractionModule {}

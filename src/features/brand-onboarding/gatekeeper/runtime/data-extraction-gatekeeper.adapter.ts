import { Injectable } from "@nestjs/common";
import type { ZodType, ZodTypeDef } from "zod";

import { GeminiGatekeeperProvider } from "../../../data-extraction/providers/gemini-gatekeeper.provider";
import { OpenAIStructuredProvider } from "../../../data-extraction/providers/openai-structured.provider";
import { ParallelCompanyResearchProvider } from "../../../data-extraction/providers/parallel-company-research.provider";
import type { GatekeeperCapabilityPort } from "./gatekeeper-capability.port";

/** IE-to-DE binding only. Provider clients, credentials and retry remain in DE. */
@Injectable()
export class DataExtractionGatekeeperAdapter implements GatekeeperCapabilityPort {
  constructor(
    private readonly gemini: GeminiGatekeeperProvider,
    private readonly parallel: ParallelCompanyResearchProvider,
    private readonly openai: OpenAIStructuredProvider,
  ) {}

  primary<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    ownedUrl: string;
    instruction: string;
    outputSchema: ZodType<T, ZodTypeDef, T>;
  }) {
    return this.gemini.execute<T>(args);
  }

  publicWebResearch(
    args: Parameters<GatekeeperCapabilityPort["publicWebResearch"]>[0],
  ) {
    return this.parallel.execute(args);
  }

  openAi<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    instruction: string;
    approvedEvidenceContext: unknown;
    evidenceRefs: string[];
    outputSchema: ZodType<T, ZodTypeDef, T>;
  }) {
    return this.openai.execute<T>(args);
  }
}

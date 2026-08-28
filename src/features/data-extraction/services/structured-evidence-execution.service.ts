import { Injectable } from "@nestjs/common";
import type { ZodType } from "zod";

import {
  DataExtractionProviderError,
  type ProviderEvidenceResult,
} from "../contracts/provider-execution.contract";
import { GeminiStructuredProvider } from "../providers/gemini-structured.provider";
import { OpenAIStructuredProvider } from "../providers/openai-structured.provider";

/** Data Extraction-owned provider dispatch. Intelligence supplies a registry-
 * resolved request but never selects credentials or invokes adapters directly. */
@Injectable()
export class StructuredEvidenceExecutionService {
  constructor(
    private readonly gemini: GeminiStructuredProvider,
    private readonly openai: OpenAIStructuredProvider,
  ) {}

  async execute<T>(args: {
    providerAdapter: string | undefined;
    acquisitionRunId: string;
    capabilityId: string;
    modelId: string;
    instruction: string;
    approvedEvidenceContext: unknown;
    evidenceRefs: string[];
    outputSchema: ZodType<T>;
    timeoutMs: number;
    maxAttempts: number;
    schemaName: string;
    temperature?: number;
  }): Promise<ProviderEvidenceResult<T>> {
    const { providerAdapter, schemaName, ...common } = args;
    try {
      if (providerAdapter === "gemini") {
        return await this.gemini.execute(common);
      }
      if (providerAdapter === "openai") {
        return await this.openai.execute({ ...common, schemaName });
      }
      throw new StructuredEvidenceExecutionError(
        "MODEL_PROVIDER_NOT_CONFIGURED",
        0,
      );
    } catch (error) {
      if (error instanceof StructuredEvidenceExecutionError) throw error;
      if (error instanceof DataExtractionProviderError) {
        throw new StructuredEvidenceExecutionError(
          error.detail.code,
          error.detail.attemptCount,
        );
      }
      throw new StructuredEvidenceExecutionError("PROVIDER_ERROR", 0);
    }
  }
}

export class StructuredEvidenceExecutionError extends Error {
  constructor(
    readonly code: string,
    readonly attemptCount: number,
  ) {
    super(code);
    this.name = "StructuredEvidenceExecutionError";
  }
}

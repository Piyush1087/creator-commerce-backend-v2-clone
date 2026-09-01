import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";

import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";

export const OFFERING_FACTUAL_MODEL_PROVIDER = Symbol(
  "OFFERING_FACTUAL_MODEL_PROVIDER",
);

export interface OfferingFactualModelRequest {
  readonly processorExecutionId: string;
  readonly instruction: string;
  readonly approvedContext: unknown;
  readonly evidenceRefs: readonly string[];
  readonly outputSchema: ZodType<unknown>;
}

export interface OfferingFactualModelResult {
  readonly output: unknown;
  readonly providerAttemptCount: number;
}

export interface OfferingFactualModelProvider {
  generate(
    request: OfferingFactualModelRequest,
  ): Promise<OfferingFactualModelResult>;
}

export class OfferingFactualProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "OfferingFactualProviderError";
  }
}

@Injectable()
export class StructuredOfferingFactualModelProvider implements OfferingFactualModelProvider {
  constructor(
    @Inject(StructuredEvidenceExecutionService)
    private readonly structuredExecution: StructuredEvidenceExecutionService,
    private readonly config: ConfigService,
  ) {}

  async generate(
    request: OfferingFactualModelRequest,
  ): Promise<OfferingFactualModelResult> {
    try {
      const result = await this.structuredExecution.execute({
        providerAdapter: this.config.get<string>(
          "PRODUCT_INTELLIGENCE_MODEL_PROVIDER",
          this.config.get<string>(
            "BRAND_INTELLIGENCE_MODEL_PROVIDER",
            "gemini",
          ),
        ),
        acquisitionRunId: request.processorExecutionId,
        capabilityId: "offering_factual_synthesis",
        modelId: this.config.get<string>(
          "OFFERING_FACTUAL_MODEL_ID",
          "gemini-2.5-flash",
        ),
        instruction: request.instruction,
        approvedEvidenceContext: request.approvedContext,
        evidenceRefs: [...request.evidenceRefs],
        outputSchema: request.outputSchema,
        timeoutMs: this.config.get<number>(
          "OFFERING_FACTUAL_MODEL_TIMEOUT_MS",
          60_000,
        ),
        maxAttempts: 1,
        schemaName: "offering_factual_synthesis_1_0",
        temperature: 0,
      });
      return {
        output: result.payload,
        providerAttemptCount: result.telemetry.attemptCount,
      };
    } catch (error) {
      if (!(error instanceof StructuredEvidenceExecutionError)) {
        throw new OfferingFactualProviderError("PROVIDER_ERROR", true);
      }
      const retryable = new Set([
        "RATE_LIMITED",
        "PROVIDER_UNAVAILABLE",
        "REQUEST_TIMEOUT",
        "NETWORK_ERROR",
        "PROVIDER_ERROR",
      ]).has(error.code);
      throw new OfferingFactualProviderError(error.code, retryable);
    }
  }
}

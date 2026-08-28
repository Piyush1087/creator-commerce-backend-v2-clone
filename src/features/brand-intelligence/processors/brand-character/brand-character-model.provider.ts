import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";

import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";

export const BRAND_CHARACTER_MODEL_PROVIDER = Symbol(
  "BRAND_CHARACTER_MODEL_PROVIDER",
);

export interface BrandCharacterModelRequest {
  readonly processorExecutionId: string;
  readonly instruction: string;
  readonly approvedContext: unknown;
  readonly evidenceRefs: readonly string[];
  readonly outputSchema: ZodType<unknown>;
}

export interface BrandCharacterModelResult {
  readonly output: unknown;
  readonly providerAttemptCount: number;
}

export interface BrandCharacterModelProvider {
  generate(
    request: BrandCharacterModelRequest,
  ): Promise<BrandCharacterModelResult>;
}

export class BrandCharacterProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "BrandCharacterProviderError";
  }
}

@Injectable()
export class StructuredBrandCharacterModelProvider implements BrandCharacterModelProvider {
  constructor(
    @Inject(StructuredEvidenceExecutionService)
    private readonly structuredExecution: StructuredEvidenceExecutionService,
    private readonly config: ConfigService,
  ) {}

  async generate(
    request: BrandCharacterModelRequest,
  ): Promise<BrandCharacterModelResult> {
    try {
      const result = await this.structuredExecution.execute({
        providerAdapter: this.config.get<string>(
          "BRAND_INTELLIGENCE_MODEL_PROVIDER",
          "gemini",
        ),
        acquisitionRunId: request.processorExecutionId,
        capabilityId: "brand_character",
        modelId: this.config.get<string>(
          "BRAND_CHARACTER_MODEL_ID",
          "gemini-2.5-flash",
        ),
        instruction: request.instruction,
        approvedEvidenceContext: request.approvedContext,
        evidenceRefs: [...request.evidenceRefs],
        outputSchema: request.outputSchema,
        timeoutMs: this.config.get<number>(
          "BRAND_CHARACTER_MODEL_TIMEOUT_MS",
          60_000,
        ),
        // W1.0D is the processor retry owner. Provider-internal retry is one call.
        maxAttempts: 1,
        schemaName: "brand_character_1_0",
        temperature: 0,
      });
      return {
        output: result.payload,
        providerAttemptCount: result.telemetry.attemptCount,
      };
    } catch (error) {
      if (!(error instanceof StructuredEvidenceExecutionError)) {
        throw new BrandCharacterProviderError("PROVIDER_ERROR", true);
      }
      const retryable = new Set([
        "RATE_LIMITED",
        "PROVIDER_UNAVAILABLE",
        "REQUEST_TIMEOUT",
        "NETWORK_ERROR",
        "PROVIDER_ERROR",
      ]).has(error.code);
      throw new BrandCharacterProviderError(error.code, retryable);
    }
  }
}

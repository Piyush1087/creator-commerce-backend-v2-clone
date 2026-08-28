import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";

import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";

export const VISUAL_STYLE_MODEL_PROVIDER = Symbol(
  "VISUAL_STYLE_MODEL_PROVIDER",
);

export interface VisualStyleModelRequest {
  readonly processorExecutionId: string;
  readonly instruction: string;
  readonly approvedContext: unknown;
  readonly evidenceRefs: readonly string[];
  readonly outputSchema: ZodType<unknown>;
}

export interface VisualStyleModelResult {
  readonly output: unknown;
  readonly providerAttemptCount: number;
}

export interface VisualStyleModelProvider {
  generate(request: VisualStyleModelRequest): Promise<VisualStyleModelResult>;
}

export class VisualStyleProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "VisualStyleProviderError";
  }
}

@Injectable()
export class StructuredVisualStyleModelProvider implements VisualStyleModelProvider {
  constructor(
    @Inject(StructuredEvidenceExecutionService)
    private readonly structuredExecution: StructuredEvidenceExecutionService,
    private readonly config: ConfigService,
  ) {}

  async generate(
    request: VisualStyleModelRequest,
  ): Promise<VisualStyleModelResult> {
    try {
      const result = await this.structuredExecution.execute({
        providerAdapter: this.config.get<string>(
          "BRAND_INTELLIGENCE_MODEL_PROVIDER",
          "gemini",
        ),
        acquisitionRunId: request.processorExecutionId,
        capabilityId: "visual_style_synthesis",
        modelId: this.config.get<string>(
          "VISUAL_STYLE_MODEL_ID",
          "gemini-2.5-flash",
        ),
        instruction: request.instruction,
        approvedEvidenceContext: request.approvedContext,
        evidenceRefs: [...request.evidenceRefs],
        outputSchema: request.outputSchema,
        timeoutMs: this.config.get<number>(
          "VISUAL_STYLE_MODEL_TIMEOUT_MS",
          60_000,
        ),
        // W1.0D is the processor retry owner. Provider-internal retry is one call.
        maxAttempts: 1,
        schemaName: "visual_style_synthesis_1_0",
        temperature: 0,
      });
      return {
        output: result.payload,
        providerAttemptCount: result.telemetry.attemptCount,
      };
    } catch (error) {
      if (!(error instanceof StructuredEvidenceExecutionError)) {
        throw new VisualStyleProviderError("PROVIDER_ERROR", true);
      }
      const retryable = new Set([
        "RATE_LIMITED",
        "PROVIDER_UNAVAILABLE",
        "REQUEST_TIMEOUT",
        "NETWORK_ERROR",
        "PROVIDER_ERROR",
      ]).has(error.code);
      throw new VisualStyleProviderError(error.code, retryable);
    }
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";
import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";

export const SERVICEABILITY_MODEL_PROVIDER = Symbol(
  "SERVICEABILITY_MODEL_PROVIDER",
);
export interface ServiceabilityModelRequest {
  readonly processorExecutionId: string;
  readonly instruction: string;
  readonly approvedContext: unknown;
  readonly evidenceRefs: readonly string[];
  readonly outputSchema: ZodType<unknown>;
}
export interface ServiceabilityModelResult {
  readonly output: unknown;
  readonly providerAttemptCount: number;
}
export interface ServiceabilityModelProvider {
  generate(
    request: ServiceabilityModelRequest,
  ): Promise<ServiceabilityModelResult>;
}
export class ServiceabilityProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ServiceabilityProviderError";
  }
}
@Injectable()
export class StructuredServiceabilityModelProvider implements ServiceabilityModelProvider {
  constructor(
    @Inject(StructuredEvidenceExecutionService)
    private readonly execution: StructuredEvidenceExecutionService,
    private readonly config: ConfigService,
  ) {}
  async generate(request: ServiceabilityModelRequest) {
    try {
      const result = await this.execution.execute({
        providerAdapter: this.config.get<string>(
          "BRAND_INTELLIGENCE_MODEL_PROVIDER",
          "gemini",
        ),
        acquisitionRunId: request.processorExecutionId,
        capabilityId: "serviceability_synthesis",
        modelId: this.config.get<string>(
          "SERVICEABILITY_MODEL_ID",
          "gemini-2.5-flash",
        ),
        instruction: request.instruction,
        approvedEvidenceContext: request.approvedContext,
        evidenceRefs: [...request.evidenceRefs],
        outputSchema: request.outputSchema,
        timeoutMs: this.config.get<number>(
          "SERVICEABILITY_MODEL_TIMEOUT_MS",
          60_000,
        ),
        maxAttempts: 1,
        schemaName: "serviceability_synthesis_1_0",
        temperature: 0,
      });
      return {
        output: result.payload,
        providerAttemptCount: result.telemetry.attemptCount,
      };
    } catch (error) {
      if (!(error instanceof StructuredEvidenceExecutionError))
        throw new ServiceabilityProviderError("PROVIDER_ERROR", true);
      const retryable = new Set([
        "RATE_LIMITED",
        "PROVIDER_UNAVAILABLE",
        "REQUEST_TIMEOUT",
        "NETWORK_ERROR",
        "PROVIDER_ERROR",
      ]).has(error.code);
      throw new ServiceabilityProviderError(error.code, retryable);
    }
  }
}

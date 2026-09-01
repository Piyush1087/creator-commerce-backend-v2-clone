import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";

import {
  StructuredEvidenceExecutionError,
  StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";

export const OFFERING_CREATOR_MODEL_PROVIDER = Symbol(
  "OFFERING_CREATOR_MODEL_PROVIDER",
);
export const OFFERING_ACTIONABILITY_MODEL_PROVIDER = Symbol(
  "OFFERING_ACTIONABILITY_MODEL_PROVIDER",
);

export interface OfferingDerivedModelRequest {
  readonly processorExecutionId: string;
  readonly processorId: string;
  readonly instruction: string;
  readonly approvedContext: unknown;
  readonly evidenceRefs: readonly string[];
  readonly outputSchema: ZodType<unknown>;
}
export interface OfferingDerivedModelProvider {
  generate(request: OfferingDerivedModelRequest): Promise<{
    readonly output: unknown;
    readonly providerAttemptCount: number;
  }>;
}
export class OfferingDerivedProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

abstract class StructuredOfferingDerivedModelProvider implements OfferingDerivedModelProvider {
  abstract readonly processorId: string;
  abstract readonly modelKey: string;
  constructor(
    @Inject(StructuredEvidenceExecutionService)
    private readonly execution: StructuredEvidenceExecutionService,
    private readonly config: ConfigService,
  ) {}

  async generate(request: OfferingDerivedModelRequest) {
    try {
      const result = await this.execution.execute({
        providerAdapter: this.config.get<string>(
          "PRODUCT_INTELLIGENCE_MODEL_PROVIDER",
          this.config.get<string>(
            "BRAND_INTELLIGENCE_MODEL_PROVIDER",
            "gemini",
          ),
        ),
        acquisitionRunId: request.processorExecutionId,
        capabilityId: this.processorId,
        modelId: this.config.get<string>(this.modelKey, "gemini-2.5-flash"),
        instruction: request.instruction,
        approvedEvidenceContext: request.approvedContext,
        evidenceRefs: [...request.evidenceRefs],
        outputSchema: request.outputSchema,
        timeoutMs: this.config.get<number>(
          "PRODUCT_INTELLIGENCE_MODEL_TIMEOUT_MS",
          60_000,
        ),
        maxAttempts: 1,
        schemaName: `${this.processorId}_1_0`,
        temperature: 0,
      });
      return {
        output: result.payload,
        providerAttemptCount: result.telemetry.attemptCount,
      };
    } catch (error) {
      if (!(error instanceof StructuredEvidenceExecutionError)) {
        throw new OfferingDerivedProviderError("PROVIDER_ERROR", true);
      }
      throw new OfferingDerivedProviderError(
        error.code,
        new Set([
          "RATE_LIMITED",
          "PROVIDER_UNAVAILABLE",
          "REQUEST_TIMEOUT",
          "NETWORK_ERROR",
          "PROVIDER_ERROR",
        ]).has(error.code),
      );
    }
  }
}

@Injectable()
export class StructuredOfferingCreatorModelProvider extends StructuredOfferingDerivedModelProvider {
  readonly processorId = "offering_creator_communication";
  readonly modelKey = "OFFERING_CREATOR_MODEL_ID";
  constructor(
    execution: StructuredEvidenceExecutionService,
    config: ConfigService,
  ) {
    super(execution, config);
  }
}

@Injectable()
export class StructuredOfferingActionabilityModelProvider extends StructuredOfferingDerivedModelProvider {
  readonly processorId = "offering_actionability_synthesis";
  readonly modelKey = "OFFERING_ACTIONABILITY_MODEL_ID";
  constructor(
    execution: StructuredEvidenceExecutionService,
    config: ConfigService,
  ) {
    super(execution, config);
  }
}

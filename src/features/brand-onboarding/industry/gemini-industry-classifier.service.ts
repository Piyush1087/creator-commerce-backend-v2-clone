import { Injectable, Logger } from "@nestjs/common";

import type { IndustryClassifyInput } from "./industry-classify.input";
import type { IndustryClassifier } from "./industry-classifier.token";
import type { IndustryClassification } from "./industry.types";
import { StubIndustryClassifier } from "./stub-industry-classifier.service";

/**
 * LEGACY: Parallel extract + Gemini industry gate.
 * Disabled for Stage 0 Gatekeeper (see GatekeeperService). Code retained for reactivation.
 *
 * Previously injected ParallelExtractClient + GeminiJsonClient and loaded
 * industry-classifier.prompt.md after Parallel homepage extract.
 */
@Injectable()
export class GeminiIndustryClassifier implements IndustryClassifier {
  private readonly logger = new Logger(GeminiIndustryClassifier.name);

  constructor(private readonly stubFallback: StubIndustryClassifier) {}

  async classify(
    input: IndustryClassifyInput,
  ): Promise<IndustryClassification> {
    // DISABLED: Parallel-backed industry path (Stage 0 uses GatekeeperService).
    this.logger.warn(
      `GeminiIndustryClassifier disabled — use GatekeeperService. Falling back to stub host=${input.hostname}`,
    );
    return this.stubFallback.classify(input);
  }
}

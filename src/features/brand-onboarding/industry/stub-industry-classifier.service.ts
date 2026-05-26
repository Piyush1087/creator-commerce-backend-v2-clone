import { Injectable } from "@nestjs/common";

import { stubClassifyIndustry } from "../discovery-industry.stub";
import type { IndustryClassifyInput } from "./industry-classify.input";
import type { IndustryClassifier } from "./industry-classifier.token";
import type { IndustryClassification } from "./industry.types";

/**
 * Deterministic classifier for local/dev or when Gemini/Parallel keys are absent.
 * `GeminiIndustryClassifier` falls back to this implementation on errors.
 */
@Injectable()
export class StubIndustryClassifier implements IndustryClassifier {
  async classify(
    input: IndustryClassifyInput,
  ): Promise<IndustryClassification> {
    return stubClassifyIndustry(input.hostname);
  }
}

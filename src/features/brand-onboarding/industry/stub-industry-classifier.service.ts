import { Injectable } from "@nestjs/common";

import { stubClassifyIndustry } from "../discovery-industry.stub";
import type { IndustryClassifier } from "./industry-classifier.token";
import type { IndustryClassification } from "./industry.types";

/**
 * Deterministic classifier until Parallel/Gemini wiring replaces this provider.
 */
@Injectable()
export class StubIndustryClassifier implements IndustryClassifier {
  async classify(hostname: string): Promise<IndustryClassification> {
    return stubClassifyIndustry(hostname);
  }
}

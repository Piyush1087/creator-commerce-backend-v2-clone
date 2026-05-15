import type { IndustryClassifyInput } from "./industry-classify.input";
import type { IndustryClassification } from "./industry.types";

export const INDUSTRY_CLASSIFIER = Symbol("INDUSTRY_CLASSIFIER");

export interface IndustryClassifier {
  classify(input: IndustryClassifyInput): Promise<IndustryClassification>;
}

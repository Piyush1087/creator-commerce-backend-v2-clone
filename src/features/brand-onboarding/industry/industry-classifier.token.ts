import type { IndustryClassification } from "./industry.types";

export const INDUSTRY_CLASSIFIER = Symbol("INDUSTRY_CLASSIFIER");

export interface IndustryClassifier {
  classify(hostname: string): Promise<IndustryClassification>;
}

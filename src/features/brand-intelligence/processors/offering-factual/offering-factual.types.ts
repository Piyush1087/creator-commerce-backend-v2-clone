import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";

export const OFFERING_FACTUAL_PROCESSOR_ID =
  "offering_factual_synthesis" as const;
export const OFFERING_FACTUAL_PROCESSOR_VERSION = "1.0" as const;
export const OFFERING_FACTUAL_OBJECT = "offering_factual_profile" as const;
export const OFFERING_FACTUAL_FAMILIES = [
  "factual_summary",
  "key_facts",
  "key_benefits",
  "proof_points",
  "usage_context",
  "customer_context",
] as const;
export const OFFERING_FACTUAL_COLLECTIONS = [
  "key_facts",
  "key_benefits",
  "proof_points",
  "usage_context",
  "customer_context",
] as const;

export type OfferingFactualFamily = (typeof OFFERING_FACTUAL_FAMILIES)[number];
export type OfferingFactualCollection =
  (typeof OFFERING_FACTUAL_COLLECTIONS)[number];

export interface OfferingFactualPersistencePayload {
  readonly kind: "OFFERING_FACTUAL_V1";
  readonly output: Readonly<Record<string, unknown>>;
  readonly prepared: PreparedProcessorDependencies;
  readonly offeringRef: string;
}

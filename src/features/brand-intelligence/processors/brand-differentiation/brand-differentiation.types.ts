import type { IntelligenceFreshness } from "@prisma/client";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { DifferentiationCurrentState } from "./brand-differentiation-state.repository";

export const DIFFERENTIATION_OBJECT = "differentiation_and_proof";
export interface DifferentiationMetadata {
  readonly authority: "OBSERVED" | "CREATOR_SHOP_DERIVED" | "SYSTEM_DERIVED";
  readonly source_class: string;
  readonly freshness: IntelligenceFreshness;
  readonly evidence_refs: readonly string[];
  readonly business_state_refs?: readonly string[];
  readonly confidence?: "HIGH" | "MEDIUM" | "LOW" | null;
}
export interface ProofMetadata extends DifferentiationMetadata {
  readonly semantic_id: string;
  readonly proof_strength:
    | "DIRECT_FIRST_PARTY_FACT"
    | "EXPLICIT_CERTIFICATION_OR_CREDENTIAL"
    | "OBSERVABLE_CAPABILITY"
    | "VERIFIED_BUSINESS_FACT";
}
export interface Differentiator {
  readonly semantic_id: string;
  readonly differentiator: string;
  readonly proof_points:
    | readonly { readonly semantic_id: string; readonly statement: string }[]
    | null;
}
/** Narrow only after frozen structural and semantic validation. */
export interface DifferentiationOutput {
  readonly differentiation_and_proof: readonly Differentiator[] | null;
  readonly output_metadata:
    | readonly {
        readonly semantic_id: string;
        readonly differentiator_metadata: DifferentiationMetadata;
        readonly proof_point_metadata: readonly ProofMetadata[] | null;
      }[]
    | null;
}
export interface DifferentiationPersistencePayload {
  readonly kind: "BRAND_DIFFERENTIATION_V1";
  readonly output: DifferentiationOutput;
  readonly prepared: PreparedProcessorDependencies;
  readonly current: readonly DifferentiationCurrentState[];
}

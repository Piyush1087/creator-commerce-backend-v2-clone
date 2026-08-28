import type { IntelligenceFreshness } from "@prisma/client";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { AudienceCurrentState } from "./audience-persona-state.repository";

export const AUDIENCE_OBJECT = "audience_personas";
export const AUDIENCE_LIST_FIELDS = [
  "key_characteristics",
  "motivations",
  "barriers_or_concerns",
  "trust_credibility_needs",
  "creator_communication_implications",
] as const;
export const AUDIENCE_CORE_DIMENSIONS = AUDIENCE_LIST_FIELDS.slice(0, 4);
export type AudienceListField = (typeof AUDIENCE_LIST_FIELDS)[number];
export interface PersonaValueItem {
  readonly semantic_id: string;
  readonly value: string;
}
export type AudiencePersona = Readonly<
  {
    semantic_id: string;
    label: string;
    summary: string;
    lifecycle: "ACTIVE" | "INACTIVE" | "SUPERSEDED";
    geography_context?: Readonly<Record<string, unknown>> | null;
    demographic_context?: Readonly<Record<string, unknown>> | null;
  } & Partial<Record<AudienceListField, readonly PersonaValueItem[] | null>>
>;
export interface AudienceMetadata {
  readonly authority: "OBSERVED" | "CREATOR_SHOP_DERIVED" | "SYSTEM_DERIVED";
  readonly source_class: string;
  readonly freshness: IntelligenceFreshness;
  readonly evidence_refs: readonly string[];
  readonly business_state_refs?: readonly string[];
  /** Concrete processor mapping of shared supersession refs: same-Brand Persona IDs. */
  readonly supersedes_ref?: readonly string[];
  readonly superseded_by_ref?: readonly string[];
  readonly supersession_reason?: string;
}
export interface AudiencePersonaMetadata {
  readonly semantic_id: string;
  readonly field_metadata: Readonly<Record<string, AudienceMetadata>>;
  readonly item_metadata: Readonly<
    Partial<
      Record<AudienceListField, Readonly<Record<string, AudienceMetadata>>>
    >
  >;
}
export interface AudienceReconciliation {
  readonly candidate_ref: string;
  readonly relationship:
    | "SAME_PERSONA"
    | "POSSIBLE_MATCH"
    | "NEW_PERSONA"
    | "MATERIAL_CONFLICT";
  readonly matched_persona_semantic_id: string | null;
  readonly origin_preview_group_ref?: string | null;
}
/** Narrow only after frozen structural and compiled semantic validation. */
export interface AudienceOutput {
  readonly audience_personas: readonly AudiencePersona[] | null;
  readonly output_metadata: readonly AudiencePersonaMetadata[] | null;
  readonly reconciliation: readonly AudienceReconciliation[];
}
export interface AudiencePersistencePayload {
  readonly kind: "AUDIENCE_PERSONA_V1";
  readonly output: AudienceOutput;
  readonly prepared: PreparedProcessorDependencies;
  readonly current: readonly AudienceCurrentState[];
}

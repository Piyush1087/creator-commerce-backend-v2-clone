import type { IntelligenceFreshness } from "@prisma/client";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { CharacterCurrentState } from "./brand-character-state.repository";

export const BRAND_CHARACTER_OBJECTS = [
  "brand_values",
  "brand_personality",
] as const;
export type BrandCharacterObject = (typeof BRAND_CHARACTER_OBJECTS)[number];
export interface CharacterItem {
  readonly semantic_id: string;
  readonly value?: string;
  readonly trait?: string;
}
export interface CharacterItemMetadata {
  readonly semantic_id: string;
  readonly authority: "OBSERVED" | "CREATOR_SHOP_DERIVED" | "SYSTEM_DERIVED";
  readonly source_class: string;
  readonly freshness: IntelligenceFreshness;
  readonly evidence_refs: readonly string[];
}
// Narrowed only after the verified frozen structural + semantic validators.
export interface BrandCharacterOutput {
  readonly brand_values: readonly CharacterItem[] | null;
  readonly brand_personality: readonly CharacterItem[] | null;
  readonly output_metadata: Readonly<
    Record<BrandCharacterObject, readonly CharacterItemMetadata[] | null>
  >;
}
export interface BrandCharacterPersistencePayload {
  readonly kind: "BRAND_CHARACTER_V1";
  readonly output: BrandCharacterOutput;
  readonly prepared: PreparedProcessorDependencies;
  /** Comparison/identity and CAS context only, never Evidence for derivation. */
  readonly current: readonly CharacterCurrentState[];
}

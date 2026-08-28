import type { IntelligenceFreshness } from "@prisma/client";
import type { PreparedProcessorDependencies } from "../../input/dependency/processor-dependency-preparation.service";
import type { VisualStyleCurrentState } from "./visual-style-state.repository";

export const VISUAL_STYLE_OBJECT = "visual_style_profile";
export const VISUAL_IMAGERY_FIELDS = [
  "photographic_tendencies",
  "subject_tendencies",
  "mood_or_treatment",
] as const;
export interface VisualStyleMetadata {
  readonly authority: "CREATOR_SHOP_DERIVED";
  readonly source_class: "OWNED_WEBSITE" | "MULTI_SOURCE";
  readonly freshness: IntelligenceFreshness;
  readonly evidence_refs: readonly string[];
  readonly business_state_refs?: readonly string[];
  readonly confidence?: "MEDIUM" | "LOW" | null;
}
export interface VisualStyleItemMetadata extends VisualStyleMetadata {
  readonly semantic_id: string;
}
export interface VisualValueItem {
  readonly semantic_id: string;
  readonly value: string;
}
export interface VisualTraitItem {
  readonly semantic_id: string;
  readonly trait: string;
}
export interface VisualStyleProfile {
  readonly summary?: string | null;
  readonly style_traits?: readonly VisualTraitItem[] | null;
  readonly imagery_style?: Partial<
    Record<
      (typeof VISUAL_IMAGERY_FIELDS)[number],
      readonly VisualValueItem[] | null
    >
  > | null;
  readonly graphic_treatment?: {
    readonly traits?: readonly VisualValueItem[] | null;
  } | null;
  /** No authorized input exists in this processor: protected current is retained outside generation. */
  readonly visual_constraints?: null;
}
export interface VisualStyleOutput {
  readonly visual_style_profile: VisualStyleProfile | null;
  readonly output_metadata: {
    readonly summary: VisualStyleMetadata | null;
    readonly style_traits: readonly VisualStyleItemMetadata[] | null;
    readonly imagery_style: Partial<
      Record<
        (typeof VISUAL_IMAGERY_FIELDS)[number],
        readonly VisualStyleItemMetadata[] | null
      >
    > | null;
    readonly graphic_treatment: {
      readonly traits?: readonly VisualStyleItemMetadata[] | null;
    } | null;
    readonly visual_constraints: null;
  };
}
export interface VisualStylePersistencePayload {
  readonly kind: "VISUAL_STYLE_V1";
  readonly output: VisualStyleOutput;
  readonly prepared: PreparedProcessorDependencies;
  readonly current: readonly VisualStyleCurrentState[];
}

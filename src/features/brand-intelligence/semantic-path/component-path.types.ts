export const COMPONENT_PATH_SCHEME_VERSION = 1 as const;

export type ComponentPathSegment =
  | Readonly<{ kind: "field"; value: string }>
  | Readonly<{ kind: "item"; semanticId: string }>;

export interface DecodedComponentPath {
  readonly version: typeof COMPONENT_PATH_SCHEME_VERSION;
  readonly segments: readonly ComponentPathSegment[];
}

export interface ComponentSemanticAddress {
  readonly brandId: string;
  /** Exact durable scope. Omitted only at preserved Brand-only compatibility boundaries. */
  readonly subjectId?: string;
  readonly objectSemanticId: string;
  readonly pathSchemeVersion: number;
  readonly componentSemanticPath: string;
}

/** Implemented by W1.0C's pinned bundle, not by the syntax codec. */
export interface ComponentPathOwnershipRegistry {
  owns(address: ComponentSemanticAddress): boolean;
}

export const COMPONENT_PATH_SCHEME_VERSION = 1 as const;

export type ComponentPathSegment =
  | Readonly<{ kind: "field"; value: string }>
  | Readonly<{ kind: "item"; semanticId: string }>;

export interface DecodedComponentPath {
  readonly version: typeof COMPONENT_PATH_SCHEME_VERSION;
  readonly segments: readonly ComponentPathSegment[];
}

export interface ComponentSemanticAddress {
  /** Durable owner discriminator. A Brand ID for Brand-owned objects and an
   * owner-scope ID for non-Brand subjects. */
  readonly ownerScopeId: string;
  /** Exact durable scope. Omitted only at preserved Brand-only compatibility boundaries. */
  readonly subjectId?: string;
  readonly objectSemanticId: string;
  readonly pathSchemeVersion: number;
  readonly componentSemanticPath: string;
}

/** Read-only compatibility for semantic addresses persisted before the
 * owner-scope-neutral contract. New typed callers cannot construct it. */
export function semanticAddressOwnerScopeId(
  address: ComponentSemanticAddress | Readonly<{ brandId: string }>,
): string {
  if ("ownerScopeId" in address && typeof address.ownerScopeId === "string") {
    return address.ownerScopeId;
  }
  const legacy = address as Readonly<{ brandId?: unknown }>;
  if (typeof legacy.brandId !== "string") {
    throw new Error("SEMANTIC_ADDRESS_OWNER_SCOPE_REQUIRED");
  }
  return legacy.brandId;
}

/** Implemented by W1.0C's pinned bundle, not by the syntax codec. */
export interface ComponentPathOwnershipRegistry {
  owns(address: ComponentSemanticAddress): boolean;
}

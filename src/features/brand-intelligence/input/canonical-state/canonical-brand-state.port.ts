export const CANONICAL_BRAND_STATE_READER = Symbol(
  "CANONICAL_BRAND_STATE_READER",
);

export const CANONICAL_BRAND_STATE_SEMANTICS = [
  "website_url",
  "brand_name",
  "brand_logo",
  "industry",
  "sub_industry",
  "country",
  "reporting_currency",
  "instagram_handle",
  "youtube_handle",
  "tiktok_handle",
] as const;

export type CanonicalBrandStateSemantic =
  (typeof CANONICAL_BRAND_STATE_SEMANTICS)[number];

export type CanonicalBrandStateSource = "BRAND_PROFILE";

export type CanonicalBrandStateAuthority =
  | "APPLICATION_CANONICAL"
  | "BRAND_CONFIRMED"
  | "PROVISIONAL"
  | "UNVERIFIED_PROVENANCE";

export type CanonicalBrandStateProvenance =
  | "PROVEN"
  | "UNATTRIBUTED_CANONICAL_FIELD"
  | "NOT_APPLICABLE";

export type CanonicalBrandStateResolution =
  | "RESOLVED"
  | "USER_SELECTED"
  | "UNKNOWN_PROVENANCE";

export interface BusinessStateReference {
  readonly entityType: "BrandProfile" | "Offering";
  readonly entityId: string;
  readonly semanticFieldPath: string;
  readonly revisionKind: "UPDATED_AT" | "SNAPSHOT_FINGERPRINT";
  readonly revisionToken: string;
  readonly observedAt: string;
  readonly canonicalSnapshotRef: string;
}

export interface CanonicalBrandStateEntry {
  readonly semantic: CanonicalBrandStateSemantic;
  /** Transient processor input. It is deliberately excluded from manifests. */
  readonly value: string | null;
  readonly source: CanonicalBrandStateSource;
  readonly authority: CanonicalBrandStateAuthority;
  readonly fallbackUsed: boolean;
  readonly conflictDetected: boolean;
  /** Transient diagnostic value. It is deliberately excluded from manifests. */
  readonly candidateValue?: string | null;
  readonly provenanceStatus?: CanonicalBrandStateProvenance;
  readonly resolutionStatus?: CanonicalBrandStateResolution;
  readonly businessStateReference: BusinessStateReference;
}

export interface CanonicalBrandStateSnapshot {
  readonly brandId: string;
  readonly lifecycleMode: "POST_PROFILE";
  readonly observedAt: string;
  readonly canonicalSnapshotRef: string;
  readonly entries: readonly CanonicalBrandStateEntry[];
  /** Optional application-owned Offering facts, never observed DE candidates. */
  readonly offeringFacts?: readonly CanonicalOfferingFact[];
}

export interface CanonicalOfferingFact {
  readonly offeringId: string;
  readonly brandId: string;
  readonly name: string;
  readonly type: string;
  readonly url: string;
  readonly categoryTag: string | null;
  readonly isActive: boolean;
  readonly businessStateReference: BusinessStateReference;
}

export interface CanonicalBrandStateReadRequest {
  readonly brandId: string;
  readonly requiredSemantics: readonly CanonicalBrandStateSemantic[];
  readonly includeOfferingFacts?: boolean;
}

export interface CanonicalBrandStateReader {
  read(
    request: CanonicalBrandStateReadRequest,
  ): Promise<CanonicalBrandStateSnapshot>;
}

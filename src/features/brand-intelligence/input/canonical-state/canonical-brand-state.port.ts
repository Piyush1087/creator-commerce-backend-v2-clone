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
  readonly entityType:
    | "BrandProfile"
    | "Offering"
    | "Location"
    | "BrandVisualState"
    | "BrandVisualAsset"
    | "BrandVisualColor"
    | "BrandVisualTypography";
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
  readonly visualState?: CanonicalVisualSnapshot;
  /** Optional application-owned refs; no Offering availability is inferred. */
  readonly serviceabilityState?: CanonicalServiceabilitySnapshot;
}

/** Approved application records only; never a legacy logo or observed candidate. */
export interface CanonicalVisualFact {
  readonly brandId: string;
  readonly itemId: string;
  readonly role:
    | "PRIMARY_LOGO"
    | "ALTERNATE_MARK"
    | "REFERENCE_IMAGE"
    | "PALETTE"
    | "TYPOGRAPHY";
  readonly authority: string;
  readonly origin: string;
  /** Transient context; excluded from persisted manifests and Intelligence values. */
  readonly value: string;
  readonly usage: string | null;
  readonly businessStateReference: BusinessStateReference;
}
export interface CanonicalVisualSnapshot {
  readonly brandId: string;
  readonly stateReference: BusinessStateReference | null;
  readonly items: readonly CanonicalVisualFact[];
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

export interface CanonicalLocationReference {
  readonly brandId: string;
  readonly locationId: string;
  readonly name: string | null;
  readonly city: string | null;
  readonly authority: string;
  readonly businessStateReference: BusinessStateReference;
}

export interface CanonicalOfferingIdentityReference {
  readonly brandId: string;
  readonly offeringId: string;
  readonly name: string;
  readonly type: string;
  readonly businessStateReference: BusinessStateReference;
}

export interface CanonicalServiceabilitySnapshot {
  readonly brandId: string;
  readonly locations: readonly CanonicalLocationReference[];
  readonly offeringIdentities: readonly CanonicalOfferingIdentityReference[];
  /** Deliberately empty until application-owned availability exists. */
  readonly offeringAvailabilityReferences: readonly BusinessStateReference[];
  /** locationIds is not promoted into authoritative relationship state. */
  readonly offeringLocationReferences: readonly BusinessStateReference[];
}

export interface CanonicalBrandStateReadRequest {
  readonly brandId: string;
  readonly requiredSemantics: readonly CanonicalBrandStateSemantic[];
  readonly includeOfferingFacts?: boolean;
  readonly includeVisualState?: boolean;
  readonly includeServiceabilityState?: boolean;
}

export interface CanonicalBrandStateReader {
  read(
    request: CanonicalBrandStateReadRequest,
  ): Promise<CanonicalBrandStateSnapshot>;
}

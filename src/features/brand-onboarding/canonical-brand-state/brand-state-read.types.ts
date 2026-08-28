export type BrandStateSemantic =
  | "website_url"
  | "brand_name"
  | "brand_logo"
  | "industry"
  | "sub_industry"
  | "country"
  | "reporting_currency"
  | "instagram_handle"
  | "youtube_handle"
  | "tiktok_handle";

export type BrandStateLifecycleMode = "PRE_PROFILE" | "POST_PROFILE";

export type BrandStateSource =
  | "BRAND_PROFILE"
  | "DISCOVERY_LEAD"
  | "GATEKEEPER_CONFIRMED"
  | "GATEKEEPER_PROVISIONAL"
  | "PRE_VERIFICATION_CANDIDATE"
  | "AUTHORIZED_BRAND_UPDATE"
  | "LEGACY_IDENTITY_COMPATIBILITY"
  | "DATABASE_DEFAULT"
  | "UNKNOWN";

export type BrandStateAuthority =
  | "APPLICATION_CANONICAL"
  | "BRAND_CONFIRMED"
  | "GATEKEEPER_CONFIRMED"
  | "PROVISIONAL"
  | "OBSERVED"
  | "UNVERIFIED_PROVENANCE"
  | "UNKNOWN";

export type BrandStateProvenanceStatus =
  | "PROVEN"
  | "UNATTRIBUTED_CANONICAL_FIELD"
  | "LEGACY_MIGRATION_POSSIBLE"
  | "NOT_APPLICABLE";

export type CurrencyResolutionStatus =
  | "RESOLVED"
  | "USER_SELECTED"
  | "DATABASE_DEFAULT_UNRESOLVED"
  | "UNKNOWN_PROVENANCE";

export type BrandStateRead<T> = {
  semantic: BrandStateSemantic;
  value: T | null;
  source: BrandStateSource;
  authority: BrandStateAuthority;
  fallback_used: boolean;
  conflict_detected: boolean;
  candidate_value?: T | null;
  provenance_status?: BrandStateProvenanceStatus;
  resolution_status?: CurrencyResolutionStatus;
};

export type CanonicalBrandStateSnapshot = {
  lifecycle_mode: BrandStateLifecycleMode;
  website_url: BrandStateRead<string>;
  brand_name: BrandStateRead<string>;
  brand_logo: BrandStateRead<string>;
  industry: BrandStateRead<string>;
  sub_industry: BrandStateRead<string>;
  country: BrandStateRead<string>;
  reporting_currency: BrandStateRead<string>;
  instagram_handle: BrandStateRead<string>;
  youtube_handle: BrandStateRead<string>;
  tiktok_handle: BrandStateRead<string>;
};

export type BrandStateCandidates = {
  brandName?: string | null;
  brandLogo?: string | null;
  confirmedIndustry?: string | null;
  provisionalSubIndustry?: string | null;
  country?: string | null;
  reportingCurrency?: string | null;
  instagramHandle?: string | null;
  youtubeHandle?: string | null;
  tiktokHandle?: string | null;
};

export type CanonicalBrandStateReadRequest = {
  leadId: string;
  lifecycleMode: BrandStateLifecycleMode;
  brandProfileId?: string;
  candidates?: BrandStateCandidates;
  correlationId?: string;
};

export const INTELLIGENCE_EVIDENCE_READER = Symbol(
  "INTELLIGENCE_EVIDENCE_READER",
);

export const NORMALIZED_EVIDENCE_CAPABILITIES = [
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
  "observed_brand_communication_language_signals",
  "derived_communication_constraint_evidence",
] as const;

export type NormalizedEvidenceCapabilityId =
  (typeof NORMALIZED_EVIDENCE_CAPABILITIES)[number];

export type EvidenceFreshness = "CURRENT" | "POSSIBLY_STALE" | "UNKNOWN";
export type EvidenceCapabilityStatus =
  | "AVAILABLE"
  | "PARTIAL"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "NOT_REQUESTED";
export type EvidenceRetryability =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "NOT_APPLICABLE";
export type EvidenceQuality =
  | "COMPLETE"
  | "PARTIAL"
  | "DEGRADED"
  | "UNAVAILABLE";
export type EvidenceCoverage =
  | "SINGLE_RESOURCE"
  | "MULTI_RESOURCE_PARTIAL"
  | "MULTI_RESOURCE_BROAD"
  | "SITE_WIDE_BOUNDED";
export type EvidenceRepresentativeness =
  | "PERSISTENT_BRAND_LEVEL"
  | "REPEATED_REPRESENTATIVE"
  | "CONTEXT_SPECIFIC"
  | "OFFERING_SPECIFIC"
  | "INCIDENTAL";
export type EvidencePolarity =
  | "AFFIRMATIVE"
  | "EXPLICIT_NEGATIVE"
  | "RESTRICTION"
  | "NEUTRAL";
export type EvidenceSourceClass =
  | "OWNED_WEBSITE"
  | "BRAND_USER_INPUT"
  | "INSTAGRAM_OWNED"
  | "CANONICAL_BUSINESS_STATE"
  | "MULTI_SOURCE"
  | "SYSTEM_DERIVATION_INPUT";
export type EvidenceResourceType =
  | "OWNED_WEB_PAGE"
  | "OWNED_WEB_FRAGMENT"
  | "USER_ACTION"
  | "AUTHENTICATED_PRIVATE_RESOURCE"
  | "CONNECTED_SOCIAL_RESOURCE"
  | "NORMALIZED_SOURCE_RECORD";

export interface EvidenceFreshnessAssessment {
  readonly state: EvidenceFreshness;
  readonly evaluatedAt: string;
  readonly basis: string;
  readonly priorCaptureRef?: string | null;
  readonly sourceRevisionRef?: string | null;
}

export interface EvidenceProvenanceSummary {
  readonly acquisitionOrNormalizationRunRef: string;
  readonly captureMethodClass:
    | "DIRECT_FETCH"
    | "RENDERED_FETCH"
    | "PROVIDER_MEDIATED_FETCH"
    | "CONNECTED_API"
    | "USER_ACTION_CAPTURE"
    | "DETERMINISTIC_DERIVATION";
  readonly normalizationContractVersion: string;
  readonly parentEvidenceRefs: readonly string[];
  readonly parentCaptureRefs: readonly string[];
  /** Operational trace only; never semantic identity and never in manifests. */
  readonly providerExecutionRef?: string | null;
}

export interface EvidenceAcquisitionQuality {
  readonly state: EvidenceQuality;
  readonly failureCategories: readonly string[];
  readonly detailCodes: readonly string[];
}

export interface EvidenceDeduplication {
  readonly itemFingerprint: string;
  readonly equivalentPriorEvidenceRef?: string | null;
  readonly repetitionCount: number;
  readonly supportingResourceRefs: readonly string[];
}

export interface NormalizedEvidenceReference {
  readonly brandId: string;
  readonly evidenceRef: string;
  readonly capabilityId: NormalizedEvidenceCapabilityId;
  readonly resourceRef: string;
  readonly resourceType: EvidenceResourceType;
  readonly captureRef: string;
  readonly captureVersion: string;
  readonly sourceClass: EvidenceSourceClass;
  readonly capturedAt: string;
  readonly freshness: EvidenceFreshnessAssessment;
  readonly representativeness: EvidenceRepresentativeness;
  readonly coverage: EvidenceCoverage;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
  readonly provenance: EvidenceProvenanceSummary;
  readonly deduplication: EvidenceDeduplication;
  readonly normalizedContentRef?: string;
  /** Bounded normalized content is transient and never enters the manifest. */
  readonly boundedNormalizedPayload?: unknown;
  readonly contentHash: string;
  readonly polarity?: EvidencePolarity;
  readonly conflictGroupRef?: string;
}

export interface NormalizedEvidenceCapabilityResult {
  /** Null only when status is NOT_REQUESTED; otherwise durable DE lineage. */
  readonly capabilityExecutionRef: string | null;
  readonly capabilityId: NormalizedEvidenceCapabilityId;
  readonly normalizationContractVersion: string;
  readonly status: EvidenceCapabilityStatus;
  readonly retryability: EvidenceRetryability;
  readonly reasonCodes: readonly string[];
  readonly coverage: EvidenceCoverage;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
  readonly evidence: readonly NormalizedEvidenceReference[];
}

export interface NormalizedEvidenceSet {
  readonly brandId: string;
  readonly capabilityResults: readonly NormalizedEvidenceCapabilityResult[];
}

export interface IntelligenceEvidenceReadRequest {
  readonly brandId: string;
  readonly processorId: string;
  readonly processorVersion: string;
  readonly capabilityIds: readonly NormalizedEvidenceCapabilityId[];
}

export interface IntelligenceEvidenceReader {
  read(
    request: IntelligenceEvidenceReadRequest,
  ): Promise<NormalizedEvidenceSet>;
}

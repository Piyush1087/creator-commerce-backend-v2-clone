import type {
  BrandId,
  CapabilityExecutionRef,
  CaptureRef,
  EvidenceRef,
  NormalizedContentRef,
  ProviderExecutionRef,
  ResourceRef,
  SemanticObservationKey,
} from "./evidence-identities";
import type {
  CapabilityAvailability,
  EvidenceAcquisitionQuality,
  EvidenceCapabilityId,
  EvidenceCoverage,
  EvidenceFreshness,
  EvidenceFreshnessIntent,
  EvidencePageRole,
  EvidencePolarity,
  EvidenceRepresentativeness,
  EvidenceResourceType,
  EvidenceRetryability,
  EvidenceSourceClass,
} from "./evidence-vocabulary";

export interface DataExtractionResourceRecord {
  readonly brandId: BrandId;
  readonly resourceRef: ResourceRef;
  readonly sourceClass: EvidenceSourceClass;
  readonly resourceType: EvidenceResourceType;
  readonly canonicalResourceKey: string;
  readonly canonicalUrl: string;
  readonly aliases: readonly string[];
  readonly pageRole?: EvidencePageRole;
  readonly createdAt: string;
}

export interface DataExtractionCaptureRecord {
  readonly brandId: BrandId;
  readonly captureRef: CaptureRef;
  readonly resourceRef: ResourceRef;
  readonly capabilityExecutionRef?: CapabilityExecutionRef;
  readonly acquisitionRequestKey: string;
  readonly startedAt: string;
  readonly capturedAt?: string;
  readonly observedAt?: string;
  readonly sourceRevisionRef?: string;
  readonly sourceContentHash?: string;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
  readonly providerExecutionRefs: readonly ProviderExecutionRef[];
}

export type DataExtractionContentArtifactKind =
  | "ACQUIRED_SOURCE_BODY"
  | "NORMALIZED_TEXT"
  | "STRUCTURED_SOURCE_FRAGMENT";

export interface DataExtractionContentArtifactRecord {
  readonly brandId: BrandId;
  readonly contentArtifactRef: NormalizedContentRef;
  readonly captureRef: CaptureRef;
  readonly artifactKind: DataExtractionContentArtifactKind;
  readonly mediaType: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly inlineContent?: string;
  readonly objectStoreRef?: string;
  readonly normalizationContractVersion?: string;
  readonly createdAt: string;
}

export interface EvidenceFreshnessSnapshot {
  readonly state: EvidenceFreshness;
  readonly basis: string;
  readonly evaluatedAt: string;
  readonly priorCaptureRef?: CaptureRef;
  readonly sourceRevisionRef?: string;
}

export interface EvidenceProvenanceRecord {
  readonly acquisitionOrNormalizationRunRef: string;
  readonly captureMethodClass:
    | "DIRECT_FETCH"
    | "RENDERED_FETCH"
    | "PROVIDER_MEDIATED_FETCH"
    | "DETERMINISTIC_DERIVATION";
  readonly normalizationContractVersion: string;
  readonly parentEvidenceRefs: readonly EvidenceRef[];
  readonly parentCaptureRefs: readonly CaptureRef[];
  readonly providerExecutionRef?: ProviderExecutionRef;
}

export interface EvidenceDeduplicationRecord {
  readonly itemFingerprint: string;
  readonly equivalentPriorEvidenceRef?: EvidenceRef;
  readonly repetitionCount: number;
  readonly supportingResourceRefs: readonly ResourceRef[];
}

export interface DataExtractionEvidenceItemRecord {
  readonly brandId: BrandId;
  readonly evidenceRef: EvidenceRef;
  readonly capabilityId: EvidenceCapabilityId;
  readonly normalizationContractVersion: string;
  readonly resourceRef: ResourceRef;
  readonly captureRef: CaptureRef;
  readonly sourceClass: EvidenceSourceClass;
  readonly resourceType: EvidenceResourceType;
  readonly pageRole?: EvidencePageRole;
  readonly capturedAt: string;
  readonly freshnessAtEmission: EvidenceFreshnessSnapshot;
  readonly representativeness: EvidenceRepresentativeness;
  readonly coverageSnapshot: EvidenceCoverage;
  readonly qualitySnapshot: EvidenceAcquisitionQuality;
  readonly provenance: EvidenceProvenanceRecord;
  readonly deduplication: EvidenceDeduplicationRecord;
  readonly normalizedContentRef?: NormalizedContentRef;
  readonly boundedNormalizedPayload?: Readonly<Record<string, unknown>>;
  readonly contentHash: string;
  readonly polarity?: EvidencePolarity;
  readonly semanticObservationKey?: SemanticObservationKey;
  readonly relationshipRefs: readonly SemanticObservationKey[];
}

export type SemanticObservationRelationType =
  | "EQUIVALENT_TO"
  | "CONFLICTS_WITH";

export interface DataExtractionSemanticObservationRecord {
  readonly brandId: BrandId;
  readonly semanticObservationKey: SemanticObservationKey;
  readonly capabilityId: EvidenceCapabilityId;
  readonly supportingEvidenceRefs: readonly EvidenceRef[];
  readonly repetitionCount: number;
  readonly equivalentObservationKeys: readonly SemanticObservationKey[];
  readonly conflictingObservationKeys: readonly SemanticObservationKey[];
  readonly createdAt: string;
}

export interface DataExtractionCapabilityExecutionRecord {
  readonly brandId: BrandId;
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  readonly capabilityId: EvidenceCapabilityId;
  readonly resourceScope: readonly ResourceRef[];
  readonly freshnessIntent: EvidenceFreshnessIntent;
  readonly normalizationContractVersion: string;
  readonly sourceRevisionRef?: string;
  readonly correlationRef?: string;
  readonly availability: CapabilityAvailability;
  readonly retryability: EvidenceRetryability;
  readonly reasonCodes: readonly string[];
  readonly coverage: EvidenceCoverage;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly createdAt: string;
  readonly completedAt?: string;
}

export interface DataExtractionFreshnessAssessment {
  readonly brandId: BrandId;
  readonly targetType: "RESOURCE" | "CAPTURE" | "EVIDENCE";
  readonly targetRef: ResourceRef | CaptureRef | EvidenceRef;
  readonly state: EvidenceFreshness;
  readonly evaluatedAt: string;
  readonly basis: string;
  readonly priorCaptureRef?: CaptureRef;
  readonly sourceRevisionRef?: string;
  readonly invalidatingRef?: string;
}

export interface DataExtractionProviderExecutionLink {
  readonly brandId: BrandId;
  readonly providerExecutionRef: ProviderExecutionRef;
  readonly captureRef?: CaptureRef;
  readonly capabilityExecutionRef?: CapabilityExecutionRef;
  readonly attemptRole: string;
}

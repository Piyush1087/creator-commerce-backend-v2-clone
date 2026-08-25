import type {
  BrandId,
  CapabilityExecutionRef,
  CaptureRef,
  EvidenceRef,
  NormalizedContentRef,
  ProviderExecutionRef,
  ResourceRef,
  SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionCaptureRecord,
  DataExtractionContentArtifactRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionFreshnessAssessment,
  DataExtractionProviderExecutionLink,
  DataExtractionResourceRecord,
  DataExtractionSemanticObservationRecord,
  SemanticObservationRelationType,
} from "../domain/evidence-records";
import type {
  CapabilityAvailability,
  EvidenceAcquisitionQuality,
  EvidenceCapabilityId,
  EvidenceCoverage,
  EvidenceFreshnessIntent,
  EvidencePageRole,
  EvidenceResourceType,
  EvidenceRetryability,
  EvidenceSourceClass,
} from "../domain/evidence-vocabulary";

export interface CreateOrGetResourceInput {
  readonly brandId: BrandId;
  readonly resourceRef: ResourceRef;
  readonly sourceClass: EvidenceSourceClass;
  readonly resourceType: EvidenceResourceType;
  readonly canonicalResourceKey: string;
  readonly canonicalUrl: string;
  readonly pageRole?: EvidencePageRole;
}

export interface CreateCaptureInput {
  readonly brandId: BrandId;
  readonly captureRef: CaptureRef;
  readonly resourceRef: ResourceRef;
  readonly capabilityExecutionRef?: CapabilityExecutionRef;
  readonly acquisitionRequestKey: string;
  readonly startedAt: string;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
}

export interface CompleteCaptureInput {
  readonly capturedAt: string;
  readonly observedAt?: string;
  readonly sourceRevisionRef?: string;
  readonly sourceContentHash?: string;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
}

export interface FailCaptureInput {
  readonly capturedAt?: string;
  readonly observedAt?: string;
  readonly sourceRevisionRef?: string;
  readonly sourceContentHash?: string;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
}

export interface CreateCapabilityExecutionInput {
  readonly brandId: BrandId;
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  readonly capabilityId: EvidenceCapabilityId;
  readonly normalizationContractVersion: string;
  readonly resourceScopeHash: string;
  readonly freshnessIntent: EvidenceFreshnessIntent;
  readonly sourceRevisionRef?: string;
  readonly requestKey: string;
  readonly coverage: EvidenceCoverage;
}

export interface CompleteCapabilityExecutionInput {
  readonly availability: CapabilityAvailability;
  readonly retryability: EvidenceRetryability;
  readonly reasonCodes: readonly string[];
  readonly coverage: EvidenceCoverage;
  readonly acquisitionQuality: EvidenceAcquisitionQuality;
  readonly completedAt: string;
}

export interface RecordFreshnessAssessmentInput extends DataExtractionFreshnessAssessment {}

export interface AttachProviderExecutionLinkInput extends DataExtractionProviderExecutionLink {}

export interface ResourceRepository {
  createOrGet(
    input: CreateOrGetResourceInput,
  ): Promise<DataExtractionResourceRecord>;
  findByRef(
    brandId: BrandId,
    resourceRef: ResourceRef,
  ): Promise<DataExtractionResourceRecord | null>;
  findByCanonicalIdentity(
    brandId: BrandId,
    sourceClass: EvidenceSourceClass,
    canonicalResourceKey: string,
  ): Promise<DataExtractionResourceRecord | null>;
  findByCanonicalKey(
    brandId: BrandId,
    canonicalResourceKey: string,
  ): Promise<DataExtractionResourceRecord | null>;
  listForBrand(
    brandId: BrandId,
  ): Promise<readonly DataExtractionResourceRecord[]>;
  insert(record: DataExtractionResourceRecord): Promise<void>;
}

export interface CaptureRepository {
  create(input: CreateCaptureInput): Promise<DataExtractionCaptureRecord>;
  findByRef(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<DataExtractionCaptureRecord | null>;
  findByAcquisitionRequestKey(
    brandId: BrandId,
    acquisitionRequestKey: string,
  ): Promise<DataExtractionCaptureRecord | null>;
  findLatestForResource(
    brandId: BrandId,
    resourceRef: ResourceRef,
  ): Promise<DataExtractionCaptureRecord | null>;
  markCompleted(
    brandId: BrandId,
    captureRef: CaptureRef,
    result: CompleteCaptureInput,
  ): Promise<DataExtractionCaptureRecord>;
  markFailed(
    brandId: BrandId,
    captureRef: CaptureRef,
    result: FailCaptureInput,
  ): Promise<DataExtractionCaptureRecord>;
  insert(record: DataExtractionCaptureRecord): Promise<void>;
}

export interface ContentArtifactRepository {
  findByRef(
    brandId: BrandId,
    contentRef: NormalizedContentRef,
  ): Promise<DataExtractionContentArtifactRecord | null>;
  findForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionContentArtifactRecord[]>;
  listForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionContentArtifactRecord[]>;
  insert(record: DataExtractionContentArtifactRecord): Promise<void>;
}

export interface EvidenceItemRepository {
  insertOrGetExact(
    record: DataExtractionEvidenceItemRecord,
  ): Promise<DataExtractionEvidenceItemRecord>;
  findByRef(
    brandId: BrandId,
    evidenceRef: EvidenceRef,
  ): Promise<DataExtractionEvidenceItemRecord | null>;
  findByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]>;
  listByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]>;
  listByCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionEvidenceItemRecord[]>;
  insert(record: DataExtractionEvidenceItemRecord): Promise<void>;
}

export interface SemanticObservationRepository {
  createOrGet(
    brandId: BrandId,
    key: SemanticObservationKey,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionSemanticObservationRecord>;
  findByKey(
    brandId: BrandId,
    key: SemanticObservationKey,
  ): Promise<DataExtractionSemanticObservationRecord | null>;
  findByCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<readonly DataExtractionSemanticObservationRecord[]>;
  attachSupport(
    brandId: BrandId,
    key: SemanticObservationKey,
    evidenceRef: EvidenceRef,
  ): Promise<DataExtractionSemanticObservationRecord>;
  listSupport(
    brandId: BrandId,
    key: SemanticObservationKey,
  ): Promise<readonly EvidenceRef[]>;
  relateEquivalent(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
  ): Promise<void>;
  relateConflict(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
  ): Promise<void>;
  relate(
    brandId: BrandId,
    sourceKey: SemanticObservationKey,
    targetKey: SemanticObservationKey,
    relationType: SemanticObservationRelationType,
  ): Promise<void>;
  insert(record: DataExtractionSemanticObservationRecord): Promise<void>;
}

export interface CapabilityExecutionRepository {
  createOrGet(
    input: CreateCapabilityExecutionInput,
  ): Promise<DataExtractionCapabilityExecutionRecord>;
  findByRef(
    brandId: BrandId,
    ref: CapabilityExecutionRef,
  ): Promise<DataExtractionCapabilityExecutionRecord | null>;
  findByRequestKey(
    brandId: BrandId,
    requestKey: string,
  ): Promise<DataExtractionCapabilityExecutionRecord | null>;
  findLatestReusable(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionCapabilityExecutionRecord | null>;
  complete(
    brandId: BrandId,
    ref: CapabilityExecutionRef,
    result: CompleteCapabilityExecutionInput,
  ): Promise<DataExtractionCapabilityExecutionRecord>;
  insert(record: DataExtractionCapabilityExecutionRecord): Promise<void>;
}

export interface CapabilityResourceRepository {
  attach(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    resourceRef: ResourceRef,
  ): Promise<void>;
  listForExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly ResourceRef[]>;
}

export interface CapabilityEvidenceRepository {
  attach(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    evidenceRef: EvidenceRef,
  ): Promise<void>;
  listEvidenceForExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly EvidenceRef[]>;
}

export interface FreshnessAssessmentRepository {
  record(input: RecordFreshnessAssessmentInput): Promise<void>;
  listForTarget(
    brandId: BrandId,
    targetType: DataExtractionFreshnessAssessment["targetType"],
    targetRef: string,
  ): Promise<readonly DataExtractionFreshnessAssessment[]>;
  latestForTarget(
    brandId: BrandId,
    targetType: DataExtractionFreshnessAssessment["targetType"],
    targetRef: string,
  ): Promise<DataExtractionFreshnessAssessment | null>;
}

export interface ProviderExecutionLinkRepository {
  attachToCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
    providerExecutionRef: ProviderExecutionRef,
    attemptRole: string,
  ): Promise<void>;
  attachToCapabilityExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
    providerExecutionRef: ProviderExecutionRef,
    attemptRole: string,
  ): Promise<void>;
  listForCapture(
    brandId: BrandId,
    captureRef: CaptureRef,
  ): Promise<readonly DataExtractionProviderExecutionLink[]>;
  listForCapabilityExecution(
    brandId: BrandId,
    capabilityExecutionRef: CapabilityExecutionRef,
  ): Promise<readonly DataExtractionProviderExecutionLink[]>;
}

// Historical semantic records are append-only. No generic update/delete APIs are exposed.

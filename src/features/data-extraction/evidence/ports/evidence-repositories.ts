import type {
  BrandId,
  CapabilityExecutionRef,
  CaptureRef,
  EvidenceRef,
  NormalizedContentRef,
  ResourceRef,
  SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionCaptureRecord,
  DataExtractionContentArtifactRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionResourceRecord,
  DataExtractionSemanticObservationRecord,
} from "../domain/evidence-records";
import type { EvidenceCapabilityId } from "../domain/evidence-vocabulary";

export interface ResourceRepository {
  findByRef(brandId: BrandId, resourceRef: ResourceRef): Promise<DataExtractionResourceRecord | null>;
  findByCanonicalKey(brandId: BrandId, canonicalResourceKey: string): Promise<DataExtractionResourceRecord | null>;
  insert(record: DataExtractionResourceRecord): Promise<void>;
}

export interface CaptureRepository {
  findByRef(brandId: BrandId, captureRef: CaptureRef): Promise<DataExtractionCaptureRecord | null>;
  findLatestForResource(brandId: BrandId, resourceRef: ResourceRef): Promise<DataExtractionCaptureRecord | null>;
  insert(record: DataExtractionCaptureRecord): Promise<void>;
}

export interface ContentArtifactRepository {
  findByRef(brandId: BrandId, contentRef: NormalizedContentRef): Promise<DataExtractionContentArtifactRecord | null>;
  findForCapture(brandId: BrandId, captureRef: CaptureRef): Promise<readonly DataExtractionContentArtifactRecord[]>;
  insert(record: DataExtractionContentArtifactRecord): Promise<void>;
}

export interface EvidenceItemRepository {
  findByRef(brandId: BrandId, evidenceRef: EvidenceRef): Promise<DataExtractionEvidenceItemRecord | null>;
  findByCapability(brandId: BrandId, capabilityId: EvidenceCapabilityId): Promise<readonly DataExtractionEvidenceItemRecord[]>;
  insert(record: DataExtractionEvidenceItemRecord): Promise<void>;
}

export interface SemanticObservationRepository {
  findByKey(brandId: BrandId, key: SemanticObservationKey): Promise<DataExtractionSemanticObservationRecord | null>;
  findByCapability(brandId: BrandId, capabilityId: EvidenceCapabilityId): Promise<readonly DataExtractionSemanticObservationRecord[]>;
  insert(record: DataExtractionSemanticObservationRecord): Promise<void>;
}

export interface CapabilityExecutionRepository {
  findByRef(
    brandId: BrandId,
    ref: CapabilityExecutionRef,
  ): Promise<DataExtractionCapabilityExecutionRecord | null>;
  findLatestReusable(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionCapabilityExecutionRecord | null>;
  insert(record: DataExtractionCapabilityExecutionRecord): Promise<void>;
}

// Historical semantic records are append-only. No generic update/delete APIs are exposed.

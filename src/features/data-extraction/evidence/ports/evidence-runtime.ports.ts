import type {
  BrandId,
  CapabilityExecutionRef,
  CaptureRef,
  EvidenceRef,
  ResourceRef,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
} from "../domain/evidence-records";
import type {
  EvidenceCapabilityId,
  EvidenceFreshnessIntent,
} from "../domain/evidence-vocabulary";

export interface DataExtractionEvidenceQueryRequestV1 {
  readonly brandId: BrandId;
  readonly capabilityIds: readonly EvidenceCapabilityId[];
  readonly consumerContext?: Readonly<{
    processorId?: string;
    processorVersion?: string;
  }>;
  readonly correlationRef?: string;
}

export interface DataExtractionCapabilityReadResultV1 {
  readonly capabilityExecution: DataExtractionCapabilityExecutionRecord;
  readonly evidence: readonly DataExtractionEvidenceItemRecord[];
}

export interface DataExtractionEvidenceQueryResultV1 {
  readonly brandId: BrandId;
  readonly capabilityResults: readonly DataExtractionCapabilityReadResultV1[];
}

/** Read-only boundary. Implementations must never crawl, recapture or refresh. */
export interface DataExtractionEvidenceQueryPortV1 {
  readExisting(
    request: DataExtractionEvidenceQueryRequestV1,
  ): Promise<DataExtractionEvidenceQueryResultV1>;
}

export interface DataExtractionCapabilityAcquisitionRequestV1 {
  readonly brandId: BrandId;
  readonly capabilityId: EvidenceCapabilityId;
  /** Optional pre-resolved scope retained for W1.0A compatibility. D resolves actual pages itself. */
  readonly resourceScope?: readonly ResourceRef[];
  readonly freshnessIntent: EvidenceFreshnessIntent;
  readonly sourceRevisionRef?: string;
  readonly normalizationContractVersion: string;
  /** Caller-owned DE acquisition idempotency key. Not a processor identity. */
  readonly requestKey: string;
  /** Canonical PUBLIC_OWNED_SITE root used to resolve durable Resources. */
  readonly ownedWebsiteRoot: string;
  readonly correlationRef?: string;
}

export interface DataExtractionCapabilityAcquisitionResultV1 {
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  /** D deliberately emits no semantic Evidence; this remains empty until E. */
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly resourceRefs?: readonly ResourceRef[];
  readonly captureRefs?: readonly CaptureRef[];
}

/** Separate acquisition/refresh command boundary. It must never be used by readExisting(). */
export interface DataExtractionCapabilityAcquisitionPortV1 {
  request(
    request: DataExtractionCapabilityAcquisitionRequestV1,
  ): Promise<DataExtractionCapabilityAcquisitionResultV1>;
}

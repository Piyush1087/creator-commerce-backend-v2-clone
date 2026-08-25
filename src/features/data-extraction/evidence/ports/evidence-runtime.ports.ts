import type {
  BrandId,
  CapabilityExecutionRef,
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
  readonly resourceScope: readonly ResourceRef[];
  readonly freshnessIntent: EvidenceFreshnessIntent;
  readonly sourceRevisionRef?: string;
  readonly normalizationContractVersion: string;
  readonly correlationRef: string;
}

export interface DataExtractionCapabilityAcquisitionResultV1 {
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  readonly evidenceRefs: readonly EvidenceRef[];
}

/** Separate acquisition/refresh command boundary; DE-W1.0A defines only the contract. */
export interface DataExtractionCapabilityAcquisitionPortV1 {
  request(
    request: DataExtractionCapabilityAcquisitionRequestV1,
  ): Promise<DataExtractionCapabilityAcquisitionResultV1>;
}

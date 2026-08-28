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

export const DATA_EXTRACTION_EVIDENCE_QUERY_PORT_V1 = Symbol(
  "DATA_EXTRACTION_EVIDENCE_QUERY_PORT_V1",
);

export interface DataExtractionEvidenceQueryRequestV1 {
  readonly brandId: BrandId;
  readonly capabilityIds: readonly EvidenceCapabilityId[];
  /** Explicit Product scope. Never inferred from processor identity. */
  readonly exactOfferingScope?: Readonly<{
    readonly canonicalOfferingRef: string;
  }>;
  readonly consumerContext?: Readonly<{
    processorId?: string;
    processorVersion?: string;
  }>;
  readonly correlationRef?: string;
}

export interface DataExtractionCompletedCapabilityReadResultV1 {
  readonly state: "COMPLETED";
  readonly capabilityExecution: DataExtractionCapabilityExecutionRecord;
  /** Populated only for an exact-Offering read spanning completed executions. */
  readonly capabilityExecutions?: readonly DataExtractionCapabilityExecutionRecord[];
  readonly evidence: readonly DataExtractionEvidenceItemRecord[];
}

export interface DataExtractionNotRequestedCapabilityReadResultV1 {
  readonly state: "NOT_REQUESTED";
  readonly capabilityId: EvidenceCapabilityId;
  readonly evidence: readonly [];
}

export type DataExtractionCapabilityReadResultV1 =
  | DataExtractionCompletedCapabilityReadResultV1
  | DataExtractionNotRequestedCapabilityReadResultV1;

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
  /**
   * Existing application-owned identity plus only the exact owned resources
   * reconciled to it. DE validates and carries this identity; it never creates it.
   */
  readonly exactOfferingScope?: Readonly<{
    readonly canonicalOfferingRef: string;
    readonly resourceUrls: readonly string[];
  }>;
  /** Bounded refresh mode: acquire only exact resources and never rediscover navigation. */
  readonly acquisitionMode?: "GENERIC" | "EXACT_RESOURCES_ONLY";
  /** When set, only the atomic request-key creator may perform network work. */
  readonly executionClaim?: "REQUIRE_CREATOR";
  readonly correlationRef?: string;
}

export interface DataExtractionExactOfferingResourceV1 {
  readonly canonicalOfferingRef: string;
  readonly resourceRef: ResourceRef;
  readonly captureRef: CaptureRef;
}

export interface DataExtractionCapabilityAcquisitionResultV1 {
  readonly capabilityExecutionRef: CapabilityExecutionRef;
  /** D deliberately emits no semantic Evidence; this remains empty until E. */
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly resourceRefs?: readonly ResourceRef[];
  readonly captureRefs?: readonly CaptureRef[];
  readonly exactOfferingResources?: readonly DataExtractionExactOfferingResourceV1[];
  readonly executionClaim?: "CREATED" | "EXISTING";
}

/** Separate acquisition/refresh command boundary. It must never be used by readExisting(). */
export interface DataExtractionCapabilityAcquisitionPortV1 {
  request(
    request: DataExtractionCapabilityAcquisitionRequestV1,
  ): Promise<DataExtractionCapabilityAcquisitionResultV1>;
}

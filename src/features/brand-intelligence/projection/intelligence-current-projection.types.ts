export type IntelligenceProjectionValueState =
  | "VALUE"
  | "EXPLICIT_NULL"
  | "INTENTIONALLY_ABSENT"
  | "NO_CURRENT"
  | "NOT_EVALUATED"
  | "NOT_OWNED";

export type IntelligenceProjectionObjectState =
  | "NO_CURRENT"
  | "PARTIAL_CURRENT"
  | "CURRENT";

export type IntelligenceProjectionReadiness = "READY" | "PARTIAL" | "NOT_READY";

export type IntelligenceProjectionFreshness = "CURRENT" | "STALE" | "UNKNOWN";

export type IntelligenceProjectionAuthority =
  | "OBSERVED"
  | "CREATOR_SHOP_DERIVED"
  | "BRAND_CONFIRMED"
  | "SUPPORT_CONTROLLED"
  | "SYSTEM_DERIVED";

export type IntelligenceProjectionProtection =
  | "UNPROTECTED"
  | "BRAND_CONFIRMED"
  | "SUPPORT_CONTROLLED";

export interface IntelligenceProjectedValue {
  readonly state: IntelligenceProjectionValueState;
  readonly value?: unknown;
}

export interface IntelligenceCandidateSummary {
  readonly status: "NONE" | "AVAILABLE" | "CONFLICT";
  readonly pendingCount: number;
  readonly currentPreserved: boolean;
  readonly summaryAvailable: boolean;
  readonly rawCandidateVisible: false;
}

export interface IntelligenceEvidenceReferenceSummary {
  readonly evidenceRef: string;
  readonly capabilityId: string;
  readonly resourceCapture: Readonly<{
    captureRef: string;
    captureVersion: string;
  }>;
  readonly sourceClass: string;
  readonly capturedAt: string;
  readonly observedFreshness: "CURRENT" | "POSSIBLY_STALE" | "UNKNOWN" | null;
}

export interface IntelligenceBusinessStateReferenceSummary {
  readonly entityType: string;
  readonly entityId: string;
  readonly semanticFieldPath: string;
  readonly revisionKind:
    | "EXPLICIT_VERSION"
    | "UPDATED_AT"
    | "SNAPSHOT_FINGERPRINT";
  readonly revisionToken: string;
  readonly canonicalSnapshotRef: string;
}

export interface CurrentIntelligenceComponentProjection {
  readonly projectionState: "CURRENT";
  readonly brandId: string;
  readonly objectSemanticId: string;
  readonly componentSemanticPath: string;
  readonly pathSchemeVersion: 1;
  readonly valueState: "VALUE" | "EXPLICIT_NULL" | "INTENTIONALLY_ABSENT";
  readonly value?: unknown;
  readonly authority: IntelligenceProjectionAuthority;
  readonly sourceClass: string;
  readonly readiness: IntelligenceProjectionReadiness;
  readonly freshness: IntelligenceProjectionFreshness;
  readonly protectionState: IntelligenceProjectionProtection;
  readonly currentContractId: string;
  readonly currentContractVersion: string;
  readonly revision: string;
  readonly generationCreatedAt: string;
  readonly staleReasonCode: string | null;
  readonly businessStateReferenceSummary: readonly IntelligenceBusinessStateReferenceSummary[];
  readonly evidenceReferenceSummary: readonly IntelligenceEvidenceReferenceSummary[];
  readonly candidateSummary: IntelligenceCandidateSummary;
}

export interface AbsentIntelligenceComponentProjection {
  readonly projectionState: "NO_CURRENT" | "NOT_OWNED";
  readonly brandId: string;
  readonly objectSemanticId: string;
  readonly componentSemanticPath: string;
  readonly pathSchemeVersion: 1;
  readonly valueState: "NO_CURRENT" | "NOT_OWNED";
}

export type IntelligenceComponentProjection =
  | CurrentIntelligenceComponentProjection
  | AbsentIntelligenceComponentProjection;

export interface IntelligenceContractProjection {
  readonly id: string;
  readonly version: string;
}

export interface CurrentIntelligenceObjectProjection {
  readonly brandId: string;
  readonly objectSemanticId: string;
  readonly objectContract: IntelligenceContractProjection | null;
  readonly objectContractVersions: readonly IntelligenceContractProjection[];
  readonly outputContract: IntelligenceContractProjection | null;
  readonly objectState: IntelligenceProjectionObjectState;
  readonly assembledValue: IntelligenceProjectedValue;
  readonly consumerReadiness: IntelligenceProjectionReadiness;
  readonly resultReadiness: IntelligenceProjectionReadiness;
  readonly freshness: IntelligenceProjectionFreshness;
  readonly authority: IntelligenceProjectionAuthority | "MIXED" | null;
  readonly sourceClass: string | "MIXED" | null;
  readonly mixedGeneration: boolean;
  readonly mixedContractVersion: boolean;
  readonly components: readonly CurrentIntelligenceComponentProjection[];
  readonly candidateSummary: IntelligenceCandidateSummary;
}

export interface ReadCurrentIntelligenceObjectRequest {
  readonly brandId: string;
  readonly objectSemanticId: string;
}

export interface ReadCurrentIntelligenceComponentRequest extends ReadCurrentIntelligenceObjectRequest {
  readonly componentSemanticPath: string;
}

export interface IntelligenceCurrentProjectionReader {
  readObject(
    request: ReadCurrentIntelligenceObjectRequest,
  ): Promise<CurrentIntelligenceObjectProjection>;
  readComponent(
    request: ReadCurrentIntelligenceComponentRequest,
  ): Promise<IntelligenceComponentProjection>;
}

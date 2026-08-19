export type EvidenceAvailability =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "UNAVAILABLE";

export type EvidenceQuality = "VALID" | "DEGRADED" | "STALE" | "INVALID";

export type ProviderConnectionState =
  | "CONNECTED"
  | "DEGRADED"
  | "AUTH_EXPIRED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "DISCONNECTED"
  | "UNAVAILABLE";

export type ProviderErrorCode =
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_FAILED"
  | "CAPABILITY_NOT_AVAILABLE"
  | "MODEL_NOT_AVAILABLE"
  | "REQUEST_TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "INVALID_PROVIDER_RESPONSE"
  | "STRUCTURED_OUTPUT_INVALID"
  | "GROUNDING_UNAVAILABLE"
  | "PROVENANCE_INCOMPLETE"
  | "EMPTY_RESULT"
  | "RETRY_EXHAUSTED";

export type EvidenceProvenanceType =
  | "OWNED_DOMAIN"
  | "PUBLIC_WEB_SEARCH"
  | "PUBLIC_WEB_RESEARCH"
  | "APPROVED_EVIDENCE_CONTEXT";

export type EvidenceProvenance = {
  type: EvidenceProvenanceType;
  sourceUrl?: string;
  title?: string;
  providerReference?: string;
  acquiredAt: string;
};

export type ProviderTelemetry = {
  acquisitionRunId: string;
  capabilityId: string;
  provider: "GOOGLE_GEMINI" | "PARALLEL_AI" | "OPENAI";
  modelId?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  attemptCount: number;
  providerStatusCode?: number;
  rateLimited: boolean;
  retryAfterMs?: number;
  usage?: unknown;
};

export type ProviderExecutionError = {
  code: ProviderErrorCode;
  provider: "GOOGLE_GEMINI" | "PARALLEL_AI" | "OPENAI";
  capabilityId: string;
  modelId?: string;
  message: string;
  retryable: boolean;
  attemptCount: number;
  providerStatusCode?: number;
  retryAfterMs?: number;
  acquisitionRunId: string;
  occurredAt: string;
};

export class DataExtractionProviderError extends Error {
  constructor(
    readonly detail: Omit<ProviderExecutionError, "occurredAt">,
  ) {
    super(detail.message);
    this.name = "DataExtractionProviderError";
  }

  toContract(): ProviderExecutionError {
    return {
      ...this.detail,
      occurredAt: new Date().toISOString(),
    };
  }
}

export type ProviderEvidenceResult<T> = {
  capabilityId: string;
  acquisitionRunId: string;
  availability: EvidenceAvailability;
  quality: EvidenceQuality;
  qualityFlags: string[];
  payload: T;
  provenance: EvidenceProvenance[];
  connectionState: ProviderConnectionState;
  telemetry: ProviderTelemetry;
};

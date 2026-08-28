export const BRAND_PROCESSOR_OBJECT_OWNERSHIP = {
  brand_communication: ["communication_profile"],
  brand_meaning: ["brand_description", "positioning", "value_proposition"],
  brand_character: ["brand_values", "brand_personality"],
  audience_persona_synthesis: ["audience_personas"],
  brand_differentiation: ["differentiation_and_proof"],
  visual_style_synthesis: ["visual_style_profile"],
  serviceability_synthesis: ["serviceability_profile"],
} as const;

export type BrandProcessorId = keyof typeof BRAND_PROCESSOR_OBJECT_OWNERSHIP;

export const BRAND_PROCESSOR_IDS = Object.freeze(
  Object.keys(BRAND_PROCESSOR_OBJECT_OWNERSHIP) as BrandProcessorId[],
);

export type ProcessorRuntimeActivity =
  | "IDLE"
  | "WAITING_FOR_EVIDENCE"
  | "WAITING_FOR_DEPENDENCY"
  | "READY_TO_RUN"
  | "RETRY_SCHEDULED"
  | "LEARNING"
  | "REFRESHING"
  | "TEMPORARILY_UNAVAILABLE";

export type ProcessorExecutionReadiness =
  | "UNKNOWN"
  | "WAITING_FOR_EVIDENCE"
  | "WAITING_FOR_DEPENDENCY"
  | "READY_TO_RUN";

export type ProcessorLatestExecutionStatus =
  | "WAITING_FOR_DEPENDENCY"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED_TERMINAL"
  | "CANCELLED";

export interface ProcessorRuntimeFailure {
  readonly category: string | null;
  readonly code: string;
  readonly currentPreserved: boolean;
  readonly retryEligible: boolean;
}

export interface ProcessorRuntimeProjection {
  readonly processorId: BrandProcessorId;
  readonly activity: ProcessorRuntimeActivity;
  /** Readiness captured by the latest durable execution, not current dependency reevaluation. */
  readonly readiness: ProcessorExecutionReadiness;
  readonly latestExecutionStatus: ProcessorLatestExecutionStatus | null;
  readonly reasonCode: string | null;
  readonly hasCurrent: boolean;
  readonly refreshing: boolean;
  readonly failure: ProcessorRuntimeFailure | null;
}

export type BrandProcessorRuntimeProjection = Readonly<
  Record<BrandProcessorId, ProcessorRuntimeProjection>
>;

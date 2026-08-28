export type InputDependencyErrorCode =
  | "CANONICAL_STATE_NOT_FOUND"
  | "CANONICAL_INPUT_UNAVAILABLE"
  | "CANONICAL_CONFLICT_BLOCKING"
  | "EVIDENCE_NOT_AVAILABLE"
  | "EVIDENCE_DEGRADED"
  | "EVIDENCE_REFERENCE_INVALID"
  | "EVIDENCE_CAPABILITY_NOT_ALLOWED"
  | "TENANCY_VIOLATION"
  | "DEPENDENCY_SNAPSHOT_INCOHERENT"
  | "DE_EVIDENCE_STORE_PREREQUISITE_MISSING"
  | "CONFIGURATION_DRIFT";

export class InputDependencyError extends Error {
  constructor(
    readonly code: InputDependencyErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "InputDependencyError";
  }
}

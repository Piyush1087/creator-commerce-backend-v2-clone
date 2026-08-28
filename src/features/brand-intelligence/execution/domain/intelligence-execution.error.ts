export type IntelligenceExecutionErrorCode =
  | "EXECUTION_IDEMPOTENCY_CONFLICT"
  | "PROCESSOR_IDEMPOTENCY_CONFLICT"
  | "NO_ELIGIBLE_WORK"
  | "LEASE_LOST"
  | "ATTEMPT_EXHAUSTED"
  | "DEPENDENCY_UNAVAILABLE"
  | "CONFIGURATION_DRIFT"
  | "INVALID_EXECUTION_STATE"
  | "CANCELLED";

export class IntelligenceExecutionError extends Error {
  constructor(
    readonly code: IntelligenceExecutionErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, string | number | boolean>>,
  ) {
    super(message);
    this.name = "IntelligenceExecutionError";
  }
}

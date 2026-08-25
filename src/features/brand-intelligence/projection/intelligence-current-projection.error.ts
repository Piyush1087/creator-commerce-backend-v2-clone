export type IntelligenceProjectionErrorCode =
  | "INTELLIGENCE_OBJECT_NOT_FOUND"
  | "INTELLIGENCE_COMPONENT_NOT_FOUND"
  | "CONTRACT_CONFIGURATION_DRIFT"
  | "TENANCY_VIOLATION"
  | "PROJECTION_INVARIANT";

export class IntelligenceCurrentProjectionError extends Error {
  constructor(
    readonly code: IntelligenceProjectionErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "IntelligenceCurrentProjectionError";
  }
}

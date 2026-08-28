export type IntelligencePersistenceErrorCode =
  | "CAS_CONFLICT"
  | "PROTECTED_STATE"
  | "INVALID_TRANSITION"
  | "INVALID_SEMANTIC_PATH"
  | "IDEMPOTENCY_CONFLICT"
  | "TENANCY_VIOLATION"
  | "PERSISTENCE_INVARIANT"
  | "CANDIDATE_NOT_CURRENT";

export class IntelligencePersistenceError extends Error {
  constructor(
    readonly code: IntelligencePersistenceErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, string | number | boolean>>,
  ) {
    super(message);
    this.name = "IntelligencePersistenceError";
  }
}

import { Prisma } from "@prisma/client";

export type DataExtractionPersistenceErrorCode =
  | "TENANCY_VIOLATION"
  | "RESOURCE_NOT_FOUND"
  | "CAPTURE_NOT_FOUND"
  | "EVIDENCE_NOT_FOUND"
  | "CAPABILITY_EXECUTION_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_INVARIANT"
  | "INVALID_LIFECYCLE_TRANSITION";

export class DataExtractionPersistenceError extends Error {
  constructor(
    readonly code: DataExtractionPersistenceErrorCode,
    message?: string,
  ) {
    super(message ?? `DATA_EXTRACTION_${code}`);
    this.name = "DataExtractionPersistenceError";
  }
}

export const persistenceError = (
  code: DataExtractionPersistenceErrorCode,
): DataExtractionPersistenceError =>
  new DataExtractionPersistenceError(code, `DATA_EXTRACTION_${code}`);

export const isDataExtractionPersistenceError = (
  error: unknown,
): error is DataExtractionPersistenceError =>
  error instanceof DataExtractionPersistenceError;

export const mapPrismaPersistenceError = (error: unknown): never => {
  if (isDataExtractionPersistenceError(error)) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw persistenceError("IDEMPOTENCY_CONFLICT");
    }
    if (error.code === "P2003") {
      throw persistenceError("TENANCY_VIOLATION");
    }
    if (error.code === "P2025") {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  }

  throw persistenceError("PERSISTENCE_INVARIANT");
};

export async function withPersistenceErrorMapping<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return mapPrismaPersistenceError(error);
  }
}

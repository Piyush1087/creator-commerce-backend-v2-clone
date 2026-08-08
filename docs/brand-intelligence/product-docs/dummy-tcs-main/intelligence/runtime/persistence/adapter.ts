export type MappingStatus = "EXISTING" | "RECONCILE" | "VERIFY" | "ADD";

export type PersistenceMapping = {
  objectId: string;
  targetField: string;
  status: MappingStatus;
  writable: boolean;
};

export type ValidatedProcessorOutput = {
  processorExecutionId: string;
  entityId: string;
  values: Record<string, unknown>;
};

export type WriteContext = {
  executionType: "TEST" | "ONBOARDING" | "REFRESH" | "ADMIN";
  persistResults: boolean;
  protectedManualObjectIds?: Set<string>;
};

export interface BrandProfileTransaction {
  updateBrandProfile(entityId: string, patch: Record<string, unknown>): Promise<void>;
}

export class PersistenceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}

/**
 * Builds a canonical BrandProfile patch from already validated Intelligence.
 * It intentionally refuses unresolved schema mappings rather than guessing
 * backend field names or creating duplicate storage.
 */
export function buildCanonicalPatch(
  output: ValidatedProcessorOutput,
  mappings: Record<string, PersistenceMapping>,
  context: WriteContext
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [objectId, value] of Object.entries(output.values)) {
    const mapping = mappings[objectId];
    if (!mapping) {
      throw new PersistenceError("PERSISTENCE_MAPPING_MISSING", `No persistence mapping for '${objectId}'`);
    }
    if (!mapping.writable || mapping.status === "VERIFY" || mapping.status === "RECONCILE" || mapping.status === "ADD") {
      throw new PersistenceError(
        "PERSISTENCE_MAPPING_UNRESOLVED",
        `Mapping for '${objectId}' is not yet enabled against the deployed backend schema`
      );
    }
    if (context.executionType === "REFRESH" && context.protectedManualObjectIds?.has(objectId)) {
      continue;
    }
    patch[mapping.targetField] = value;
  }

  return patch;
}

export async function persistValidatedOutput(
  tx: BrandProfileTransaction,
  output: ValidatedProcessorOutput,
  mappings: Record<string, PersistenceMapping>,
  context: WriteContext
): Promise<{ persisted: boolean; patch: Record<string, unknown> }> {
  if (!context.persistResults) return { persisted: false, patch: {} };
  const patch = buildCanonicalPatch(output, mappings, context);
  if (Object.keys(patch).length === 0) return { persisted: false, patch };

  try {
    await tx.updateBrandProfile(output.entityId, patch);
    return { persisted: true, patch };
  } catch (error) {
    throw new PersistenceError(
      "FAILED_PERSISTENCE",
      error instanceof Error ? error.message : "Canonical BrandProfile persistence failed"
    );
  }
}

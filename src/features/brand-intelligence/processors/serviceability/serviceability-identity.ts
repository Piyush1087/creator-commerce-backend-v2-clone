import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { ServiceabilityCurrentState } from "./serviceability-state.repository";
import {
  SERVICEABILITY_OBJECT,
  type ServiceabilityOutput,
} from "./serviceability.types";

export function serviceabilityInvalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}
export function serviceabilityItemPath(collection: string, id: string) {
  return new ComponentPathCodec().encode([
    { kind: "field", value: collection },
    { kind: "item", semanticId: id },
  ]);
}
export function serviceabilityScope(
  raw: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(raw) || !raw.length)
    serviceabilityInvalid("SERVICEABILITY_INVALID_SCOPE");
  return raw.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      return serviceabilityInvalid("SERVICEABILITY_INVALID_SCOPE");
    const row = entry as Record<string, unknown>;
    if (
      row.objectSemanticId !== SERVICEABILITY_OBJECT ||
      row.pathSchemeVersion !== 1 ||
      (row.brandId !== undefined && row.brandId !== brandId) ||
      typeof row.componentSemanticPath !== "string"
    )
      return serviceabilityInvalid("SERVICEABILITY_INVALID_SCOPE");
    new ComponentPathCodec().assertCanonical(row.componentSemanticPath);
    return {
      brandId,
      objectSemanticId: SERVICEABILITY_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: row.componentSemanticPath,
    };
  });
}
export const serviceabilityScopeAllows = (
  scope: readonly ComponentSemanticAddress[],
  path: string,
) =>
  scope.some(
    (entry) =>
      entry.objectSemanticId === SERVICEABILITY_OBJECT &&
      (entry.componentSemanticPath === "$" ||
        entry.componentSemanticPath === path ||
        path.startsWith(entry.componentSemanticPath + "/")),
  );
export const serviceabilityFingerprint = (
  rows: readonly ServiceabilityCurrentState[],
) =>
  canonicalJson(
    rows
      .map((row) => ({
        path: row.componentSemanticPath,
        generation: row.currentComponentGenerationId,
        revision: row.revision.toString(),
        protection: row.protectionState,
        lifecycle: row.lifecycle,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
export function validateServiceabilityIdentity(
  output: ServiceabilityOutput,
  current: readonly ServiceabilityCurrentState[],
) {
  for (const list of [
    output.serviceability_profile?.serviceable_markets,
    output.serviceability_profile?.serviceability_basis,
  ]) {
    const ids = (list ?? []).map((item) => item.semantic_id);
    if (new Set(ids).size !== ids.length)
      serviceabilityInvalid("SERVICEABILITY_DUPLICATE_SEMANTIC_ID");
    ids.forEach((id) => {
      if (!id.trim()) serviceabilityInvalid("SERVICEABILITY_EMPTY_SEMANTIC_ID");
      serviceabilityItemPath("serviceable_markets", id);
    });
  }
  for (const row of current) {
    const last = new ComponentPathCodec()
      .decode(row.componentSemanticPath)
      .segments.at(-1);
    const value = row.currentComponentGeneration.valuePayload;
    if (
      last?.kind === "item" &&
      (!value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        value.semantic_id !== last.semanticId)
    )
      serviceabilityInvalid("SERVICEABILITY_PERSISTED_ID_PATH_MISMATCH");
  }
}

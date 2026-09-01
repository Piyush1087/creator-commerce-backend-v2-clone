import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { DifferentiationCurrentState } from "./brand-differentiation-state.repository";
import {
  DIFFERENTIATION_OBJECT,
  type DifferentiationOutput,
} from "./brand-differentiation.types";

export function differentiationInvalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}
export function differentiatorPath(id: string): string {
  return new ComponentPathCodec().encode([{ kind: "item", semanticId: id }]);
}
export function proofPath(parentId: string, id: string): string {
  return new ComponentPathCodec().encode([
    { kind: "item", semanticId: parentId },
    { kind: "field", value: "proof_points" },
    { kind: "item", semanticId: id },
  ]);
}
export function differentiationScope(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || !value.length)
    return differentiationInvalid("DIFFERENTIATION_INVALID_SCOPE");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      return differentiationInvalid("DIFFERENTIATION_INVALID_SCOPE");
    const row = entry as Record<string, unknown>;
    if (
      row.objectSemanticId !== DIFFERENTIATION_OBJECT ||
      row.pathSchemeVersion !== 1 ||
      (row.brandId !== undefined && row.brandId !== brandId) ||
      typeof row.componentSemanticPath !== "string"
    )
      return differentiationInvalid("DIFFERENTIATION_INVALID_SCOPE");
    new ComponentPathCodec().assertCanonical(row.componentSemanticPath);
    return {
      brandId,
      objectSemanticId: DIFFERENTIATION_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: row.componentSemanticPath,
    };
  });
}
export const differentiationScopeAllows = (
  scope: readonly ComponentSemanticAddress[],
  path: string,
) =>
  scope.some(
    (a) =>
      a.objectSemanticId === DIFFERENTIATION_OBJECT &&
      (a.componentSemanticPath === "$" ||
        path === a.componentSemanticPath ||
        path.startsWith(`${a.componentSemanticPath}/`)),
  );

export const differentiationFingerprint = (
  rows: readonly DifferentiationCurrentState[],
) =>
  canonicalJson(
    rows
      .map((r) => ({
        path: r.componentSemanticPath,
        generation: r.currentComponentGenerationId,
        revision: r.revision.toString(),
        protection: r.protectionState,
        lifecycle: r.lifecycle,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );

/** Identity is the exact supplied semantic ID. Never text, order, or similarity. */
export function validateDifferentiationIdentity(
  output: DifferentiationOutput,
  current: readonly DifferentiationCurrentState[],
): void {
  const unique = (ids: readonly string[]) => {
    if (new Set(ids).size !== ids.length)
      differentiationInvalid("DIFFERENTIATION_DUPLICATE_SEMANTIC_ID");
    ids.forEach(differentiatorPath);
  };
  unique((output.differentiation_and_proof ?? []).map((d) => d.semantic_id));
  for (const d of output.differentiation_and_proof ?? [])
    unique((d.proof_points ?? []).map((p) => p.semantic_id));
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
      differentiationInvalid("DIFFERENTIATION_PERSISTED_ID_PATH_MISMATCH");
  }
}

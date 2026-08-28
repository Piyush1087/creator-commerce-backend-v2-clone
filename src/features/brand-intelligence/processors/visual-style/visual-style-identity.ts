import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { VisualStyleCurrentState } from "./visual-style-state.repository";
import {
  VISUAL_STYLE_OBJECT,
  VISUAL_IMAGERY_FIELDS,
  type VisualStyleOutput,
} from "./visual-style.types";

export function visualStyleInvalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}
export function visualItemPath(fields: readonly string[], id: string): string {
  return new ComponentPathCodec().encode([
    ...fields.map((value) => ({ kind: "field" as const, value })),
    { kind: "item", semanticId: id },
  ]);
}
export function visualStyleScope(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || !value.length)
    visualStyleInvalid("VISUAL_INVALID_SCOPE");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      return visualStyleInvalid("VISUAL_INVALID_SCOPE");
    const row = entry as Record<string, unknown>;
    if (
      row.objectSemanticId !== VISUAL_STYLE_OBJECT ||
      row.pathSchemeVersion !== 1 ||
      (row.brandId !== undefined && row.brandId !== brandId) ||
      typeof row.componentSemanticPath !== "string"
    )
      return visualStyleInvalid("VISUAL_INVALID_SCOPE");
    new ComponentPathCodec().assertCanonical(row.componentSemanticPath);
    return {
      brandId,
      objectSemanticId: VISUAL_STYLE_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: row.componentSemanticPath,
    };
  });
}
export const visualStyleScopeAllows = (
  scope: readonly ComponentSemanticAddress[],
  path: string,
) =>
  scope.some(
    (a) =>
      a.objectSemanticId === VISUAL_STYLE_OBJECT &&
      (a.componentSemanticPath === "$" ||
        a.componentSemanticPath === path ||
        path.startsWith(a.componentSemanticPath + "/")),
  );
export const visualStyleFingerprint = (
  rows: readonly VisualStyleCurrentState[],
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
export function validateVisualStyleIdentity(
  output: VisualStyleOutput,
  current: readonly VisualStyleCurrentState[],
): void {
  const profile = output.visual_style_profile;
  const lists = [
    profile?.style_traits,
    profile?.graphic_treatment?.traits,
    ...VISUAL_IMAGERY_FIELDS.map((f) => profile?.imagery_style?.[f]),
  ];
  for (const list of lists) {
    const ids = (list ?? []).map((i) => i.semantic_id);
    if (new Set(ids).size !== ids.length)
      visualStyleInvalid("VISUAL_DUPLICATE_SEMANTIC_ID");
    ids.forEach((id) => visualItemPath([], id));
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
      visualStyleInvalid("VISUAL_PERSISTED_ID_PATH_MISMATCH");
  }
}

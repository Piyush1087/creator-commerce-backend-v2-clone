import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import {
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterObject,
  type BrandCharacterOutput,
  type CharacterItem,
} from "./brand-character.types";
import type { CharacterCurrentState } from "./brand-character-state.repository";

export function characterInvalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}
export function itemPath(id: string): string {
  try {
    return new ComponentPathCodec().encode([{ kind: "item", semanticId: id }]);
  } catch {
    return characterInvalid("INVALID_SEMANTIC_ITEM_ID");
  }
}
export function characterScope(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || !value.length)
    return characterInvalid("INVALID_ACTIVE_SCOPE");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      return characterInvalid("INVALID_ACTIVE_SCOPE");
    const row = entry as Record<string, unknown>;
    if (
      !BRAND_CHARACTER_OBJECTS.some((id) => id === row.objectSemanticId) ||
      row.pathSchemeVersion !== 1 ||
      (row.brandId !== undefined && row.brandId !== brandId) ||
      typeof row.componentSemanticPath !== "string"
    )
      return characterInvalid("INVALID_ACTIVE_SCOPE");
    const codec = new ComponentPathCodec();
    codec.assertCanonical(row.componentSemanticPath);
    const segments = codec.decode(row.componentSemanticPath).segments;
    if (
      segments.length &&
      (segments.length !== 1 || segments[0].kind !== "item")
    )
      return characterInvalid("INVALID_ACTIVE_SCOPE");
    return {
      brandId,
      objectSemanticId: row.objectSemanticId as BrandCharacterObject,
      componentSemanticPath: row.componentSemanticPath,
      pathSchemeVersion: 1,
    };
  });
}
export function characterScopeAllows(
  scope: readonly ComponentSemanticAddress[],
  objectId: string,
  path: string,
): boolean {
  return scope.some(
    (address) =>
      address.objectSemanticId === objectId &&
      (address.componentSemanticPath === "$" ||
        address.componentSemanticPath === path),
  );
}
export function characterCurrentFingerprint(
  rows: readonly CharacterCurrentState[],
): string {
  return canonicalJson(
    rows
      .map((row) => ({
        objectId: row.objectSemanticId,
        path: row.componentSemanticPath,
        revision: row.revision.toString(),
        generation: row.currentComponentGenerationId,
        lifecycle: row.lifecycle,
        protection: row.protectionState,
      }))
      .sort((a, b) =>
        `${a.objectId}:${a.path}`.localeCompare(`${b.objectId}:${b.path}`),
      ),
  );
}
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export const characterLabel = (item: CharacterItem) =>
  item.value ?? item.trait ?? "";
function equivalentLabel(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (left === right) return true;
  const words = (text: string) =>
    new Set(
      text
        .split(" ")
        .filter(
          (word) =>
            !["a", "an", "the", "our", "and", "to", "of", "for"].includes(word),
        ),
    );
  const l = words(left);
  const r = words(right);
  const intersection = [...l].filter((word) => r.has(word)).length;
  return (
    Math.min(l.size, r.size) >= 3 &&
    intersection / Math.max(l.size, r.size) >= 0.8
  );
}
export function validateCharacterIdentity(
  output: BrandCharacterOutput,
  current: readonly CharacterCurrentState[],
  scope: readonly ComponentSemanticAddress[],
): void {
  for (const id of BRAND_CHARACTER_OBJECTS) {
    const items = output[id] ?? [];
    for (const item of items) {
      const path = itemPath(item.semantic_id);
      if (!characterScopeAllows(scope, id, path))
        characterInvalid("CHARACTER_OUTPUT_OUTSIDE_ACTIVE_SCOPE");
      for (const prior of current.filter(
        (row) =>
          row.objectSemanticId === id &&
          row.componentSemanticPath !== "$" &&
          row.lifecycle === "ACTIVE",
      )) {
        const old = prior.currentComponentGeneration
          .valuePayload as unknown as CharacterItem;
        if (
          old &&
          typeof old === "object" &&
          typeof old.semantic_id === "string" &&
          old.semantic_id !== item.semantic_id &&
          (normalize(old.semantic_id) === normalize(item.semantic_id) ||
            equivalentLabel(characterLabel(old), characterLabel(item)))
        )
          characterInvalid("CHARACTER_SEMANTIC_ID_CONTINUITY");
      }
      if (
        items.some(
          (other) =>
            other !== item &&
            equivalentLabel(characterLabel(other), characterLabel(item)),
        )
      )
        characterInvalid("DUPLICATE_CHARACTER_MEANING");
    }
  }
}

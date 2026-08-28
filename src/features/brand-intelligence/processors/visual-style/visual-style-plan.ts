import type {
  IntelligenceReadiness,
  IntelligenceNodeKind,
} from "@prisma/client";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { VisualStyleCurrentState } from "./visual-style-state.repository";
import {
  VISUAL_IMAGERY_FIELDS,
  type VisualStyleOutput,
  type VisualStyleMetadata,
  type VisualStyleItemMetadata,
} from "./visual-style.types";
import {
  visualItemPath,
  visualStyleInvalid,
  visualStyleScopeAllows,
  validateVisualStyleIdentity,
} from "./visual-style-identity";

export interface VisualStyleComponentPlan {
  readonly path: string;
  readonly value: unknown;
  readonly metadata: VisualStyleMetadata | null;
  readonly nodeKind: IntelligenceNodeKind;
  readonly readiness: IntelligenceReadiness;
  readonly apply: boolean;
}
/** Consumer-bounded MVP readiness, never a claim of rendered/imagery completeness. */
export function visualStyleOutputReadiness(
  output: VisualStyleOutput,
): IntelligenceReadiness {
  const p = output.visual_style_profile;
  if (
    !p ||
    (!p.summary &&
      !p.style_traits?.length &&
      !p.graphic_treatment?.traits?.length &&
      !VISUAL_IMAGERY_FIELDS.some((f) => p.imagery_style?.[f]?.length))
  )
    return "NOT_READY";
  return p.summary &&
    p.style_traits?.length &&
    p.graphic_treatment?.traits?.length
    ? "READY"
    : "PARTIAL";
}
export function visualStyleComponentPlan(
  output: VisualStyleOutput,
  current: readonly VisualStyleCurrentState[],
  scope: readonly ComponentSemanticAddress[],
): readonly VisualStyleComponentPlan[] {
  validateVisualStyleIdentity(output, current);
  const existing = new Map(current.map((r) => [r.componentSemanticPath, r]));
  const protectedAt = (path: string) => {
    const row = existing.get(path);
    return row && row.protectionState !== "UNPROTECTED";
  };
  if (protectedAt("$"))
    visualStyleInvalid("VISUAL_PROTECTED_ROOT_REQUIRES_RESOLUTION");
  const plans: VisualStyleComponentPlan[] = [];
  const add = (
    path: string,
    value: unknown,
    metadata: VisualStyleMetadata | null,
    nodeKind: IntelligenceNodeKind,
    readiness: IntelligenceReadiness = "READY",
  ) => {
    if (visualStyleScopeAllows(scope, path))
      plans.push({ path, value, metadata, nodeKind, readiness, apply: true });
  };
  const admission = (path: string) => {
    if (!existing.has(path) && !visualStyleScopeAllows(scope, path))
      visualStyleInvalid("VISUAL_PARENT_REQUIRED_FOR_ADMISSION");
  };
  admission("$");
  const readiness = visualStyleOutputReadiness(output);
  if (!existing.has("$") || readiness !== "NOT_READY")
    add(
      "$",
      readiness === "NOT_READY" ? null : {},
      null,
      "OBJECT_FIELD",
      readiness,
    );
  const p = output.visual_style_profile,
    m = output.output_metadata;
  if (!p) return plans;
  if (p.summary != null) add("$/f/summary", p.summary, m.summary, "SCALAR");
  const valueAt = (path: string, itemPath: string, field: string): unknown => {
    const scalar = existing.get(path)?.currentComponentGeneration.valuePayload;
    const item =
      existing.get(itemPath)?.currentComponentGeneration.valuePayload;
    return scalar !== undefined
      ? scalar
      : item && typeof item === "object" && !Array.isArray(item)
        ? item[field]
        : undefined;
  };
  const list = (
    fields: readonly string[],
    items:
      | readonly { semantic_id: string; trait?: string; value?: string }[]
      | null
      | undefined,
    metas: readonly VisualStyleItemMetadata[] | null | undefined,
    field: "trait" | "value",
  ) => {
    if (!items?.length) return; // Omission, empty and null never remove prior items.
    const collection = "$" + fields.map((f) => "/f/" + f).join("");
    admission(collection);
    if (protectedAt(collection)) {
      const equivalent = items.every((item) => {
        const path = visualItemPath(fields, item.semantic_id);
        return item[field] === valueAt(path + "/f/" + field, path, field);
      });
      if (!equivalent) {
        if (!visualStyleScopeAllows(scope, collection))
          visualStyleInvalid("VISUAL_PROTECTED_PARENT_OUTSIDE_SCOPE");
        add(collection, items, metas?.[0] ?? null, "COLLECTION");
      }
      return;
    }
    add(collection, [], null, "COLLECTION");
    for (const item of items) {
      const path = visualItemPath(fields, item.semantic_id),
        meta = metas?.find((x) => x.semantic_id === item.semantic_id);
      if (!meta) visualStyleInvalid("VISUAL_ITEM_METADATA_MISMATCH");
      admission(path);
      if (protectedAt(path)) {
        if (item[field] !== valueAt(path + "/f/" + field, path, field)) {
          if (!visualStyleScopeAllows(scope, path))
            visualStyleInvalid("VISUAL_PROTECTED_PARENT_OUTSIDE_SCOPE");
          add(path, item, meta, "SEMANTIC_ITEM");
        }
        continue;
      }
      add(path, { semantic_id: item.semantic_id }, null, "SEMANTIC_ITEM");
      add(path + "/f/" + field, item[field], meta, "SCALAR");
    }
  };
  list(["style_traits"], p.style_traits, m.style_traits, "trait");
  for (const parent of ["imagery_style", "graphic_treatment"] as const) {
    const nested = p[parent];
    if (!nested) continue;
    const path = "$/f/" + parent;
    admission(path);
    if (protectedAt(path)) {
      const equivalent = Object.entries(nested).every(
        ([field, items]) =>
          !items?.length ||
          items.every((item) => {
            const itemPath = visualItemPath([parent, field], item.semantic_id);
            return (
              item.value === valueAt(itemPath + "/f/value", itemPath, "value")
            );
          }),
      );
      if (!equivalent) {
        if (!visualStyleScopeAllows(scope, path))
          visualStyleInvalid("VISUAL_PROTECTED_PARENT_OUTSIDE_SCOPE");
        add(
          path,
          nested,
          parent === "graphic_treatment"
            ? (m.graphic_treatment?.traits?.[0] ?? null)
            : null,
          "OBJECT_FIELD",
        );
      }
      continue;
    }
    if (parent === "graphic_treatment" && p.graphic_treatment?.traits?.length) {
      add(path, {}, null, "OBJECT_FIELD");
      list(
        [parent, "traits"],
        p.graphic_treatment.traits,
        m.graphic_treatment?.traits,
        "value",
      );
    }
    if (
      parent === "imagery_style" &&
      VISUAL_IMAGERY_FIELDS.some((f) => p.imagery_style?.[f]?.length)
    ) {
      add(path, {}, null, "OBJECT_FIELD");
      for (const f of VISUAL_IMAGERY_FIELDS)
        list([parent, f], p.imagery_style?.[f], m.imagery_style?.[f], "value");
    }
  }
  return plans; // visual_constraints is never in generated scope, including structural anchors.
}

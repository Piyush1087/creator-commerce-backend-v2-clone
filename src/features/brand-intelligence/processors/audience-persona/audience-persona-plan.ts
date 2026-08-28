import type {
  IntelligenceNodeKind,
  IntelligenceReadiness,
} from "@prisma/client";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { AudienceCurrentState } from "./audience-persona-state.repository";
import {
  AUDIENCE_CORE_DIMENSIONS,
  AUDIENCE_LIST_FIELDS,
  type AudienceOutput,
  type AudienceMetadata,
} from "./audience-persona.types";
import {
  audienceInvalid,
  audienceScopeAllows,
  personaPath,
  validateAudienceIdentity,
} from "./audience-persona-identity";

export interface AudienceComponentPlan {
  readonly path: string;
  readonly value: unknown;
  readonly metadata: AudienceMetadata | null;
  readonly nodeKind: IntelligenceNodeKind;
  readonly readiness: IntelligenceReadiness;
  readonly apply: boolean;
}
export function audienceOutputReadiness(
  output: AudienceOutput,
): IntelligenceReadiness {
  const active = (output.audience_personas ?? []).filter(
    (p) =>
      p.lifecycle === "ACTIVE" &&
      !output.reconciliation.some(
        (r) =>
          r.candidate_ref === p.semantic_id &&
          ["POSSIBLE_MATCH", "MATERIAL_CONFLICT"].includes(r.relationship),
      ),
  );
  if (!active.length) return "NOT_READY";
  return active.every((p) =>
    AUDIENCE_CORE_DIMENSIONS.every((field) => (p[field]?.length ?? 0) > 0),
  )
    ? "READY"
    : "PARTIAL";
}

/** Processor-owned mapping, not a second persistence engine. W1.0B applies every current mutation. */
export function audienceComponentPlan(
  output: AudienceOutput,
  current: readonly AudienceCurrentState[],
  scope: readonly ComponentSemanticAddress[],
): readonly AudienceComponentPlan[] {
  validateAudienceIdentity(output, current);
  const byPath = new Map(current.map((r) => [r.componentSemanticPath, r]));
  const metas = new Map(
    (output.output_metadata ?? []).map((m) => [m.semantic_id, m]),
  );
  const relations = new Map(
    output.reconciliation.map((r) => [r.candidate_ref, r]),
  );
  const root = byPath.get("$");
  const blocked = new Set<string>();
  const isProtected = (id: string) =>
    current.some(
      (r) =>
        (r.componentSemanticPath === personaPath(id) ||
          r.componentSemanticPath.startsWith(`${personaPath(id)}/`)) &&
        r.protectionState !== "UNPROTECTED",
    );
  // Supersession is one conceptual unit. Any protected source keeps the complete
  // source/successor group as reconciliation context, not an active replacement.
  for (const m of output.output_metadata ?? []) {
    if (byPath.has(personaPath(m.semantic_id))) continue;
    const sources = m.field_metadata.lifecycle.supersedes_ref ?? [];
    if (sources.some(isProtected)) {
      blocked.add(m.semantic_id);
      for (const id of sources) blocked.add(id);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of output.output_metadata ?? []) {
      const connected = [
        m.semantic_id,
        ...(m.field_metadata.lifecycle.supersedes_ref ?? []),
        ...(m.field_metadata.lifecycle.superseded_by_ref ?? []),
      ];
      if (connected.some((id) => blocked.has(id)))
        for (const id of connected)
          if (!blocked.has(id)) {
            blocked.add(id);
            changed = true;
          }
    }
  }
  const plans: AudienceComponentPlan[] = [];
  const add = (
    path: string,
    value: unknown,
    metadata: AudienceMetadata | null,
    nodeKind: IntelligenceNodeKind,
    readiness: IntelligenceReadiness,
    apply = true,
  ) => {
    if (audienceScopeAllows(scope, path))
      plans.push({
        path,
        value,
        metadata,
        nodeKind,
        readiness,
        apply:
          apply &&
          !(
            output.reconciliation.some(
              (r) =>
                r.relationship === "MATERIAL_CONFLICT" &&
                (path === personaPath(r.candidate_ref) ||
                  path.startsWith(`${personaPath(r.candidate_ref)}/`)),
            ) &&
            byPath.get(path)?.protectionState !== "BRAND_CONFIRMED" &&
            byPath.get(path)?.protectionState !== "SUPPORT_CONTROLLED"
          ),
      });
  };
  const currentHasPersonas = current.some((r) =>
    r.componentSemanticPath.startsWith("$/i/"),
  );
  const admitted = (output.audience_personas ?? []).filter(
    (p) =>
      !blocked.has(p.semantic_id) &&
      !["POSSIBLE_MATCH", "MATERIAL_CONFLICT"].includes(
        relations.get(p.semantic_id)!.relationship,
      ),
  );
  if (!root && !audienceScopeAllows(scope, "$") && admitted.length)
    audienceInvalid("AUDIENCE_COLLECTION_NOT_MATERIALIZED");
  if (!root || admitted.length)
    add(
      "$",
      output.audience_personas === null && !currentHasPersonas ? null : [],
      null,
      "COLLECTION",
      audienceOutputReadiness(output),
    );
  for (const p of [...(output.audience_personas ?? [])].sort((a, b) =>
    a.semantic_id.localeCompare(b.semantic_id),
  )) {
    const path = personaPath(p.semantic_id);
    const meta = metas.get(p.semantic_id)!;
    const relation = relations.get(p.semantic_id)!;
    if (!byPath.has(path) && !audienceScopeAllows(scope, path))
      audienceInvalid("AUDIENCE_NEW_PERSONA_REQUIRES_ITEM_SCOPE");
    const links = [
      ...(meta.field_metadata.lifecycle.supersedes_ref ?? []),
      ...(meta.field_metadata.lifecycle.superseded_by_ref ?? []),
    ];
    if (
      links.length &&
      !byPath.has(path) &&
      [p.semantic_id, ...links].some(
        (id) => !audienceScopeAllows(scope, personaPath(id)),
      )
    )
      audienceInvalid("AUDIENCE_SUPERSESSION_REQUIRES_COMPLETE_SCOPE");
    const rootProtected =
      root?.protectionState !== undefined &&
      root.protectionState !== "UNPROTECTED";
    if (rootProtected)
      audienceInvalid("AUDIENCE_AGGREGATE_PROTECTED_REQUIRES_RESOLUTION");
    const possible = relation.relationship === "POSSIBLE_MATCH";
    const conflict = relation.relationship === "MATERIAL_CONFLICT";
    const suppressed =
      possible ||
      blocked.has(p.semantic_id) ||
      (conflict && !isProtected(p.semantic_id));
    const personaProtected =
      byPath.get(path)?.protectionState !== undefined &&
      byPath.get(path)!.protectionState !== "UNPROTECTED";
    if (personaProtected) {
      // Never write children under protected whole-item truth. The exact parent
      // proposal enters W1.0B's candidate path and cannot replace current.
      add(
        path,
        p,
        meta.field_metadata.label,
        "SEMANTIC_ITEM",
        "PARTIAL",
        !possible && !blocked.has(p.semantic_id),
      );
      continue;
    }
    add(
      path,
      { semantic_id: p.semantic_id },
      meta.field_metadata.label,
      "SEMANTIC_ITEM",
      p.lifecycle === "ACTIVE"
        ? AUDIENCE_CORE_DIMENSIONS.every((field) => (p[field]?.length ?? 0) > 0)
          ? "READY"
          : "PARTIAL"
        : "NOT_READY",
      !suppressed,
    );
    for (const [field, value] of Object.entries(p)) {
      if (field === "semantic_id") continue;
      const fieldPath = `${path}/f/${field}`;
      const fieldMeta = meta.field_metadata[field];
      const collection = AUDIENCE_LIST_FIELDS.includes(
        field as (typeof AUDIENCE_LIST_FIELDS)[number],
      );
      // Explicit lifecycle change cannot hide an independently protected field/item.
      const hidesProtected =
        field === "lifecycle" &&
        p.lifecycle !== "ACTIVE" &&
        isProtected(p.semantic_id);
      const apply = !suppressed && !hidesProtected;
      if (!collection) {
        add(
          fieldPath,
          value,
          fieldMeta,
          value !== null && typeof value === "object"
            ? "OBJECT_FIELD"
            : "SCALAR",
          value === null ? "NOT_READY" : "READY",
          apply,
        );
        continue;
      }
      const priorChildren = current.some((r) =>
        r.componentSemanticPath.startsWith(`${fieldPath}/i/`),
      );
      if (value === null && priorChildren) continue;
      const items = p[field as (typeof AUDIENCE_LIST_FIELDS)[number]] ?? [];
      const protectedCollection =
        byPath.get(fieldPath)?.protectionState !== undefined &&
        byPath.get(fieldPath)!.protectionState !== "UNPROTECTED";
      if (protectedCollection) {
        add(
          fieldPath,
          value,
          fieldMeta,
          "COLLECTION",
          items.length ? "READY" : "NOT_READY",
          apply,
        );
        continue;
      }
      add(
        fieldPath,
        value === null ? null : [],
        fieldMeta,
        "COLLECTION",
        items.length || priorChildren ? "READY" : "NOT_READY",
        apply,
      );
      for (const item of [...items].sort((a, b) =>
        a.semantic_id.localeCompare(b.semantic_id),
      )) {
        const nested = `${fieldPath}${personaPath(item.semantic_id).slice(1)}`;
        const nestedMeta =
          meta.item_metadata[field as (typeof AUDIENCE_LIST_FIELDS)[number]]![
            item.semantic_id
          ];
        const valueProtected = byPath.get(`${nested}/f/value`);
        // Existing finer-grained protected value gets its own candidate; an
        // ancestor payload never masks that protection.
        if (
          byPath.get(nested)?.protectionState !== undefined &&
          byPath.get(nested)!.protectionState !== "UNPROTECTED"
        ) {
          add(nested, item, nestedMeta, "SEMANTIC_ITEM", "READY", apply);
        } else if (valueProtected) {
          add(
            nested,
            { semantic_id: item.semantic_id },
            nestedMeta,
            "SEMANTIC_ITEM",
            "READY",
            apply,
          );
          add(
            `${nested}/f/value`,
            item.value,
            nestedMeta,
            "SCALAR",
            "READY",
            apply,
          );
        } else add(nested, item, nestedMeta, "SEMANTIC_ITEM", "READY", apply);
      }
    }
  }
  // A reconciliation-only generation still has an immutable component snapshot,
  // but is deliberately not a current mutation or a durable Persona admission.
  if (!plans.length && output.reconciliation.length)
    audienceInvalid("AUDIENCE_OUTPUT_OUTSIDE_SCOPE");
  return plans;
}

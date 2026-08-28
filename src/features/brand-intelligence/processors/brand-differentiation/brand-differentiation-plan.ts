import {
  IntelligenceReadiness,
  type IntelligenceNodeKind,
} from "@prisma/client";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { DifferentiationCurrentState } from "./brand-differentiation-state.repository";
import type {
  DifferentiationMetadata,
  DifferentiationOutput,
} from "./brand-differentiation.types";
import {
  differentiatorPath,
  proofPath,
  differentiationInvalid,
  differentiationScopeAllows,
  validateDifferentiationIdentity,
} from "./brand-differentiation-identity";

export interface DifferentiationComponentPlan {
  readonly path: string;
  readonly value: unknown;
  readonly metadata: DifferentiationMetadata | null;
  readonly nodeKind: IntelligenceNodeKind;
  readonly readiness: IntelligenceReadiness;
  readonly apply: boolean;
}
export function differentiationOutputReadiness(
  output: DifferentiationOutput,
): IntelligenceReadiness {
  const items = output.differentiation_and_proof ?? [];
  return !items.length
    ? "NOT_READY"
    : items.every((d) => d.proof_points?.length)
      ? "READY"
      : "PARTIAL";
}

/** Structural anchors never duplicate nested truth. Missing/null never deletes prior members. */
export function differentiationComponentPlan(
  output: DifferentiationOutput,
  current: readonly DifferentiationCurrentState[],
  scope: readonly ComponentSemanticAddress[],
): readonly DifferentiationComponentPlan[] {
  validateDifferentiationIdentity(output, current);
  const existing = new Map(current.map((r) => [r.componentSemanticPath, r]));
  const scalar = (path: string, parent: string, field: string): unknown => {
    const value = existing.get(path)?.currentComponentGeneration.valuePayload;
    if (value !== undefined) return value;
    const item = existing.get(parent)?.currentComponentGeneration.valuePayload;
    return item && typeof item === "object" && !Array.isArray(item)
      ? item[field]
      : undefined;
  };
  const unchangedProof = (
    id: string,
    proof: { semantic_id: string; statement: string },
  ) => {
    const path = proofPath(id, proof.semantic_id);
    return proof.statement === scalar(`${path}/f/statement`, path, "statement");
  };
  const protectedAt = (path: string) => {
    const row = existing.get(path);
    return row && row.protectionState !== "UNPROTECTED";
  };
  const plans: DifferentiationComponentPlan[] = [];
  const add = (
    path: string,
    value: unknown,
    metadata: DifferentiationMetadata | null,
    nodeKind: IntelligenceNodeKind,
    readiness: IntelligenceReadiness = "READY",
  ) => {
    if (differentiationScopeAllows(scope, path))
      plans.push({ path, value, metadata, nodeKind, readiness, apply: true });
  };
  if (protectedAt("$"))
    differentiationInvalid(
      "DIFFERENTIATION_PROTECTED_ROOT_REQUIRES_RESOLUTION",
    );
  const records = output.differentiation_and_proof;
  const retained = current.some((r) =>
    r.componentSemanticPath.startsWith("$/i/"),
  );
  if (!existing.has("$") && !differentiationScopeAllows(scope, "$"))
    differentiationInvalid("DIFFERENTIATION_ROOT_REQUIRED_FOR_ADMISSION");
  // Root readiness is structural; field/item readiness remains independently projected.
  if (!existing.has("$") || records?.length)
    add(
      "$",
      records === null && !retained ? null : [],
      null,
      "COLLECTION",
      records?.length || retained ? "READY" : "NOT_READY",
    );
  const metas = new Map(
    (output.output_metadata ?? []).map((m) => [m.semantic_id, m]),
  );
  for (const record of records ?? []) {
    const path = differentiatorPath(record.semantic_id);
    const meta = metas.get(record.semantic_id);
    if (!meta) differentiationInvalid("DIFFERENTIATION_METADATA_MISMATCH");
    if (!existing.has(path) && !differentiationScopeAllows(scope, path))
      differentiationInvalid("DIFFERENTIATION_PARENT_REQUIRED_FOR_ADMISSION");
    if (protectedAt(path)) {
      if (
        record.differentiator ===
          scalar(`${path}/f/differentiator`, path, "differentiator") &&
        (record.proof_points ?? []).every((proof) =>
          unchangedProof(record.semantic_id, proof),
        )
      )
        continue;
      if (!differentiationScopeAllows(scope, path))
        differentiationInvalid(
          "DIFFERENTIATION_PROTECTED_PARENT_OUTSIDE_SCOPE",
        );
      add(
        path,
        record,
        meta.differentiator_metadata,
        "SEMANTIC_ITEM",
        record.proof_points?.length ? "READY" : "PARTIAL",
      );
      continue;
    }
    add(path, { semantic_id: record.semantic_id }, null, "SEMANTIC_ITEM");
    add(
      `${path}/f/differentiator`,
      record.differentiator,
      meta.differentiator_metadata,
      "SCALAR",
    );
    const collection = `${path}/f/proof_points`;
    if (protectedAt(collection)) {
      if (
        record.proof_points?.some(
          (proof) => !unchangedProof(record.semantic_id, proof),
        )
      )
        add(collection, record.proof_points, null, "COLLECTION");
      continue;
    }
    const hasOldProof = current.some((r) =>
      r.componentSemanticPath.startsWith(`${collection}/i/`),
    );
    if (!existing.has(collection) || record.proof_points?.length)
      add(
        collection,
        record.proof_points === null && !hasOldProof ? null : [],
        null,
        "COLLECTION",
        record.proof_points?.length || hasOldProof ? "READY" : "PARTIAL",
      );
    const proofs = new Map(
      (meta.proof_point_metadata ?? []).map((m) => [m.semantic_id, m]),
    );
    for (const proof of record.proof_points ?? []) {
      const childPath = proofPath(record.semantic_id, proof.semantic_id);
      const proofMeta = proofs.get(proof.semantic_id);
      if (!proofMeta)
        differentiationInvalid("DIFFERENTIATION_PROOF_METADATA_MISMATCH");
      if (
        !existing.has(childPath) &&
        !differentiationScopeAllows(scope, childPath)
      )
        differentiationInvalid(
          "DIFFERENTIATION_PROOF_PARENT_REQUIRED_FOR_ADMISSION",
        );
      if (protectedAt(childPath)) {
        if (unchangedProof(record.semantic_id, proof)) continue;
        if (!differentiationScopeAllows(scope, childPath))
          differentiationInvalid(
            "DIFFERENTIATION_PROTECTED_PARENT_OUTSIDE_SCOPE",
          );
        add(childPath, proof, proofMeta, "SEMANTIC_ITEM");
        continue;
      }
      add(
        childPath,
        { semantic_id: proof.semantic_id },
        proofMeta,
        "SEMANTIC_ITEM",
      );
      add(`${childPath}/f/statement`, proof.statement, proofMeta, "SCALAR");
    }
  }
  return plans;
}

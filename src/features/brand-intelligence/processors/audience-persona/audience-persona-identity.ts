import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type { AudienceCurrentState } from "./audience-persona-state.repository";
import { AUDIENCE_OBJECT, type AudienceOutput } from "./audience-persona.types";
import { audienceRecord } from "./audience-persona-evidence";

export function audienceInvalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}
export function personaPath(id: string): string {
  return new ComponentPathCodec().encode([{ kind: "item", semanticId: id }]);
}
export function audienceScope(
  value: unknown,
  brandId: string,
): readonly ComponentSemanticAddress[] {
  if (!Array.isArray(value) || !value.length)
    return audienceInvalid("AUDIENCE_INVALID_SCOPE");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object")
      return audienceInvalid("AUDIENCE_INVALID_SCOPE");
    const r = entry as Record<string, unknown>;
    if (
      r.objectSemanticId !== AUDIENCE_OBJECT ||
      r.pathSchemeVersion !== 1 ||
      (r.brandId !== undefined && r.brandId !== brandId) ||
      typeof r.componentSemanticPath !== "string"
    )
      return audienceInvalid("AUDIENCE_INVALID_SCOPE");
    new ComponentPathCodec().assertCanonical(r.componentSemanticPath);
    return {
      brandId,
      objectSemanticId: AUDIENCE_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: r.componentSemanticPath,
    };
  });
}
export const audienceScopeAllows = (
  scope: readonly ComponentSemanticAddress[],
  path: string,
) =>
  scope.some(
    (a) =>
      a.componentSemanticPath === "$" ||
      path === a.componentSemanticPath ||
      path.startsWith(`${a.componentSemanticPath}/`),
  );
export const audienceFingerprint = (rows: readonly AudienceCurrentState[]) =>
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

/** Exact ID, current-basis and reciprocal lifecycle-edge integrity. No label matching. */
export function validateAudienceIdentity(
  output: AudienceOutput,
  current: readonly AudienceCurrentState[],
): void {
  const existing = new Set(
    current.flatMap((r) => {
      const segments = new ComponentPathCodec().decode(
        r.componentSemanticPath,
      ).segments;
      return segments[0]?.kind === "item" ? [segments[0].semanticId] : [];
    }),
  );
  const emitted = new Map(
    (output.audience_personas ?? []).map((p) => [p.semantic_id, p]),
  );
  const metas = new Map(
    (output.output_metadata ?? []).map((m) => [m.semantic_id, m]),
  );
  const relations = new Map(
    output.reconciliation.map((r) => [r.candidate_ref, r]),
  );
  for (const r of current) {
    const segments = new ComponentPathCodec().decode(
      r.componentSemanticPath,
    ).segments;
    if (segments.at(-1)?.kind === "item") {
      const payload = r.currentComponentGeneration.valuePayload;
      if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        payload.semantic_id !==
          (segments.at(-1) as { semanticId: string }).semanticId
      )
        audienceInvalid("AUDIENCE_PERSISTED_ID_PATH_MISMATCH");
    }
  }
  for (const relation of output.reconciliation) {
    const p = emitted.get(relation.candidate_ref);
    if (!p) audienceInvalid("AUDIENCE_CANDIDATE_REF_UNKNOWN");
    if (relation.relationship === "NEW_PERSONA") {
      if (
        existing.has(p.semantic_id) ||
        relation.matched_persona_semantic_id !== null
      )
        audienceInvalid("AUDIENCE_NEW_ID_NOT_NEW");
    } else if (relation.relationship !== "POSSIBLE_MATCH") {
      if (
        !existing.has(p.semantic_id) ||
        relation.matched_persona_semantic_id !== p.semantic_id
      )
        audienceInvalid("AUDIENCE_EXACT_CONTINUITY_REQUIRED");
    } else if (
      relation.matched_persona_semantic_id !== null &&
      !existing.has(relation.matched_persona_semantic_id)
    )
      audienceInvalid("AUDIENCE_MATCH_NOT_CURRENT");
    const previous = current.find(
      (r) =>
        r.componentSemanticPath === `${personaPath(p.semantic_id)}/f/lifecycle`,
    );
    if (
      previous?.currentComponentGeneration.valuePayload === "SUPERSEDED" &&
      p.lifecycle !== "SUPERSEDED"
    )
      audienceInvalid("AUDIENCE_SUPERSEDED_REACTIVATION");
    const meta = metas.get(p.semantic_id)!.field_metadata.lifecycle;
    const previousMeta = audienceRecord(
      previous?.currentComponentGeneration.metadataPayload,
    );
    const sameLinks = (a: unknown, b: readonly string[] | undefined) =>
      (a === undefined || Array.isArray(a)) &&
      canonicalJson([...(Array.isArray(a) ? a : [])].sort()) ===
        canonicalJson([...(b ?? [])].sort());
    // Existing supersession lineage is immutable context, not a new merge/split.
    // Re-emitting it never requires creating its already-durable successors again.
    if (previous?.currentComponentGeneration.valuePayload === "SUPERSEDED") {
      if (
        !meta.superseded_by_ref?.length ||
        !sameLinks(previousMeta.superseded_by_ref, meta.superseded_by_ref) ||
        !sameLinks(previousMeta.supersedes_ref, meta.supersedes_ref)
      )
        audienceInvalid("AUDIENCE_HISTORICAL_LINEAGE_CHANGED");
      continue;
    }
    if (p.lifecycle === "SUPERSEDED") {
      if (!existing.has(p.semantic_id) || !meta.superseded_by_ref?.length)
        audienceInvalid("AUDIENCE_SUPERSESSION_LINEAGE_REQUIRED");
      for (const successor of meta.superseded_by_ref) {
        if (
          successor === p.semantic_id ||
          existing.has(successor) ||
          emitted.get(successor)?.lifecycle !== "ACTIVE" ||
          relations.get(successor)?.relationship !== "NEW_PERSONA" ||
          relation.relationship !== "SAME_PERSONA" ||
          !metas
            .get(successor)
            ?.field_metadata.lifecycle.supersedes_ref?.includes(p.semantic_id)
        )
          audienceInvalid("AUDIENCE_SUPERSESSION_NOT_RECIPROCAL");
      }
    } else if (meta.superseded_by_ref?.length)
      audienceInvalid("AUDIENCE_SUCCESSOR_WITHOUT_SUPERSESSION");
    for (const source of meta.supersedes_ref ?? []) {
      if (
        existing.has(p.semantic_id) &&
        sameLinks(previousMeta.supersedes_ref, meta.supersedes_ref)
      )
        continue;
      if (
        existing.has(p.semantic_id) ||
        p.lifecycle !== "ACTIVE" ||
        !existing.has(source) ||
        emitted.get(source)?.lifecycle !== "SUPERSEDED" ||
        !metas
          .get(source)
          ?.field_metadata.lifecycle.superseded_by_ref?.includes(p.semantic_id)
      )
        audienceInvalid("AUDIENCE_SUPERSESSION_NOT_RECIPROCAL");
    }
    if (
      previousMeta.supersedes_ref !== undefined &&
      !sameLinks(previousMeta.supersedes_ref, meta.supersedes_ref)
    )
      audienceInvalid("AUDIENCE_HISTORICAL_LINEAGE_CHANGED");
  }
}

import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";
import {
  audienceRecord as row,
  supportsAudience,
} from "../../processors/audience-persona/audience-persona-evidence";
import {
  AUDIENCE_LIST_FIELDS,
  AUDIENCE_CORE_DIMENSIONS,
} from "../../processors/audience-persona/audience-persona.types";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";

export class AudiencePersonaSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "audience_persona_synthesis";
  validate(
    output: Readonly<Record<string, unknown>>,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const fail = (code: string) =>
      issues.push({
        category: "SEMANTIC",
        code,
        message:
          "Audience output violates frozen identity, lineage, reconciliation or policy boundaries",
      });
    const personas = Array.isArray(output.audience_personas)
      ? output.audience_personas
      : [];
    const metas = Array.isArray(output.output_metadata)
      ? output.output_metadata
      : [];
    const relations = Array.isArray(output.reconciliation)
      ? output.reconciliation
      : [];
    if (
      (output.audience_personas === null) !==
      (output.output_metadata === null)
    )
      fail("AUDIENCE_METADATA_ALIGNMENT");
    const validId = (value: unknown) => {
      try {
        if (
          typeof value !== "string" ||
          !value.trim() ||
          value.startsWith("preview:")
        )
          return false;
        new ComponentPathCodec().encode([{ kind: "item", semanticId: value }]);
        return true;
      } catch {
        return false;
      }
    };
    const ids = personas.map((p) => row(p).semantic_id);
    if (new Set(ids).size !== ids.length || ids.some((id) => !validId(id)))
      fail("AUDIENCE_INVALID_SEMANTIC_ID");
    const metaIds = metas.map((m) => row(m).semantic_id);
    const relationIds = relations.map((r) => row(r).candidate_ref);
    if (
      metaIds.length !== ids.length ||
      relationIds.length !== ids.length ||
      ids.some(
        (id) =>
          metaIds.filter((m) => m === id).length !== 1 ||
          relationIds.filter((r) => r === id).length !== 1,
      )
    )
      fail("AUDIENCE_RECONCILIATION_ALIGNMENT");
    const metadata = (value: unknown) => {
      const m = row(value);
      if (
        !["OBSERVED", "CREATOR_SHOP_DERIVED"].includes(String(m.authority)) ||
        !["OWNED_WEBSITE", "MULTI_SOURCE"].includes(String(m.source_class)) ||
        !["CURRENT", "STALE", "UNKNOWN"].includes(String(m.freshness))
      )
        fail("AUDIENCE_METADATA_AUTHORITY_OR_FRESHNESS");
      const refs = Array.isArray(m.evidence_refs) ? m.evidence_refs : [];
      if (
        !refs.length ||
        new Set(refs).size !== refs.length ||
        refs.some((ref) => typeof ref !== "string") ||
        !context.evidenceManifest.some(
          (entry) =>
            refs.includes(entry.evidenceRef) && supportsAudience(entry),
        )
      )
        fail("AUDIENCE_NON_ESTABLISHING_LINEAGE");
      for (const key of ["supersedes_ref", "superseded_by_ref"]) {
        const links = m[key];
        if (
          links !== undefined &&
          (!Array.isArray(links) ||
            !links.length ||
            new Set(links).size !== links.length ||
            links.some((id) => !validId(id)))
        )
          fail("AUDIENCE_SUPERSESSION_LINKS_INVALID");
      }
    };
    for (const value of personas) {
      const p = row(value);
      if (![p.label, p.summary].every((v) => typeof v === "string" && v.trim()))
        fail("AUDIENCE_CORE_REQUIRED");
      if (
        p.lifecycle === "ACTIVE" &&
        !AUDIENCE_CORE_DIMENSIONS.some(
          (field) => Array.isArray(p[field]) && p[field].length > 0,
        )
      )
        fail("AUDIENCE_DECISION_CONTEXT_REQUIRED");
      if (p.demographic_context != null)
        fail("AUDIENCE_DEMOGRAPHIC_POLICY_UNAVAILABLE");
      if (
        p.geography_context != null &&
        /serviceability|shipping|availability|feasibility|location_id|campaign/iu.test(
          JSON.stringify(p.geography_context),
        )
      )
        fail("AUDIENCE_GEOGRAPHY_BOUNDARY");
      const meta = row(metas.find((m) => row(m).semantic_id === p.semantic_id));
      const fields = row(meta.field_metadata);
      const items = row(meta.item_metadata);
      for (const [field, fieldValue] of Object.entries(p)) {
        if (field === "semantic_id") continue;
        metadata(fields[field]);
        if (
          !AUDIENCE_LIST_FIELDS.includes(
            field as (typeof AUDIENCE_LIST_FIELDS)[number],
          )
        )
          continue;
        const values = Array.isArray(fieldValue) ? fieldValue : [];
        const nestedIds = values.map((v) => row(v).semantic_id);
        if (
          new Set(nestedIds).size !== nestedIds.length ||
          nestedIds.some((id) => !validId(id))
        )
          fail("AUDIENCE_DUPLICATE_ITEM_ID");
        const itemMeta = row(items[field]);
        if (Object.keys(itemMeta).length !== nestedIds.length)
          fail("AUDIENCE_ITEM_METADATA_ALIGNMENT");
        for (const item of values) {
          const v = row(item);
          if (typeof v.value !== "string" || !v.value.trim())
            fail("AUDIENCE_BLANK_ITEM_VALUE");
          metadata(itemMeta[String(v.semantic_id)]);
          if (
            field === "creator_communication_implications" &&
            /\b(CTA|deliverables?|campaign target|creator count|channel selection)\b/iu.test(
              String(v.value),
            )
          )
            fail("AUDIENCE_CAMPAIGN_BOUNDARY");
        }
      }
      if (
        Object.keys(fields).some(
          (field) => !(field in p) || field === "semantic_id",
        )
      )
        fail("AUDIENCE_UNKNOWN_FIELD_METADATA");
      if (
        Object.keys(items).some(
          (field) =>
            !AUDIENCE_LIST_FIELDS.includes(
              field as (typeof AUDIENCE_LIST_FIELDS)[number],
            ) || !(field in p),
        )
      )
        fail("AUDIENCE_UNKNOWN_ITEM_METADATA");
    }
    for (const value of relations) {
      const r = row(value);
      if (r.origin_preview_group_ref != null)
        fail("AUDIENCE_PREVIEW_CONTEXT_NOT_SUPPLIED");
      if (
        r.matched_persona_semantic_id !== null &&
        !validId(r.matched_persona_semantic_id)
      )
        fail("AUDIENCE_INVALID_MATCH_ID");
    }
    return issues;
  }
}

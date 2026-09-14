import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";
import { visualEvidenceSupport } from "../../input/evidence/visual-evidence-admission";
import {
  VISUAL_IMAGERY_FIELDS,
  type VisualStyleOutput,
  type VisualStyleMetadata,
  type VisualStyleItemMetadata,
} from "../../processors/visual-style/visual-style.types";

const record = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

function instagramVisualSupport(
  item: SemanticValidationContext["evidenceManifest"][number] | undefined,
): boolean {
  if (
    !item ||
    item.capabilityId !== "instagram.media_visual_observations" ||
    item.sourceClass !== "INSTAGRAM_OWNED" ||
    item.freshness !== "CURRENT" ||
    item.polarity === "EXPLICIT_NEGATIVE" ||
    item.conflictGroupRef
  )
    return false;
  const payload = record(item.normalizedPayload);
  const semantic = record(payload?.semanticPayload) ?? payload;
  const inspection = record(semantic?.inspection);
  const executions = record(semantic?.visualExecutions);
  return (
    inspection?.depth !== "NOT_INSPECTED" &&
    (inspection !== undefined || Array.isArray(executions?.values))
  );
}

/** Grounded DOM-only MVP. No aesthetic inference from absent rendering or image presence. */
export class VisualStyleSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "visual_style_synthesis";
  validate(
    raw: Readonly<Record<string, unknown>>,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const output = raw as unknown as VisualStyleOutput;
    const issues: ValidationIssue[] = [];
    const issue = (code: string) =>
      issues.push({ category: "SEMANTIC", code, message: code });
    const profile = output.visual_style_profile,
      metadata = output.output_metadata;
    if (
      profile?.visual_constraints != null ||
      metadata.visual_constraints !== null
    )
      issue("VISUAL_GENERATED_CONSTRAINT_FORBIDDEN");
    const evidence = new Map(
      context.evidenceManifest.map((e) => [e.evidenceRef, e]),
    );
    const check = (
      value: string,
      meta: VisualStyleMetadata,
      graphic = false,
    ) => {
      if (!value.trim()) issue("VISUAL_BLANK_DESCRIPTION");
      if (meta.authority !== "CREATOR_SHOP_DERIVED")
        issue("VISUAL_INTERPRETATION_AUTHORITY");
      const supportEntries = meta.evidence_refs.map((ref) => evidence.get(ref));
      const instagram =
        supportEntries.length >= 3 &&
        supportEntries.every((entry) => instagramVisualSupport(entry));
      if (
        !["OWNED_WEBSITE", "MULTI_SOURCE"].includes(meta.source_class) &&
        !(instagram && String(meta.source_class) === "INSTAGRAM_OWNED")
      )
        issue("VISUAL_SOURCE_CLASS");
      if (
        meta.confidence != null &&
        !["MEDIUM", "LOW"].includes(meta.confidence)
      )
        issue("VISUAL_RENDERING_CONFIDENCE_ELEVATION");
      if (meta.freshness !== "CURRENT") issue("VISUAL_FRESHNESS_MISMATCH");
      const support = supportEntries.map((entry) =>
        entry ? visualEvidenceSupport(entry) : undefined,
      );
      if (!instagram && (!support.length || support.some((entry) => !entry)))
        issue("VISUAL_INSUFFICIENT_COMPONENT_SUPPORT");
      if (
        new Set(meta.evidence_refs).size !== meta.evidence_refs.length ||
        new Set(meta.business_state_refs ?? []).size !==
          (meta.business_state_refs ?? []).length
      )
        issue("VISUAL_DUPLICATE_REFERENCE");
      if (
        !instagram &&
        graphic &&
        support.some(
          (e) => e?.evidence_semantic !== "LAYOUT_OR_COMPOSITION_OBSERVATION",
        )
      )
        issue("VISUAL_GRAPHIC_SUPPORT_REQUIRED");
      // Attribution is mandatory because these observations are declarations, not computed pixels.
      if (
        !instagram &&
        !/\b(source.declared|source declarations?|retained (DOM|source))\b/iu.test(
          value,
        )
      )
        issue("VISUAL_DECLARATION_ATTRIBUTION_REQUIRED");
      const universalUnsupported =
        /\b(must|never|always|required|mandatory|approved|canonical (logo|palette|font)|brand.confirmed|guarantee|clinically|efficacy|safer|superior|premium|luxurious|stunning|award.winning|shot list|call.to.action|campaign)\b|https?:\/\//iu.test(
          value,
        );
      const websiteOnlyUnsupported =
        /\b(computed|rendered|photograph\w*|imagery|mood|lighting|camera)\b|\b(no|without|absent|lacks?)\s+(images?|colou?rs?|fonts?|overlays?|graphics?)\b|#[a-f0-9]{3,8}\b/iu.test(
          value,
        );
      if (universalUnsupported || (!instagram && websiteOnlyUnsupported))
        issue("VISUAL_UNSUPPORTED_OR_PRESCRIPTIVE_INTERPRETATION");
      if (/\b(external stylesheet|external css)\b/iu.test(value))
        issue("VISUAL_UNRETAINED_STYLESHEET_INFERENCE");
    };
    const list = (
      items:
        | readonly { semantic_id: string; trait?: string; value?: string }[]
        | null
        | undefined,
      metas: readonly VisualStyleItemMetadata[] | null | undefined,
      graphic = false,
      imagery = false,
    ) => {
      if ((items == null) !== (metas == null))
        issue("VISUAL_METADATA_ALIGNMENT");
      const ids = (items ?? []).map((i) => i.semantic_id),
        metaIds = (metas ?? []).map((m) => m.semantic_id);
      if (
        ids.some((id) => !id.trim()) ||
        new Set(ids).size !== ids.length ||
        new Set(metaIds).size !== metaIds.length
      )
        issue("VISUAL_DUPLICATE_OR_BLANK_ID");
      if (
        ids.length !== metaIds.length ||
        ids.some((id) => !metaIds.includes(id))
      )
        issue("VISUAL_METADATA_ALIGNMENT");
      const refs = (metas ?? []).flatMap((meta) => meta.evidence_refs);
      const instagram =
        refs.length >= 3 &&
        refs.every((ref) => instagramVisualSupport(evidence.get(ref)));
      if (imagery && items?.length && !instagram)
        issue("VISUAL_IMAGERY_SEMANTICS_UNOBSERVED");
      for (const item of items ?? []) {
        const meta = metas?.find((m) => m.semantic_id === item.semantic_id);
        if (meta) check(item.trait ?? item.value ?? "", meta, graphic);
      }
    };
    if ((profile?.summary == null) !== (metadata.summary == null))
      issue("VISUAL_METADATA_ALIGNMENT");
    if (profile?.summary != null && metadata.summary)
      check(profile.summary, metadata.summary);
    list(profile?.style_traits, metadata.style_traits);
    if ((profile?.imagery_style == null) !== (metadata.imagery_style == null))
      issue("VISUAL_METADATA_ALIGNMENT");
    for (const field of VISUAL_IMAGERY_FIELDS)
      list(
        profile?.imagery_style?.[field],
        metadata.imagery_style?.[field],
        false,
        true,
      );
    if (
      (profile?.graphic_treatment == null) !==
      (metadata.graphic_treatment == null)
    )
      issue("VISUAL_METADATA_ALIGNMENT");
    list(
      profile?.graphic_treatment?.traits,
      metadata.graphic_treatment?.traits,
      true,
    );
    return issues;
  }
}

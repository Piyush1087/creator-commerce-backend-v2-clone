import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  EvidenceManifestEntry,
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";
import type {
  DifferentiationMetadata,
  DifferentiationOutput,
  ProofMetadata,
} from "../../processors/brand-differentiation/brand-differentiation.types";

const record = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
const highRisk = new Set([
  "TREATMENT_EFFICACY",
  "DIAGNOSTIC_ACCURACY",
  "CLINICAL_SUPERIORITY",
  "GUARANTEED_OUTCOME",
  "GUARANTEED_OUTCOME_LANGUAGE",
  "MEDICAL_SUCCESS_RATE",
  "SAFETY_CLAIM",
  "TESTIMONIAL",
  "BRAND_AUTHORED_CLAIM",
]);
const unsafeText =
  /\b(best|leading|leader|most trusted|unique|unmatched|superior|fastest|premium|clinically proven|cures?|efficacy|success rate|survival rate|guaranteed?|risk.free|safe|safety|diagnostic accuracy|market share|award.winning|ranked)\b|\d+\s*%/iu;

function brandScope(item: EvidenceManifestEntry): boolean {
  const p = record(item.normalizedPayload);
  if (!Object.keys(p).length || item.polarity === "EXPLICIT_NEGATIVE")
    return false;
  const scope = p.scope ?? p.subject_scope ?? p.generalization_scope;
  if (
    ["OFFERING_SPECIFIC", "SINGLE_OFFERING", "CONTEXT_SPECIFIC"].includes(
      String(scope),
    )
  )
    return false;
  if (
    item.capabilityId === "owned_website.offering_context" ||
    scope === "MULTI_OFFERING" ||
    scope === "MULTIPLE_OFFERINGS"
  )
    return (
      item.representativeness === "REPEATED_REPRESENTATIVE" &&
      [
        "MULTI_OFFERING",
        "MULTIPLE_OFFERINGS",
        "BRAND_LEVEL_PORTFOLIO",
      ].includes(String(scope))
    );
  return ["PERSISTENT_BRAND_LEVEL", "REPEATED_REPRESENTATIVE"].includes(
    item.representativeness ?? "",
  );
}
function eligibleProof(item: EvidenceManifestEntry): boolean {
  const p = record(item.normalizedPayload);
  return (
    item.capabilityId === "explicit_factual_proof_or_claim_evidence" &&
    brandScope(item) &&
    p.authorship === "BRAND_AUTHORED" &&
    p.verification_status === "NOT_EXTERNALLY_VERIFIED" &&
    [
      "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
      "REGULATORY_OR_CREDENTIAL_STATEMENT",
    ].includes(String(p.proof_class)) &&
    [
      "DIRECT_FIRST_PARTY_FACT",
      "OBSERVABLE_CAPABILITY",
      "EXPLICIT_CERTIFICATION_OR_CREDENTIAL",
    ].includes(String(p.proof_strength)) &&
    Array.isArray(p.claim_sensitivity) &&
    !p.claim_sensitivity.some((s) => highRisk.has(String(s))) &&
    typeof p.statement === "string" &&
    !unsafeText.test(p.statement)
  );
}

/** First-party safety/admission checks. No semantic-ID guessing or similarity matching. */
export class BrandDifferentiationSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "brand_differentiation";
  validate(
    raw: Readonly<Record<string, unknown>>,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    // The shared pipeline runs frozen structural validation first.
    const output = raw as unknown as DifferentiationOutput;
    const issues: ValidationIssue[] = [];
    const issue = (code: string) =>
      issues.push({ category: "SEMANTIC", code, message: code });
    const items = output.differentiation_and_proof;
    const metadata = output.output_metadata;
    if ((items === null) !== (metadata === null))
      issue("DIFFERENTIATION_METADATA_ALIGNMENT");
    if (!items || !metadata) return issues;
    const unique = (ids: readonly string[]) => {
      if (ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
        issue("DIFFERENTIATION_DUPLICATE_OR_BLANK_ID");
    };
    const align = (ids: readonly string[], metaIds: readonly string[]) => {
      unique(ids);
      unique(metaIds);
      if (
        ids.length !== metaIds.length ||
        ids.some((id) => !metaIds.includes(id))
      )
        issue("DIFFERENTIATION_METADATA_ALIGNMENT");
    };
    align(
      items.map((d) => d.semantic_id),
      metadata.map((m) => m.semantic_id),
    );
    const evidence = new Map(
      context.evidenceManifest.map((e) => [e.evidenceRef, e]),
    );
    const checkMeta = (meta: DifferentiationMetadata) => {
      const support = meta.evidence_refs.flatMap((ref) =>
        evidence.has(ref) ? [evidence.get(ref)!] : [],
      );
      if (
        !meta.evidence_refs.length ||
        new Set(meta.evidence_refs).size !== meta.evidence_refs.length
      )
        issue("DIFFERENTIATION_INVALID_REFS");
      if (
        meta.business_state_refs &&
        new Set(meta.business_state_refs).size !==
          meta.business_state_refs.length
      )
        issue("DIFFERENTIATION_INVALID_BUSINESS_REFS");
      if (
        meta.confidence != null &&
        !["HIGH", "MEDIUM", "LOW"].includes(meta.confidence)
      )
        issue("DIFFERENTIATION_INVALID_CONFIDENCE");
      if (
        support.some(
          (e) =>
            !record(e.normalizedPayload) ||
            !Object.keys(record(e.normalizedPayload)).length,
        )
      )
        issue("DIFFERENTIATION_UNUSABLE_EVIDENCE");
      const expectedFreshness = support.some(
        (e) => e.freshness === "POSSIBLY_STALE",
      )
        ? "STALE"
        : support.some((e) => e.freshness !== "CURRENT")
          ? "UNKNOWN"
          : "CURRENT";
      if (meta.freshness === "CURRENT" && expectedFreshness !== "CURRENT")
        issue("DIFFERENTIATION_FRESHNESS_ELEVATION");
      if (
        meta.source_class !== "MULTI_SOURCE" &&
        support.some((e) => e.sourceClass !== meta.source_class)
      )
        issue("DIFFERENTIATION_SOURCE_CLASS_MISMATCH");
      return support;
    };
    const allProofRefs = new Set(
      metadata.flatMap((m) =>
        (m.proof_point_metadata ?? []).flatMap((p) => p.evidence_refs),
      ),
    );
    for (const d of items) {
      const meta = metadata.find((m) => m.semantic_id === d.semantic_id);
      if (!meta) continue;
      if (
        !d.differentiator.trim() ||
        unsafeText.test(d.differentiator) ||
        /\b(campaign|limited.time|this week)\b/iu.test(d.differentiator)
      )
        issue("DIFFERENTIATION_UNSUPPORTED_CLAIM");
      // This executor synthesizes strategic meaning; a sourced fact is not an observed strategy.
      if (meta.differentiator_metadata.authority !== "CREATOR_SHOP_DERIVED")
        issue("DIFFERENTIATION_STRATEGY_AUTHORITY");
      const support = checkMeta(meta.differentiator_metadata);
      if (!support.some(brandScope))
        issue("DIFFERENTIATION_OFFERING_NOT_BRAND_TRUTH");
      if (
        support.some(
          (e) =>
            unsafeText.test(
              String(
                record(e.normalizedPayload).statement ??
                  record(e.normalizedPayload).statement_text ??
                  record(e.normalizedPayload).text_or_normalized_message ??
                  record(e.normalizedPayload).observed_context ??
                  "",
              ),
            ) ||
            [
              "CLAIM_REQUIRING_EXTERNAL_VERIFICATION",
              "REGULATORY_OR_CREDENTIAL_STATEMENT",
              "TESTIMONIAL_OR_SOCIAL_PROOF",
              "OTHER_BOUNDED_PROOF_CONTEXT",
            ].includes(String(record(e.normalizedPayload).proof_class)) ||
            (Array.isArray(record(e.normalizedPayload).claim_sensitivity) &&
              (record(e.normalizedPayload).claim_sensitivity as unknown[]).some(
                (sensitivity) => highRisk.has(String(sensitivity)),
              )),
        )
      )
        issue("DIFFERENTIATION_UNSAFE_REASONING_BASIS");
      // Conflicts may remain as attributed proof observations, never as an unqualified strategic basis.
      if (support.some((e) => e.conflictGroupRef))
        issue("DIFFERENTIATION_CONFLICTED_REASONING_BASIS");
      if ((d.proof_points === null) !== (meta.proof_point_metadata === null))
        issue("DIFFERENTIATION_PROOF_METADATA_ALIGNMENT");
      const proofs = d.proof_points ?? [];
      const proofMetas = meta.proof_point_metadata ?? [];
      align(
        proofs.map((p) => p.semantic_id),
        proofMetas.map((p) => p.semantic_id),
      );
      for (const p of proofs) {
        const pm = proofMetas.find((m) => m.semantic_id === p.semantic_id);
        if (!pm) continue;
        this.checkProof(
          p.statement,
          pm,
          checkMeta(pm),
          context,
          allProofRefs,
          issue,
        );
      }
    }
    return issues;
  }
  private checkProof(
    statement: string,
    meta: ProofMetadata,
    support: readonly EvidenceManifestEntry[],
    context: SemanticValidationContext,
    allProofRefs: ReadonlySet<string>,
    issue: (code: string) => void,
  ): void {
    if (
      !statement.trim() ||
      !support.length ||
      support.some((e) => !eligibleProof(e))
    )
      issue("DIFFERENTIATION_INELIGIBLE_PROOF");
    if (meta.authority !== "OBSERVED")
      issue("DIFFERENTIATION_DIRECT_PROOF_AUTHORITY");
    for (const item of support) {
      const p = record(item.normalizedPayload);
      // Conservative grounding: no lexical-overlap score can establish factual entailment.
      const attributed = `Owned website states: ${String(p.statement)}`;
      if (statement !== p.statement && statement !== attributed)
        issue("DIFFERENTIATION_PROOF_NOT_SUPPORTED_BY_REF");
      if (
        meta.proof_strength !== p.proof_strength ||
        meta.proof_strength === "VERIFIED_BUSINESS_FACT"
      )
        issue("DIFFERENTIATION_VERIFICATION_ELEVATION");
      if (
        (p.proof_class === "REGULATORY_OR_CREDENTIAL_STATEMENT" ||
          item.conflictGroupRef) &&
        statement !== attributed
      )
        issue("DIFFERENTIATION_OCCURRENCE_ATTRIBUTION_REQUIRED");
      if (
        item.conflictGroupRef &&
        context.evidenceManifest.some(
          (other) =>
            other.conflictGroupRef === item.conflictGroupRef &&
            !allProofRefs.has(other.evidenceRef),
        )
      )
        issue("DIFFERENTIATION_SILENT_CONFLICT_WINNER");
    }
  }
}

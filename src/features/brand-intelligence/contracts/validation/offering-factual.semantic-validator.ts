import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";
import {
  OFFERING_FACTUAL_COLLECTIONS,
  OFFERING_FACTUAL_FAMILIES,
} from "../../processors/offering-factual/offering-factual.types";

type JsonRecord = Readonly<Record<string, unknown>>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function issue(
  code: string,
  message: string,
  componentPath?: string,
): ValidationIssue {
  return { category: "SEMANTIC", code, message, componentPath };
}

function refs(value: unknown): readonly string[] {
  const metadata = record(value);
  return [
    ...(Array.isArray(metadata?.evidence_refs)
      ? metadata.evidence_refs.filter(
          (item): item is string => typeof item === "string",
        )
      : []),
    ...(Array.isArray(metadata?.business_state_refs)
      ? metadata.business_state_refs.filter(
          (item): item is string => typeof item === "string",
        )
      : []),
  ];
}

const HIGH_RISK =
  /\b(cures?|treats?|treatment efficacy|clinically proven|clinical(?:ly)? superior|guaranteed|100%|success rate|survival rate|safe|safety|risk[- ]?free|side effects?|best|leading|number one|#1|superior|fastest)\b/iu;

export class OfferingFactualSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "offering_factual_synthesis";

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const profile = record(output.offering_factual_profile);
    const metadata = record(output.output_metadata) ?? {};
    if (!profile) {
      for (const family of OFFERING_FACTUAL_FAMILIES) {
        if (metadata[family] !== null) {
          issues.push(
            issue(
              "METADATA_WITHOUT_SEMANTIC_VALUE",
              "A null factual profile cannot carry family metadata",
              `$/f/${family}`,
            ),
          );
        }
      }
      return issues;
    }

    const summary = profile.factual_summary;
    if ((summary == null) !== (metadata.factual_summary === null)) {
      issues.push(
        issue(
          "METADATA_ALIGNMENT",
          "Factual summary and metadata must be null together",
          "$/f/factual_summary",
        ),
      );
    }
    if (typeof summary === "string") {
      this.validateGrounding(
        summary,
        metadata.factual_summary,
        issues,
        "$/f/factual_summary",
      );
    }

    for (const family of OFFERING_FACTUAL_COLLECTIONS) {
      const value = profile[family];
      const familyMetadata = metadata[family];
      if ((value == null) !== (familyMetadata === null)) {
        issues.push(
          issue(
            "METADATA_ALIGNMENT",
            "Factual collection and metadata must be null together",
            `$/f/${family}`,
          ),
        );
        continue;
      }
      if (!Array.isArray(value) || !Array.isArray(familyMetadata)) continue;
      const ids = value.map((item) => record(item)?.semantic_id);
      const metadataIds = familyMetadata.map(
        (item) => record(item)?.semantic_id,
      );
      if (
        ids.some(
          (id) =>
            typeof id !== "string" ||
            !id.trim() ||
            /^\d+$/u.test(id) ||
            /^(preview|provider|gemini|openai|anthropic):/iu.test(id),
        ) ||
        new Set(ids).size !== ids.length
      ) {
        issues.push(
          issue(
            "INVALID_SEMANTIC_ITEM_ID",
            "Offering factual items require unique durable meaning-based IDs",
            `$/f/${family}`,
          ),
        );
      }
      if (
        ids.length !== metadataIds.length ||
        ids.some(
          (id) =>
            metadataIds.filter((candidate) => candidate === id).length !== 1,
        )
      ) {
        issues.push(
          issue(
            "SEMANTIC_ITEM_METADATA_MISMATCH",
            "Every factual item requires exactly one metadata item with the same semantic ID",
            `$/f/${family}`,
          ),
        );
      }
      for (const item of value) {
        const itemRecord = record(item);
        const id = itemRecord?.semantic_id;
        const itemMetadata = familyMetadata.find(
          (candidate) => record(candidate)?.semantic_id === id,
        );
        const text = Object.entries(itemRecord ?? {}).find(
          ([key, candidate]) =>
            key !== "semantic_id" && typeof candidate === "string",
        )?.[1];
        if (typeof text !== "string") continue;
        const path = `$/f/${family}/i/${String(id)}`;
        this.validateGrounding(text, itemMetadata, issues, path);
        if (
          (family === "key_benefits" || family === "proof_points") &&
          HIGH_RISK.test(text)
        ) {
          issues.push(
            issue(
              "UNSUPPORTED_HIGH_RISK_CLAIM",
              "Regulated, efficacy, safety, success, or superiority claims fail closed",
              path,
            ),
          );
        }
        if (family === "proof_points") {
          this.validateProof(itemMetadata, context, issues, path);
        }
      }
    }
    return issues;
  }

  private validateGrounding(
    text: string,
    metadata: unknown,
    issues: ValidationIssue[],
    path: string,
  ): void {
    if (!text.trim() || refs(metadata).length === 0) {
      issues.push(
        issue(
          "MISSING_LINEAGE",
          "Every non-null factual semantic requires exact Evidence or business-state lineage",
          path,
        ),
      );
    }
  }

  private validateProof(
    metadata: unknown,
    context: SemanticValidationContext,
    issues: ValidationIssue[],
    path: string,
  ): void {
    const evidenceRefs = Array.isArray(record(metadata)?.evidence_refs)
      ? (record(metadata)!.evidence_refs as unknown[]).filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    const support = context.evidenceManifest.filter((entry) =>
      evidenceRefs.includes(entry.evidenceRef),
    );
    const qualifying = support.some((entry) => {
      const payload = record(entry.normalizedPayload);
      const sensitivities = Array.isArray(payload?.claim_sensitivity)
        ? payload.claim_sensitivity
        : [];
      return (
        entry.capabilityId === "explicit_factual_proof_or_claim_evidence" &&
        payload?.proof_strength === "DIRECT_FIRST_PARTY_FACT" &&
        payload.proof_class === "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT" &&
        payload.verification_status === "NOT_EXTERNALLY_VERIFIED" &&
        sensitivities.length === 0
      );
    });
    if (!qualifying) {
      issues.push(
        issue(
          "INSUFFICIENT_PROOF_SUPPORT",
          "Proof points require bounded direct same-Offering factual support; testimonials, claims, and credential occurrence are insufficient",
          path,
        ),
      );
    }
  }
}

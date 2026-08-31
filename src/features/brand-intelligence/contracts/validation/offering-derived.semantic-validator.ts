import type { ProcessorSemanticValidator } from "./semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "./validation.types";

type JsonRecord = Readonly<Record<string, unknown>>;
const record = (value: unknown): JsonRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
const issue = (
  code: string,
  message: string,
  componentPath?: string,
): ValidationIssue => ({
  category: "SEMANTIC",
  code,
  message,
  componentPath,
});
const refs = (metadata: unknown, key: string): string[] => {
  const value = record(metadata)?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

abstract class OfferingCollectionValidator implements ProcessorSemanticValidator {
  abstract readonly validatorId: string;
  abstract readonly profileField: string;
  abstract readonly families: readonly string[];

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const profile = record(output[this.profileField]);
    const metadata = record(output.output_metadata) ?? {};
    if (!profile) {
      for (const family of this.families) {
        if (metadata[family] !== null) {
          issues.push(
            issue(
              "METADATA_WITHOUT_SEMANTIC_VALUE",
              "A null profile cannot carry family metadata",
              `$/f/${family}`,
            ),
          );
        }
      }
      return issues;
    }
    for (const family of this.families) {
      const values = profile[family];
      const familyMetadata = metadata[family];
      if ((values == null) !== (familyMetadata === null)) {
        issues.push(
          issue(
            "METADATA_ALIGNMENT",
            "Semantic collection and metadata must be null together",
            `$/f/${family}`,
          ),
        );
        continue;
      }
      if (!Array.isArray(values) || !Array.isArray(familyMetadata)) continue;
      const ids = values.map((item) => record(item)?.semantic_id);
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
            "Items require unique durable meaning-based IDs",
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
            "Every item requires exactly one metadata item with the same semantic ID",
            `$/f/${family}`,
          ),
        );
      }
      values.forEach((item, index) => {
        const itemRecord = record(item);
        const id = itemRecord?.semantic_id;
        const itemMetadata = familyMetadata.find(
          (candidate) => record(candidate)?.semantic_id === id,
        );
        const text = Object.entries(itemRecord ?? {}).find(
          ([key, value]) => key !== "semantic_id" && typeof value === "string",
        )?.[1];
        const path = `$/f/${family}/i/${String(id ?? index)}`;
        if (typeof text === "string")
          this.validateItem(family, text, itemMetadata, context, issues, path);
      });
    }
    return issues;
  }

  protected requireLineage(
    metadata: unknown,
    issues: ValidationIssue[],
    path: string,
  ): void {
    if (
      refs(metadata, "evidence_refs").length +
        refs(metadata, "business_state_refs").length ===
      0
    ) {
      issues.push(
        issue(
          "MISSING_LINEAGE",
          "Every emitted item requires exact-subject Evidence or business-state lineage",
          path,
        ),
      );
    }
  }

  protected abstract validateItem(
    family: string,
    text: string,
    metadata: unknown,
    context: SemanticValidationContext,
    issues: ValidationIssue[],
    path: string,
  ): void;
}

export class OfferingCreatorCommunicationSemanticValidator extends OfferingCollectionValidator {
  readonly validatorId = "offering_creator_communication";
  readonly profileField = "offering_creator_communication_profile";
  readonly families = ["creator_talking_points", "communication_constraints"];

  protected validateItem(
    family: string,
    text: string,
    metadata: unknown,
    context: SemanticValidationContext,
    issues: ValidationIssue[],
    path: string,
  ): void {
    this.requireLineage(metadata, issues, path);
    if (family === "creator_talking_points") {
      if (
        /\b(CTA|call to action|campaign objective|target audience|deliverable|post (on|by)|caption:|script:|use this exact copy|limited time|act now|buy now)\b/iu.test(
          text,
        )
      ) {
        issues.push(
          issue(
            "FINAL_CAMPAIGN_COPY_FORBIDDEN",
            "Talking points must remain reusable ingredients, not final campaign copy",
            path,
          ),
        );
      }
      if (
        /\b(cures?|clinically proven|guaranteed|risk[- ]?free|best|#1|superior|success rate|safe)\b/iu.test(
          text,
        )
      ) {
        const evidence = new Set(refs(metadata, "evidence_refs"));
        const supported = context.evidenceManifest.some(
          (entry) =>
            evidence.has(entry.evidenceRef) &&
            entry.capabilityId === "explicit_factual_proof_or_claim_evidence" &&
            record(entry.normalizedPayload)?.proof_strength ===
              "DIRECT_FIRST_PARTY_FACT",
        );
        if (!supported)
          issues.push(
            issue(
              "INSUFFICIENT_CLAIM_SUPPORT",
              "Claim-sensitive talking points require approved exact-Offering proof",
              path,
            ),
          );
      }
    } else if (
      !/\b(do not|don't|avoid|must not|never|cannot|claim|say|describe)\b/iu.test(
        text,
      )
    ) {
      issues.push(
        issue(
          "DESCRIPTIVE_PATTERN_NOT_CONSTRAINT",
          "Ordinary repeated or descriptive language cannot become a hard constraint",
          path,
        ),
      );
    }
  }
}

export class OfferingActionabilitySemanticValidator extends OfferingCollectionValidator {
  readonly validatorId = "offering_actionability_synthesis";
  readonly profileField = "offering_actionability_profile";
  readonly families = ["customer_action", "commercial_context"];

  protected validateItem(
    family: string,
    text: string,
    metadata: unknown,
    _context: SemanticValidationContext,
    issues: ValidationIssue[],
    path: string,
  ): void {
    this.requireLineage(metadata, issues, path);
    if (
      /\b(in stock|inventory|ships? (to|everywhere)|delivery available|appointment slots?|checkout available|nationwide|worldwide|free shipping|guaranteed availability)\b/iu.test(
        text,
      )
    ) {
      issues.push(
        issue(
          "INVENTED_ACTIONABILITY",
          "Actionability cannot invent inventory, fulfilment, availability, slots, or geography",
          path,
        ),
      );
    }
    if (
      family === "commercial_context" &&
      /\b(starting price label|legacy price|priceAmount)\b/iu.test(text)
    ) {
      issues.push(
        issue(
          "LEGACY_PRICE_FORBIDDEN",
          "Commercial context cannot use legacy price fields as canonical truth",
          path,
        ),
      );
    }
  }
}

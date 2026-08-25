import { Injectable } from "@nestjs/common";

import type { VerifiedContractBundle } from "../bundle/contract-bundle.types";
import { accepted, rejected } from "./validation-result";
import type {
  SemanticValidationContext,
  ValidationIssue,
  ValidationResult,
} from "./validation.types";

type JsonRecord = Readonly<Record<string, unknown>>;

export interface ProcessorSemanticValidator {
  readonly validatorId: string;
  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[];
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function semanticIssue(
  code: string,
  message: string,
  componentPath?: string,
): ValidationIssue {
  return { category: "SEMANTIC", code, componentPath, message };
}

function walk(
  value: unknown,
  visitor: (recordValue: JsonRecord, path: string) => void,
  path = "$",
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${path}/${index}`));
    return;
  }
  const object = record(value);
  if (!object) return;
  visitor(object, path);
  for (const [key, nested] of Object.entries(object)) {
    walk(nested, visitor, `${path}/${key}`);
  }
}

function metadataRefs(metadata: JsonRecord | undefined): {
  evidenceRefs: string[];
  businessStateRefs: string[];
} {
  return {
    evidenceRefs: Array.isArray(metadata?.evidence_refs)
      ? metadata.evidence_refs.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    businessStateRefs: Array.isArray(metadata?.business_state_refs)
      ? metadata.business_state_refs.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

function capabilityIds(bundle: VerifiedContractBundle): Set<string> {
  const evidence = bundle.artifacts.evidenceContract;
  const sections = [
    record(evidence.capabilities),
    record(evidence.optional_enrichment),
  ];
  return new Set(sections.flatMap((section) => Object.keys(section ?? {})));
}

class BrandMeaningSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "brand_meaning";

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const metadata = record(output.output_metadata) ?? {};
    const values: string[] = [];
    for (const objectId of [
      "brand_description",
      "positioning",
      "value_proposition",
    ]) {
      const value = output[objectId];
      const meta = metadata[objectId];
      if ((value === null) !== (meta === null)) {
        issues.push(
          semanticIssue(
            "METADATA_ALIGNMENT",
            "Null and non-null semantic values must align with metadata",
            `$/f/${objectId}`,
          ),
        );
      }
      if (typeof value === "string") {
        values.push(value.trim().toLocaleLowerCase());
        const refs = metadataRefs(record(meta));
        const support = context.evidenceManifest.filter((item) =>
          refs.evidenceRefs.includes(item.evidenceRef),
        );
        if (
          support.length > 0 &&
          support.every(
            (item) =>
              item.capabilityId === "owned_website.offering_context" &&
              (item.generalizationScope === "SINGLE_OFFERING" ||
                (![
                  "PERSISTENT_BRAND_LEVEL",
                  "REPEATED_REPRESENTATIVE",
                ].includes(item.representativeness ?? "") &&
                  item.generalizationScope !== "BRAND_LEVEL_PORTFOLIO")),
          )
        ) {
          issues.push(
            semanticIssue(
              "OFFERING_NOT_BRAND_TRUTH",
              "Single-offering support cannot establish universal Brand meaning",
              `$/f/${objectId}`,
            ),
          );
        }
        if (
          /\b(market share|market leader|category leader|ranked #?1|best in class|guaranteed (results|outcomes)|clinically proven|cures? disease)\b/iu.test(
            value,
          )
        ) {
          issues.push(
            semanticIssue(
              "UNSUPPORTED_BRAND_CLAIM",
              "Unsupported ranking, market, efficacy or guaranteed-outcome assertion",
              `$/f/${objectId}`,
            ),
          );
        }
        if (refs.evidenceRefs.length + refs.businessStateRefs.length === 0) {
          issues.push(
            semanticIssue(
              "MISSING_LINEAGE",
              "Non-null Brand Meaning output requires Evidence or business-state lineage",
              `$/f/${objectId}`,
            ),
          );
        }
      }
    }
    if (new Set(values).size !== values.length) {
      issues.push(
        semanticIssue(
          "COLLAPSED_MEANING_OUTPUTS",
          "Brand Meaning outputs must remain semantically distinct",
        ),
      );
    }
    return issues;
  }
}

class BrandCommunicationSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "brand_communication";

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const profile = record(output.communication_profile);
    const metadata = record(output.output_metadata) ?? {};
    if (!profile) {
      for (const value of Object.values(metadata)) {
        if (value !== null) {
          issues.push(
            semanticIssue(
              "METADATA_WITHOUT_SEMANTIC_VALUE",
              "Null communication_profile cannot carry component metadata",
            ),
          );
          break;
        }
      }
      return issues;
    }

    for (const field of ["free_text_guidance", "primary_language"] as const) {
      if ((profile[field] === null) !== (metadata[field] === null)) {
        issues.push(
          semanticIssue(
            "METADATA_ALIGNMENT",
            "Scalar communication metadata must align with the semantic value",
            `$/f/${field}`,
          ),
        );
      }
    }
    this.validateCollection(
      "tone_traits",
      profile.tone_traits,
      metadata.tone_traits,
      issues,
    );
    this.validateCollection(
      "communication_constraints",
      profile.communication_constraints,
      metadata.communication_constraints,
      issues,
    );

    if (
      typeof profile.free_text_guidance === "string" &&
      /\b(must|never|always|required)\b/iu.test(profile.free_text_guidance)
    ) {
      issues.push(
        semanticIssue(
          "GUIDANCE_ESCALATED_TO_HARD_RULE",
          "Descriptive communication guidance cannot manufacture a hard rule",
          "$/f/free_text_guidance",
        ),
      );
    }
    if (Array.isArray(profile.communication_constraints)) {
      for (const item of profile.communication_constraints) {
        const constraint = record(item)?.constraint;
        if (
          typeof constraint === "string" &&
          /\b(color|font|logo|imagery|layout|typography)\b/iu.test(constraint)
        ) {
          issues.push(
            semanticIssue(
              "VISUAL_CONSTRAINT_OUT_OF_SCOPE",
              "Communication processor cannot generate hard Visual constraints",
              "$/f/communication_constraints",
            ),
          );
        }
      }
    }
    if (typeof profile.primary_language === "string") {
      const refs = metadataRefs(record(metadata.primary_language)).evidenceRefs;
      const manifestByRef = new Map(
        context.evidenceManifest.map((entry) => [entry.evidenceRef, entry]),
      );
      if (
        refs.some((ref) =>
          /geography|country|headquarters|currency/iu.test(
            manifestByRef.get(ref)?.capabilityId ?? "",
          ),
        )
      ) {
        issues.push(
          semanticIssue(
            "GEOGRAPHY_CANNOT_ESTABLISH_LANGUAGE",
            "Geography cannot establish Brand communication language",
            "$/f/primary_language",
          ),
        );
      }
    }
    return issues;
  }

  private validateCollection(
    field: string,
    semanticValue: unknown,
    metadataValue: unknown,
    issues: ValidationIssue[],
  ): void {
    if ((semanticValue === null) !== (metadataValue === null)) {
      issues.push(
        semanticIssue(
          "METADATA_ALIGNMENT",
          "Collection metadata must align with its semantic value",
          `$/f/${field}`,
        ),
      );
      return;
    }
    if (!Array.isArray(semanticValue) || !Array.isArray(metadataValue)) return;
    const semanticIds = semanticValue.map((item) => record(item)?.semantic_id);
    const metadataIds = metadataValue.map((item) => record(item)?.semantic_id);
    if (
      semanticIds.some((id) => typeof id !== "string" || id.length === 0) ||
      new Set(semanticIds).size !== semanticIds.length
    ) {
      issues.push(
        semanticIssue(
          "INVALID_SEMANTIC_ITEM_ID",
          "Semantic collections require unique stable semantic IDs",
          `$/f/${field}`,
        ),
      );
    }
    if (
      semanticIds.length !== metadataIds.length ||
      semanticIds.some(
        (id) =>
          metadataIds.filter((candidate) => candidate === id).length !== 1,
      )
    ) {
      issues.push(
        semanticIssue(
          "SEMANTIC_ITEM_METADATA_MISMATCH",
          "Every semantic item requires exactly one metadata item with the same ID",
          `$/f/${field}`,
        ),
      );
    }
  }
}

@Injectable()
export class SemanticValidator {
  private readonly validators: ReadonlyMap<string, ProcessorSemanticValidator> =
    new Map(
      [
        new BrandCommunicationSemanticValidator(),
        new BrandMeaningSemanticValidator(),
      ].map((validator) => [validator.validatorId, validator]),
    );

  registeredValidatorIds(): readonly string[] {
    return [...this.validators.keys()];
  }

  validate(
    untrustedOutput: unknown,
    context: SemanticValidationContext,
  ): ValidationResult<unknown> {
    const output = record(untrustedOutput);
    if (!output) {
      return rejected([
        semanticIssue(
          "OUTPUT_NOT_OBJECT",
          "Structural validation must precede semantic validation",
        ),
      ]);
    }
    const issues: ValidationIssue[] = [];
    const evidenceByRef = new Map(
      context.evidenceManifest.map((entry) => [entry.evidenceRef, entry]),
    );
    const businessByRef = new Map(
      context.businessStateManifest.map((entry) => [
        entry.businessStateRef,
        entry,
      ]),
    );
    const allowedCapabilities = capabilityIds(context.bundle);

    if (
      evidenceByRef.size !== context.evidenceManifest.length ||
      context.evidenceManifest.some(
        (entry) =>
          !entry.evidenceRef ||
          !entry.semanticId ||
          !entry.revisionIdentity ||
          !allowedCapabilities.has(entry.capabilityId),
      )
    ) {
      issues.push(
        semanticIssue(
          "INVALID_EVIDENCE_MANIFEST",
          "Evidence manifest contains duplicate, incomplete, or unsupported capability references",
        ),
      );
    }
    if (
      businessByRef.size !== context.businessStateManifest.length ||
      context.businessStateManifest.some(
        (entry) =>
          !entry.businessStateRef ||
          !entry.semanticId ||
          !entry.revisionIdentity,
      )
    ) {
      issues.push(
        semanticIssue(
          "INVALID_BUSINESS_STATE_MANIFEST",
          "Business-state manifest requires stable refs, semantics, and revision identity",
        ),
      );
    }

    walk(output, (value, path) => {
      if (
        value.authority === "BRAND_CONFIRMED" ||
        value.authority === "SUPPORT_CONTROLLED"
      ) {
        issues.push(
          semanticIssue(
            "PROCESSOR_AUTHORITY_FORBIDDEN",
            "Processors cannot emit protected authority",
            path,
          ),
        );
      }
      const refs = metadataRefs(value);
      for (const evidenceRef of refs.evidenceRefs) {
        if (
          evidenceRef.startsWith("preview:") ||
          !evidenceByRef.has(evidenceRef)
        ) {
          issues.push(
            semanticIssue(
              evidenceRef.startsWith("preview:")
                ? "PREVIEW_ID_NOT_DURABLE_LINEAGE"
                : "UNKNOWN_EVIDENCE_REFERENCE",
              "Evidence lineage reference is not authorized by the normalized manifest",
              path,
            ),
          );
        }
      }
      for (const businessRef of refs.businessStateRefs) {
        if (!businessByRef.has(businessRef)) {
          issues.push(
            semanticIssue(
              "UNKNOWN_BUSINESS_STATE_REFERENCE",
              "Business-state lineage reference is not present in the canonical-state manifest",
              path,
            ),
          );
        }
      }
    });

    const validator = this.validators.get(context.bundle.manifest.processorId);
    if (!validator) {
      issues.push({
        category: "CONFIGURATION",
        code: "UNREGISTERED_SEMANTIC_VALIDATOR",
        message:
          "No compiled semantic validator is registered for this processor",
      });
    } else {
      issues.push(...validator.validate(output, context));
    }
    return issues.length === 0 ? accepted(untrustedOutput) : rejected(issues);
  }
}

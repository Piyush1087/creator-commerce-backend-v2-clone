import type { ProcessorSemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "../../brand-intelligence/contracts/validation/validation.types";
import { InstagramContentBehaviorB4ValueSchema } from "./instagram-content-behavior.contract";

type JsonRecord = Readonly<Record<string, unknown>>;

function issue(code: string, message: string): ValidationIssue {
  return { category: "SEMANTIC", code, componentPath: "$", message };
}

export class InstagramContentBehaviorSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "instagram_content_behavior";

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    const parsed = InstagramContentBehaviorB4ValueSchema.safeParse(output);
    if (!parsed.success) {
      return [
        issue(
          "INVALID_INSTAGRAM_CONTENT_BEHAVIOR",
          "Output does not satisfy the accepted A2 Object and B4 partial contract",
        ),
      ];
    }
    const value = parsed.data;
    const singleEvidence =
      context.evidenceManifest.length === 1 &&
      context.evidenceManifest[0]?.capabilityId ===
        "instagram.media_visual_observations" &&
      context.evidenceManifest[0]?.sourceClass === "INSTAGRAM_OWNED";
    if (!singleEvidence) {
      return [
        issue(
          "INVALID_INSTAGRAM_EVIDENCE_SCOPE",
          "B4 requires one Instagram-owned visual-observation Evidence item",
        ),
      ];
    }
    const components = value.components;
    const unknownPatternKeys = [
      "theme_patterns",
      "caption_patterns",
      "creative_structure_patterns",
      "offering_presence_patterns",
      "creator_presence_patterns",
    ] as const;
    if (
      unknownPatternKeys.some(
        (key) =>
          components[key].state !== "UNKNOWN" ||
          components[key].reasonCode !== "INSUFFICIENT_EVIDENCE",
      )
    ) {
      return [
        issue(
          "ONE_POST_PATTERN_FORBIDDEN",
          "One post cannot establish a Pattern or broad conclusion",
        ),
      ];
    }
    if (
      components.bounded_learnings.state !== "INTENTIONALLY_ABSENT" ||
      components.bounded_learnings.reasonCode !== "INSUFFICIENT_SAMPLE"
    ) {
      return [
        issue(
          "ONE_POST_LEARNING_FORBIDDEN",
          "One post cannot establish a Learning",
        ),
      ];
    }
    return [];
  }
}

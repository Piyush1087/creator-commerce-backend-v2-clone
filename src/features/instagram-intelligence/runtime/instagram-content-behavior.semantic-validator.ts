import type { ProcessorSemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import type {
  SemanticValidationContext,
  ValidationIssue,
} from "../../brand-intelligence/contracts/validation/validation.types";
import { InstagramContentBehaviorB4ValueSchema } from "./instagram-content-behavior.contract";
import { InstagramIntelligenceObjectSchema } from "../contracts/instagram-intelligence.schemas";
import { instagramC4Components } from "./instagram-c4.contract";

type JsonRecord = Readonly<Record<string, unknown>>;

function issue(code: string, message: string): ValidationIssue {
  return { category: "SEMANTIC", code, componentPath: "$", message };
}

export function validateInstagramC4Object(
  output: JsonRecord,
  context: SemanticValidationContext,
  expectedObjectId: string,
): readonly ValidationIssue[] {
  const parsed = InstagramIntelligenceObjectSchema.safeParse(output);
  if (!parsed.success || parsed.data.semanticId !== expectedObjectId) {
    return [
      issue(
        "INVALID_INSTAGRAM_C4_OBJECT",
        "Output does not satisfy its strict Instagram Object contract",
      ),
    ];
  }
  const value = parsed.data;
  if (
    value.state === "NO_CURRENT" ||
    value.readiness === "NOT_READY" ||
    value.freshness !== "CURRENT" ||
    value.currentPreserved ||
    value.generatedAt === null
  ) {
    return [
      issue(
        "PROJECTION_STATE_EMITTED_BY_PROCESSOR",
        "Processor output contains a projection-only state",
      ),
    ];
  }
  if (
    Object.keys(value.components).sort().join("\u0000") !==
    [...instagramC4Components(expectedObjectId)].sort().join("\u0000")
  ) {
    return [
      issue(
        "C4_COMPONENT_SET_MISMATCH",
        "Processor must emit every and only registered component",
      ),
    ];
  }
  const signalById = new Map(
    value.signals.map((signal) => [signal.semanticId, signal]),
  );
  for (const learning of value.learnings) {
    const supporting = learning.supportingSignalIds.map((id) =>
      signalById.get(id),
    );
    if (supporting.some((signal) => !signal)) {
      return [
        issue(
          "LEARNING_SIGNAL_UNKNOWN",
          "Learning references an unknown supporting Signal",
        ),
      ];
    }
    const admitted = new Set(
      supporting.flatMap((signal) => signal?.evidenceRefs ?? []),
    );
    if (learning.evidenceRefs.some((ref) => !admitted.has(ref))) {
      return [
        issue(
          "LEARNING_EVIDENCE_NOT_DERIVED",
          "Learning Evidence must derive from supporting Signals",
        ),
      ];
    }
    if (
      /\b(caused?|because of|drives?|results? in)\b/iu.test(learning.statement)
    ) {
      return [
        issue(
          "CAUSAL_LEARNING_FORBIDDEN",
          "C4 Learning cannot claim causality",
        ),
      ];
    }
  }
  if (
    context.evidenceManifest.some(
      (entry) => entry.sourceClass !== "INSTAGRAM_OWNED",
    )
  ) {
    return [
      issue(
        "INVALID_INSTAGRAM_EVIDENCE_SCOPE",
        "C4 accepts Instagram-owned Evidence only",
      ),
    ];
  }
  return [];
}

export class InstagramContentBehaviorSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "instagram_content_behavior";

  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    if (context.bundle.manifest.processorVersion === "1.1") {
      return validateInstagramC4Object(
        output,
        context,
        "instagram_content_behavior",
      );
    }
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

export class InstagramAudienceProfileSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "instagram_audience_profile";
  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    return validateInstagramC4Object(
      output,
      context,
      "instagram_audience_profile",
    );
  }
}

export class InstagramOrganicPerformanceSemanticValidator implements ProcessorSemanticValidator {
  readonly validatorId = "instagram_organic_performance_profile";
  validate(
    output: JsonRecord,
    context: SemanticValidationContext,
  ): readonly ValidationIssue[] {
    return validateInstagramC4Object(
      output,
      context,
      "instagram_organic_performance_profile",
    );
  }
}

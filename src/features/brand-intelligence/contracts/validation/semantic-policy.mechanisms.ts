import type { ValidationIssue } from "./validation.types";

export interface EstablishingLineagePolicy {
  readonly targetSemanticId: string;
  readonly forbiddenSourceSemanticIds: readonly string[];
  readonly issueCode: string;
}

export interface EstablishingLineageProposal {
  readonly targetSemanticId: string;
  readonly sourceSemanticIds: readonly string[];
  readonly componentPath?: string;
}

export interface HardConstraintPolicy {
  readonly semanticDomain: string;
  readonly explicitGroundingValues: readonly string[];
  readonly issueCode: string;
}

export interface HardConstraintProposal {
  readonly semanticDomain: string;
  readonly hardConstraint: boolean;
  readonly groundingValues: readonly string[];
  readonly componentPath?: string;
}

function policyIssue(
  code: string,
  message: string,
  componentPath?: string,
): ValidationIssue {
  return { category: "SEMANTIC", code, message, componentPath };
}

/** Generic compiled mechanism; policy data is registered per frozen processor. */
export function validateEstablishingLineage(
  proposal: EstablishingLineageProposal,
  policy: EstablishingLineagePolicy,
): readonly ValidationIssue[] {
  if (proposal.targetSemanticId !== policy.targetSemanticId) return [];
  const forbidden = new Set(policy.forbiddenSourceSemanticIds);
  return proposal.sourceSemanticIds.some((source) => forbidden.has(source))
    ? [
        policyIssue(
          policy.issueCode,
          "The proposed target cannot be established by this semantic source class",
          proposal.componentPath,
        ),
      ]
    : [];
}

/** A hard rule requires an explicitly allow-listed grounding class. */
export function validateHardConstraintGrounding(
  proposal: HardConstraintProposal,
  policy: HardConstraintPolicy,
): readonly ValidationIssue[] {
  if (
    proposal.semanticDomain !== policy.semanticDomain ||
    !proposal.hardConstraint
  ) {
    return [];
  }
  const allowed = new Set(policy.explicitGroundingValues);
  return proposal.groundingValues.some((value) => allowed.has(value))
    ? []
    : [
        policyIssue(
          policy.issueCode,
          "A descriptive processor observation cannot be escalated into a hard constraint without explicit grounding",
          proposal.componentPath,
        ),
      ];
}

export function validateDurableIdentityNamespace(
  semanticId: string,
  forbiddenNamespaces: readonly string[],
  componentPath?: string,
): readonly ValidationIssue[] {
  return forbiddenNamespaces.some((namespace) =>
    semanticId.startsWith(`${namespace}:`),
  )
    ? [
        policyIssue(
          "NON_DURABLE_IDENTITY_NAMESPACE",
          "A bounded synthesis identity cannot be promoted into durable Intelligence",
          componentPath,
        ),
      ]
    : [];
}

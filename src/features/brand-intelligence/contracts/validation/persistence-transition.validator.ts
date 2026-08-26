import { Injectable } from "@nestjs/common";

import { BundlePathOwnershipRegistry } from "../registry/bundle-path-ownership.registry";
import { ContractRuntimeRegistry } from "../registry/contract-runtime.registry";
import { accepted, rejected } from "./validation-result";
import type {
  CurrentComponentSnapshot,
  PersistenceValidationRequest,
  ProposedComponentTransition,
  ValidationIssue,
  ValidationResult,
} from "./validation.types";

function addressKey(address: {
  readonly brandId: string;
  readonly objectSemanticId: string;
  readonly pathSchemeVersion: number;
  readonly componentSemanticPath: string;
}): string {
  return [
    address.brandId,
    address.objectSemanticId,
    address.pathSchemeVersion,
    address.componentSemanticPath,
  ].join("\u0000");
}

function issue(
  code: string,
  message: string,
  proposal?: ProposedComponentTransition,
): ValidationIssue {
  return {
    category: "PERSISTENCE",
    code,
    componentPath: proposal?.componentSemanticPath,
    message,
  };
}

function snapshotMatchesExpected(
  snapshot: CurrentComponentSnapshot | undefined,
  proposal: ProposedComponentTransition,
): boolean {
  if (!snapshot || !snapshot.exists)
    return proposal.expectedCurrent.state === "ABSENT";
  return (
    proposal.expectedCurrent.state === "PRESENT" &&
    proposal.expectedCurrent.generationId === snapshot.generationId &&
    proposal.expectedCurrent.revision === snapshot.revision
  );
}

@Injectable()
export class PersistenceTransitionValidator {
  readonly validatorId = "intelligence_persistence_transition_v1";

  constructor(
    private readonly registry: ContractRuntimeRegistry,
    private readonly ownership: BundlePathOwnershipRegistry,
  ) {}

  validate(
    request: PersistenceValidationRequest,
  ): ValidationResult<PersistenceValidationRequest> {
    const issues: ValidationIssue[] = [];
    const scopeResult = this.ownership.validateActiveScope(
      request.registryKey,
      request.activeScope,
    );
    if (!scopeResult.valid) {
      issues.push(
        ...scopeResult.issues.map((scopeIssue) => ({
          ...scopeIssue,
          category: "PERSISTENCE" as const,
          code: `ACTIVE_SCOPE_${scopeIssue.code}`,
        })),
      );
    }
    const bundle = this.registry.getVerifiedBundle(request.registryKey);
    const metadataSchema = (bundle.artifacts.outputContract
      .shared_generated_metadata ??
      bundle.artifacts.outputContract.shared_item_metadata ??
      bundle.artifacts.outputContract.generated_metadata) as
      | Readonly<Record<string, unknown>>
      | undefined;
    const fields = metadataSchema?.fields as
      | Readonly<Record<string, unknown>>
      | undefined;
    const authority = fields?.authority as
      | Readonly<Record<string, unknown>>
      | undefined;
    const allowedAuthorities = new Set(
      Array.isArray(authority?.values)
        ? authority.values.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    );
    const activeKeys = new Set(request.activeScope.map(addressKey));
    const snapshots = new Map(
      request.currentState.map((state) => [addressKey(state), state]),
    );
    const proposalKeys = request.proposals.map(addressKey);
    if (new Set(proposalKeys).size !== proposalKeys.length) {
      issues.push(
        issue(
          "DUPLICATE_COMPONENT_PROPOSAL",
          "A component may have only one transition proposal",
        ),
      );
    }

    for (const proposal of request.proposals) {
      const key = addressKey(proposal);
      const snapshot = snapshots.get(key);
      if (!activeKeys.has(key)) {
        issues.push(
          issue(
            "PROPOSAL_OUTSIDE_ACTIVE_SCOPE",
            "Transition proposal is outside active output scope",
            proposal,
          ),
        );
      }
      if (!this.ownership.ownsForBundle(request.registryKey, proposal)) {
        issues.push(
          issue(
            "UNOWNED_COMPONENT_PROPOSAL",
            "Processor does not own the proposed Object/path",
            proposal,
          ),
        );
      }
      if (!allowedAuthorities.has(proposal.authority)) {
        issues.push(
          issue(
            "FORBIDDEN_PROCESSOR_AUTHORITY",
            "Proposed authority is outside the output contract",
            proposal,
          ),
        );
      }
      if (!snapshotMatchesExpected(snapshot, proposal)) {
        issues.push(
          issue(
            "EXPECTED_BASIS_MISMATCH",
            "Expected current does not exactly match the supplied snapshot",
            proposal,
          ),
        );
      }
      if (snapshot?.protected && proposal.disposition === "APPLY_CURRENT") {
        issues.push(
          issue(
            "PROTECTED_CURRENT_OVERWRITE",
            "Protected current state cannot be silently replaced",
            proposal,
          ),
        );
      }
      if (proposal.disposition === "CREATE_CANDIDATE" && snapshot?.exists) {
        if (
          proposal.basisGenerationId !== snapshot.generationId ||
          proposal.basisRevision !== snapshot.revision
        ) {
          issues.push(
            issue(
              "CANDIDATE_BASIS_MISMATCH",
              "Candidate must retain the exact current generation/revision basis",
              proposal,
            ),
          );
        }
      }
      if (
        proposal.disposition !== "NO_CHANGE" &&
        proposal.evidenceRefs.length + proposal.businessStateRefs.length === 0
      ) {
        issues.push(
          issue(
            "MISSING_TRANSITION_LINEAGE",
            "Mutation proposal requires Evidence or business-state lineage",
            proposal,
          ),
        );
      }
    }
    return issues.length === 0 ? accepted(request) : rejected(issues);
  }
}

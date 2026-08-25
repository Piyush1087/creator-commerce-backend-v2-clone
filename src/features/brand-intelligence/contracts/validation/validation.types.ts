import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import type {
  ContractRegistryKey,
  VerifiedContractBundle,
} from "../bundle/contract-bundle.types";

export type ValidationIssueCategory =
  | "STRUCTURAL"
  | "SEMANTIC"
  | "PERSISTENCE"
  | "CONFIGURATION";

export interface ValidationIssue {
  readonly category: ValidationIssueCategory;
  readonly code: string;
  readonly componentPath?: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | Readonly<{ valid: true; value: T; issues: readonly [] }>
  | Readonly<{ valid: false; issues: readonly ValidationIssue[] }>;

export interface EvidenceManifestEntry {
  readonly evidenceRef: string;
  readonly capabilityId: string;
  readonly semanticId: string;
  readonly revisionIdentity: string;
}

export interface BusinessStateManifestEntry {
  readonly businessStateRef: string;
  readonly semanticId: string;
  readonly revisionIdentity: string;
}

export interface SemanticValidationContext {
  readonly bundle: VerifiedContractBundle;
  readonly evidenceManifest: readonly EvidenceManifestEntry[];
  readonly businessStateManifest: readonly BusinessStateManifestEntry[];
}

export interface CurrentComponentSnapshot extends ComponentSemanticAddress {
  readonly exists: boolean;
  readonly generationId?: string;
  readonly revision?: bigint;
  readonly authority?: string;
  readonly protected: boolean;
}

export interface ProposedComponentTransition extends ComponentSemanticAddress {
  readonly disposition: "APPLY_CURRENT" | "CREATE_CANDIDATE" | "NO_CHANGE";
  readonly authority: string;
  readonly expectedCurrent:
    | Readonly<{ state: "ABSENT" }>
    | Readonly<{
        state: "PRESENT";
        generationId: string;
        revision: bigint;
      }>;
  readonly basisGenerationId?: string;
  readonly basisRevision?: bigint;
  readonly evidenceRefs: readonly string[];
  readonly businessStateRefs: readonly string[];
}

export interface PersistenceValidationRequest {
  readonly registryKey: ContractRegistryKey;
  readonly activeScope: readonly ComponentSemanticAddress[];
  readonly currentState: readonly CurrentComponentSnapshot[];
  readonly proposals: readonly ProposedComponentTransition[];
}

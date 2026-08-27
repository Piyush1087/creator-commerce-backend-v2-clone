export const CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION = 1 as const;
export const CONTRACT_BUNDLE_GENERATOR_VERSION = "1.0.0" as const;

export const CONTRACT_ARTIFACT_ROLES = [
  "PROCESSOR_DEFINITION",
  "REASONING_CONTRACT",
  "OUTPUT_CONTRACT",
  "EVIDENCE_CONTRACT",
  "OBJECT_CONTRACT",
  "SHARED_METADATA_CONTRACT",
] as const;

export type ContractArtifactRole = (typeof CONTRACT_ARTIFACT_ROLES)[number];

export interface ContractArtifactManifestEntry {
  readonly role: ContractArtifactRole;
  readonly path: string;
  readonly semanticId: string;
  readonly semanticVersion: string;
  readonly status: "FROZEN";
  readonly required: true;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface OwnedPathPattern {
  readonly objectSemanticId: string;
  readonly componentPathPattern: string;
}

export interface ContractBundleManifestIdentity {
  readonly manifestSchemaVersion: typeof CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly ownerEngine: string;
  readonly owningBranch: string;
  readonly architectureRepository: string;
  readonly architectureCommitSha: string;
  readonly processorId: string;
  readonly processorVersion: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
  readonly evidenceContractId: string;
  readonly evidenceContractVersion: string;
  readonly ownedObjectSemanticIds: readonly string[];
  readonly ownedPathPatterns: readonly OwnedPathPattern[];
  readonly generatedNotice: "GENERATED — DO NOT EDIT";
  readonly generatorVersion: typeof CONTRACT_BUNDLE_GENERATOR_VERSION;
}

export interface ContractBundleManifest extends ContractBundleManifestIdentity {
  readonly artifacts: readonly ContractArtifactManifestEntry[];
  readonly bundleContentHash: string;
}

export interface ContractRegistryKey {
  readonly processorId: string;
  readonly processorVersion: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
}

export interface ParsedContractArtifacts {
  readonly processorDefinition: Readonly<Record<string, unknown>>;
  readonly reasoningContract: Readonly<Record<string, unknown>>;
  readonly outputContract: Readonly<Record<string, unknown>>;
  readonly evidenceContract: Readonly<Record<string, unknown>>;
  readonly objectContract: Readonly<Record<string, unknown>>;
  readonly sharedMetadataContract: Readonly<Record<string, unknown>>;
}

export interface VerifiedContractBundle {
  readonly manifest: ContractBundleManifest;
  readonly artifacts: ParsedContractArtifacts;
}

export interface ContractSourceSpec {
  readonly processorId: string;
  readonly processorVersion: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
  readonly evidenceContractId: string;
  readonly evidenceContractVersion: string;
  readonly ownerEngine: string;
  readonly owningBranch: string;
  /** Frozen source layouts predate a single cross-engine YAML shape. */
  readonly sourceDialect?: "BRAND_BRANCH_V1" | "PRODUCT_ENGINE_V1";
  readonly ownedObjectSemanticIds: readonly string[];
  readonly ownedPathPatterns: readonly OwnedPathPattern[];
  readonly artifactPaths: Readonly<Record<ContractArtifactRole, string>>;
}

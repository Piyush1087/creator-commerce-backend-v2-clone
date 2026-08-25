import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, normalize, relative, resolve, sep } from "node:path";
import { parse } from "yaml";

import { canonicalJson, sha256Bytes, sha256Canonical } from "./canonical-json";
import { bundleHashInput } from "./contract-bundle.generator";
import {
  CONTRACT_ARTIFACT_ROLES,
  CONTRACT_BUNDLE_GENERATOR_VERSION,
  CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
  type ContractArtifactManifestEntry,
  type ContractArtifactRole,
  type ContractBundleManifest,
  type ContractBundleManifestIdentity,
  type ParsedContractArtifacts,
  type VerifiedContractBundle,
} from "./contract-bundle.types";
import { ContractRuntimeError } from "./contract-runtime.error";
import {
  ARCHITECTURE_REPOSITORY,
  CONTRACT_SOURCE_SPECS,
  PINNED_ARCHITECTURE_COMMIT,
} from "./contract-source.spec";

export interface GeneratedContractRegistration {
  readonly processorId: string;
  readonly processorVersion: string;
  readonly outputContractId: string;
  readonly outputContractVersion: string;
  readonly bundleId: string;
  readonly bundleVersion: string;
  readonly bundleContentHash: string;
  readonly ownedObjectSemanticIds: readonly string[];
  readonly ownedPathPatterns: readonly {
    readonly objectSemanticId: string;
    readonly componentPathPattern: string;
  }[];
  readonly structuralValidatorId: string;
  readonly semanticValidatorId: string;
  readonly persistenceValidatorId: string;
  readonly bundled: true;
  readonly registered: true;
  readonly executionEnabled: boolean;
}

interface GeneratedContractRegistry {
  readonly generatedNotice: "GENERATED — DO NOT EDIT";
  readonly generatorVersion: string;
  readonly architectureRepository: string;
  readonly architectureCommitSha: string;
  readonly registrations: readonly GeneratedContractRegistration[];
}

export interface VerifiedContractRuntime {
  readonly registry: GeneratedContractRegistry;
  readonly bundles: ReadonlyMap<string, VerifiedContractBundle>;
}

function configuration(code: string, message: string): never {
  throw new ContractRuntimeError(code, message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    configuration("INVALID_BUNDLE_DOCUMENT", `${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function keyOf(registration: GeneratedContractRegistration): string {
  return [
    registration.processorId,
    registration.processorVersion,
    registration.outputContractId,
    registration.outputContractVersion,
  ].join("\u0000");
}

function listFiles(root: string, base: string = root): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? listFiles(path, base)
      : [relative(base, path).split(sep).join("/")];
  });
}

function manifestIdentity(
  manifest: ContractBundleManifest,
): ContractBundleManifestIdentity {
  return {
    manifestSchemaVersion: manifest.manifestSchemaVersion,
    bundleId: manifest.bundleId,
    bundleVersion: manifest.bundleVersion,
    ownerEngine: manifest.ownerEngine,
    owningBranch: manifest.owningBranch,
    architectureRepository: manifest.architectureRepository,
    architectureCommitSha: manifest.architectureCommitSha,
    processorId: manifest.processorId,
    processorVersion: manifest.processorVersion,
    outputContractId: manifest.outputContractId,
    outputContractVersion: manifest.outputContractVersion,
    evidenceContractId: manifest.evidenceContractId,
    evidenceContractVersion: manifest.evidenceContractVersion,
    ownedObjectSemanticIds: manifest.ownedObjectSemanticIds,
    ownedPathPatterns: manifest.ownedPathPatterns,
    generatedNotice: manifest.generatedNotice,
    generatorVersion: manifest.generatorVersion,
  };
}

function safeArtifactPath(
  bundleRoot: string,
  entry: ContractArtifactManifestEntry,
): string {
  const expected = `artifacts/${entry.role.toLowerCase()}.yaml`;
  if (entry.path !== expected || normalize(entry.path).startsWith("..")) {
    configuration(
      "UNSAFE_ARTIFACT_PATH",
      `Unexpected artifact path '${entry.path}'`,
    );
  }
  const resolved = resolve(bundleRoot, entry.path);
  if (!resolved.startsWith(`${resolve(bundleRoot)}${sep}`)) {
    configuration("UNSAFE_ARTIFACT_PATH", `Artifact escapes bundle root`);
  }
  return resolved;
}

@Injectable()
export class ContractBundleIntegrityVerifier {
  verifyRoot(
    bundleRoot: string,
    registeredValidatorIds: ReadonlySet<string>,
  ): VerifiedContractRuntime {
    const registryPath = join(bundleRoot, "registry.json");
    if (!existsSync(registryPath)) {
      configuration(
        "MISSING_CONTRACT_REGISTRY",
        "Generated contract registry is missing",
      );
    }
    let registry: GeneratedContractRegistry;
    try {
      registry = JSON.parse(
        readFileSync(registryPath, "utf8"),
      ) as GeneratedContractRegistry;
    } catch {
      configuration(
        "INVALID_CONTRACT_REGISTRY",
        "Generated contract registry is invalid JSON",
      );
    }
    if (
      registry.generatedNotice !== "GENERATED — DO NOT EDIT" ||
      registry.generatorVersion !== CONTRACT_BUNDLE_GENERATOR_VERSION ||
      registry.architectureRepository !== ARCHITECTURE_REPOSITORY ||
      registry.architectureCommitSha !== PINNED_ARCHITECTURE_COMMIT ||
      !Array.isArray(registry.registrations)
    ) {
      configuration(
        "REGISTRY_IDENTITY_MISMATCH",
        "Generated registry identity does not match the backend pin",
      );
    }

    const expectedKeys = new Set(
      CONTRACT_SOURCE_SPECS.map((spec) =>
        [
          spec.processorId,
          spec.processorVersion,
          spec.outputContractId,
          spec.outputContractVersion,
        ].join("\u0000"),
      ),
    );
    const actualKeys = registry.registrations.map(keyOf);
    if (
      new Set(actualKeys).size !== actualKeys.length ||
      actualKeys.some((key) => !expectedKeys.has(key)) ||
      actualKeys.length !== expectedKeys.size
    ) {
      configuration(
        "REGISTRY_KEY_MISMATCH",
        "Registry allow-list keys do not match compiled source specs",
      );
    }

    const bundles = new Map<string, VerifiedContractBundle>();
    const expectedFiles = new Set<string>(["registry.json"]);
    for (const registration of registry.registrations) {
      for (const validatorId of [
        registration.structuralValidatorId,
        registration.semanticValidatorId,
        registration.persistenceValidatorId,
      ]) {
        if (!registeredValidatorIds.has(validatorId)) {
          configuration(
            "UNREGISTERED_VALIDATOR",
            `Validator '${validatorId}' is not compiled into the backend`,
          );
        }
      }
      const expectedExecutionEnabled =
        registration.processorId === "brand_communication";
      if (
        registration.bundled !== true ||
        registration.registered !== true ||
        registration.executionEnabled !== expectedExecutionEnabled
      ) {
        configuration(
          "EXECUTION_FLAG_MISMATCH",
          "Registration execution state does not match the compiled processor allow-list",
        );
      }

      const prefix = `${registration.processorId}/${registration.processorVersion}`;
      const manifestRelative = `${prefix}/manifest.json`;
      expectedFiles.add(manifestRelative);
      const manifestPath = join(bundleRoot, manifestRelative);
      if (!existsSync(manifestPath)) {
        configuration(
          "MISSING_BUNDLE_MANIFEST",
          `Missing manifest '${manifestRelative}'`,
        );
      }
      let manifest: ContractBundleManifest;
      try {
        manifest = JSON.parse(
          readFileSync(manifestPath, "utf8"),
        ) as ContractBundleManifest;
      } catch {
        configuration(
          "INVALID_BUNDLE_MANIFEST",
          `Invalid manifest '${manifestRelative}'`,
        );
      }
      this.assertManifestIdentity(manifest, registration);

      if (!Array.isArray(manifest.artifacts)) {
        configuration(
          "INVALID_ARTIFACT_SET",
          "Manifest artifacts must be an array",
        );
      }
      const entries =
        manifest.artifacts as readonly ContractArtifactManifestEntry[];
      const roles = entries.map((entry) => entry.role);
      if (
        new Set(roles).size !== CONTRACT_ARTIFACT_ROLES.length ||
        roles.some((role) => !CONTRACT_ARTIFACT_ROLES.includes(role)) ||
        roles.length !== CONTRACT_ARTIFACT_ROLES.length
      ) {
        configuration(
          "INVALID_ARTIFACT_SET",
          "Manifest must contain each required role exactly once",
        );
      }

      const parsedByRole = {} as Record<
        ContractArtifactRole,
        Record<string, unknown>
      >;
      const bundleDirectory = join(bundleRoot, prefix);
      for (const entry of entries) {
        if (
          entry.required !== true ||
          entry.status !== "FROZEN" ||
          typeof entry.semanticId !== "string" ||
          typeof entry.semanticVersion !== "string"
        ) {
          configuration(
            "INVALID_ARTIFACT_ENTRY",
            `Invalid ${entry.role} manifest entry`,
          );
        }
        const artifactPath = safeArtifactPath(bundleDirectory, entry);
        expectedFiles.add(`${prefix}/${entry.path}`);
        if (!existsSync(artifactPath)) {
          configuration(
            "MISSING_BUNDLE_FILE",
            `Missing required artifact '${entry.path}'`,
          );
        }
        const bytes = readFileSync(artifactPath);
        if (
          bytes.byteLength !== entry.byteLength ||
          sha256Bytes(bytes) !== entry.sha256
        ) {
          configuration(
            "ARTIFACT_HASH_MISMATCH",
            `Artifact integrity failed for '${entry.path}'`,
          );
        }
        let document: Record<string, unknown>;
        try {
          document = asRecord(
            parse(bytes.toString("utf8"), { maxAliasCount: 0 }),
            entry.path,
          );
        } catch (error) {
          if (error instanceof ContractRuntimeError) throw error;
          configuration(
            "INVALID_BUNDLE_DOCUMENT",
            `Artifact '${entry.path}' is invalid YAML`,
          );
        }
        if (document.status !== "FROZEN") {
          configuration(
            "NON_FROZEN_ARTIFACT",
            `Artifact '${entry.path}' is not FROZEN`,
          );
        }
        const semanticIdKey =
          entry.role === "OBJECT_CONTRACT" ||
          entry.role === "SHARED_METADATA_CONTRACT"
            ? "contract"
            : "id";
        if (
          document[semanticIdKey] !== entry.semanticId ||
          document.version !== entry.semanticVersion
        ) {
          configuration(
            "ARTIFACT_SEMANTIC_IDENTITY_MISMATCH",
            `Artifact '${entry.path}' semantic ID/version does not match its manifest entry`,
          );
        }
        parsedByRole[entry.role] = document;
      }
      this.assertParsedSemanticLinks(manifest, parsedByRole);
      const calculatedHash = sha256Canonical(
        bundleHashInput(manifestIdentity(manifest), entries),
      );
      if (
        calculatedHash !== manifest.bundleContentHash ||
        calculatedHash !== registration.bundleContentHash
      ) {
        configuration(
          "BUNDLE_HASH_MISMATCH",
          "Bundle content hash does not match manifest and registry pin",
        );
      }
      bundles.set(keyOf(registration), {
        manifest,
        artifacts: {
          processorDefinition: parsedByRole.PROCESSOR_DEFINITION,
          reasoningContract: parsedByRole.REASONING_CONTRACT,
          outputContract: parsedByRole.OUTPUT_CONTRACT,
          evidenceContract: parsedByRole.EVIDENCE_CONTRACT,
          objectContract: parsedByRole.OBJECT_CONTRACT,
          sharedMetadataContract: parsedByRole.SHARED_METADATA_CONTRACT,
        } satisfies ParsedContractArtifacts,
      });
    }

    const actualFiles = listFiles(bundleRoot).sort();
    const allowedFiles = [...expectedFiles].sort();
    if (canonicalJson(actualFiles) !== canonicalJson(allowedFiles)) {
      configuration(
        "UNEXPECTED_BUNDLE_FILE",
        "Generated contract bundle file set contains drift",
      );
    }
    return { registry, bundles };
  }

  private assertManifestIdentity(
    manifest: ContractBundleManifest,
    registration: GeneratedContractRegistration,
  ): void {
    const spec = CONTRACT_SOURCE_SPECS.find(
      (candidate) =>
        candidate.processorId === registration.processorId &&
        candidate.processorVersion === registration.processorVersion,
    );
    if (
      !spec ||
      manifest.manifestSchemaVersion !==
        CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION ||
      manifest.generatedNotice !== "GENERATED — DO NOT EDIT" ||
      manifest.generatorVersion !== CONTRACT_BUNDLE_GENERATOR_VERSION ||
      manifest.architectureRepository !== ARCHITECTURE_REPOSITORY ||
      manifest.architectureCommitSha !== PINNED_ARCHITECTURE_COMMIT ||
      manifest.ownerEngine !== spec.ownerEngine ||
      manifest.owningBranch !== spec.owningBranch ||
      manifest.processorId !== registration.processorId ||
      manifest.processorVersion !== registration.processorVersion ||
      manifest.outputContractId !== registration.outputContractId ||
      manifest.outputContractVersion !== registration.outputContractVersion ||
      manifest.evidenceContractId !== spec.evidenceContractId ||
      manifest.evidenceContractVersion !== spec.evidenceContractVersion ||
      manifest.bundleId !== `${spec.ownerEngine}.${spec.processorId}` ||
      manifest.bundleVersion !== spec.processorVersion ||
      manifest.bundleId !== registration.bundleId ||
      manifest.bundleVersion !== registration.bundleVersion ||
      canonicalJson(manifest.ownedObjectSemanticIds) !==
        canonicalJson(spec.ownedObjectSemanticIds) ||
      canonicalJson(manifest.ownedObjectSemanticIds) !==
        canonicalJson(registration.ownedObjectSemanticIds) ||
      canonicalJson(manifest.ownedPathPatterns) !==
        canonicalJson(spec.ownedPathPatterns) ||
      canonicalJson(manifest.ownedPathPatterns) !==
        canonicalJson(registration.ownedPathPatterns) ||
      registration.structuralValidatorId !== "contract_output_schema_v1" ||
      registration.semanticValidatorId !== spec.processorId ||
      registration.persistenceValidatorId !==
        "intelligence_persistence_transition_v1"
    ) {
      configuration(
        "MANIFEST_IDENTITY_MISMATCH",
        "Bundle manifest identity does not match its compiled registration",
      );
    }
  }

  private assertParsedSemanticLinks(
    manifest: ContractBundleManifest,
    parsed: Readonly<
      Record<ContractArtifactRole, Readonly<Record<string, unknown>>>
    >,
  ): void {
    const processor = parsed.PROCESSOR_DEFINITION;
    const reasoning = parsed.REASONING_CONTRACT;
    const output = parsed.OUTPUT_CONTRACT;
    const evidence = parsed.EVIDENCE_CONTRACT;
    const objects = parsed.OBJECT_CONTRACT;
    const shared = parsed.SHARED_METADATA_CONTRACT;
    const objectRows = Array.isArray(objects.objects) ? objects.objects : [];
    const objectIds = new Set(
      objectRows.flatMap((row) => {
        const value = row as Readonly<Record<string, unknown>>;
        return typeof value.id === "string" ? [value.id] : [];
      }),
    );
    const outputObjects = Array.isArray(output.objects)
      ? output.objects
      : [output.object];
    const semanticMismatch =
      processor.id !== manifest.processorId ||
      processor.version !== manifest.processorVersion ||
      processor.owner_engine !== manifest.ownerEngine ||
      processor.owning_branch !== manifest.owningBranch ||
      reasoning.processor !== manifest.processorId ||
      reasoning.owner_engine !== manifest.ownerEngine ||
      reasoning.owning_branch !== manifest.owningBranch ||
      output.id !== manifest.outputContractId ||
      output.version !== manifest.outputContractVersion ||
      output.processor !== manifest.processorId ||
      evidence.id !== manifest.evidenceContractId ||
      evidence.version !== manifest.evidenceContractVersion ||
      evidence.processor !== manifest.processorId ||
      evidence.owner_engine !== manifest.ownerEngine ||
      evidence.owning_branch !== manifest.owningBranch ||
      objects.engine !== manifest.ownerEngine ||
      objects.branch !== manifest.owningBranch ||
      shared.contract !== "shared_intelligence_metadata" ||
      outputObjects.length !== manifest.ownedObjectSemanticIds.length ||
      outputObjects.some(
        (objectId) =>
          typeof objectId !== "string" ||
          !manifest.ownedObjectSemanticIds.includes(objectId) ||
          !objectIds.has(objectId),
      );
    if (semanticMismatch) {
      configuration(
        "CROSS_ARTIFACT_SEMANTIC_MISMATCH",
        "Bundle artifacts do not preserve processor/Object/Evidence/output semantic links",
      );
    }
  }
}

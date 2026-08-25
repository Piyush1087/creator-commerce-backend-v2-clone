import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";

import { canonicalJson, sha256Bytes, sha256Canonical } from "./canonical-json";
import {
  CONTRACT_ARTIFACT_ROLES,
  CONTRACT_BUNDLE_GENERATOR_VERSION,
  CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
  type ContractArtifactManifestEntry,
  type ContractArtifactRole,
  type ContractBundleManifest,
  type ContractBundleManifestIdentity,
  type ContractSourceSpec,
} from "./contract-bundle.types";
import {
  ARCHITECTURE_REPOSITORY,
  CONTRACT_SOURCE_SPECS,
  PINNED_ARCHITECTURE_COMMIT,
} from "./contract-source.spec";

const COMMIT_SHA = /^[0-9a-f]{40}$/u;
const GENERATED_DIRECTORY = join(
  "src",
  "features",
  "brand-intelligence",
  "generated",
  "contract-bundles",
);

interface GenerateOptions {
  readonly sourceRoot: string;
  readonly outputRoot: string;
  readonly commitSha: string;
  readonly architectureRepository?: string;
  readonly specs?: readonly ContractSourceSpec[];
  readonly verifyOnly?: boolean;
}

interface GeneratedFile {
  readonly relativePath: string;
  readonly bytes: Buffer;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a YAML mapping`);
  }
  return value as Record<string, unknown>;
}

function textField(
  value: Readonly<Record<string, unknown>>,
  key: string,
  label: string,
): string {
  const found = value[key];
  if (typeof found !== "string" || found.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return found;
}

function artifactSemanticId(
  role: ContractArtifactRole,
  value: Readonly<Record<string, unknown>>,
): string {
  return textField(
    value,
    role === "OBJECT_CONTRACT" || role === "SHARED_METADATA_CONTRACT"
      ? "contract"
      : "id",
    role,
  );
}

function git(sourceRoot: string, args: readonly string[]): Buffer {
  return execFileSync("git", ["-C", sourceRoot, ...args], {
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assertExactCleanSource(sourceRoot: string, commitSha: string): void {
  if (!COMMIT_SHA.test(commitSha)) {
    throw new Error(
      "Architecture source identity must be an exact 40-character commit SHA",
    );
  }
  const head = git(sourceRoot, ["rev-parse", "HEAD"]).toString("utf8").trim();
  if (head !== commitSha) {
    throw new Error(
      `Architecture checkout HEAD ${head} does not match pinned ${commitSha}`,
    );
  }
  const dirty = git(sourceRoot, [
    "status",
    "--porcelain",
    "--untracked-files=all",
  ])
    .toString("utf8")
    .trim();
  if (dirty.length > 0) {
    throw new Error("Architecture source checkout is dirty");
  }
}

function readCommittedArtifact(
  sourceRoot: string,
  commitSha: string,
  path: string,
): Buffer {
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    throw new Error(`Unsafe source artifact path '${path}'`);
  }
  try {
    return git(sourceRoot, ["show", `${commitSha}:${path}`]);
  } catch {
    throw new Error(`Required source artifact is missing: ${path}`);
  }
}

function assertPathReference(
  artifact: Readonly<Record<string, unknown>>,
  key: string,
  expectedPath: string,
  label: string,
): void {
  const actual = textField(artifact, key, label).split("#", 1)[0];
  if (actual !== expectedPath) {
    throw new Error(
      `${label}.${key} references '${actual}', expected '${expectedPath}'`,
    );
  }
}

function assertBundleSemantics(
  spec: ContractSourceSpec,
  parsed: Readonly<Record<ContractArtifactRole, Record<string, unknown>>>,
): void {
  const processor = parsed.PROCESSOR_DEFINITION;
  const reasoning = parsed.REASONING_CONTRACT;
  const output = parsed.OUTPUT_CONTRACT;
  const evidence = parsed.EVIDENCE_CONTRACT;
  const objects = parsed.OBJECT_CONTRACT;
  const shared = parsed.SHARED_METADATA_CONTRACT;

  for (const [role, artifact] of Object.entries(parsed)) {
    if (artifact.status !== "FROZEN") {
      throw new Error(`${role} status must be FROZEN`);
    }
  }
  if (
    textField(processor, "id", "PROCESSOR_DEFINITION") !== spec.processorId ||
    textField(processor, "version", "PROCESSOR_DEFINITION") !==
      spec.processorVersion
  ) {
    throw new Error("Processor ID/version mismatch");
  }
  if (
    processor.owner_engine !== spec.ownerEngine ||
    processor.owning_branch !== spec.owningBranch
  ) {
    throw new Error("Processor owner engine/branch mismatch");
  }
  for (const [label, artifact] of [
    ["REASONING_CONTRACT", reasoning],
    ["EVIDENCE_CONTRACT", evidence],
  ] as const) {
    if (
      artifact.processor !== spec.processorId ||
      artifact.owner_engine !== spec.ownerEngine ||
      artifact.owning_branch !== spec.owningBranch
    ) {
      throw new Error(`${label} processor/owner mismatch`);
    }
  }
  if (output.processor !== spec.processorId) {
    throw new Error("Output contract processor mismatch");
  }
  if (
    artifactSemanticId("OUTPUT_CONTRACT", output) !== spec.outputContractId ||
    textField(output, "version", "OUTPUT_CONTRACT") !==
      spec.outputContractVersion
  ) {
    throw new Error("Output contract ID/version mismatch");
  }
  if (
    artifactSemanticId("EVIDENCE_CONTRACT", evidence) !==
      spec.evidenceContractId ||
    textField(evidence, "version", "EVIDENCE_CONTRACT") !==
      spec.evidenceContractVersion
  ) {
    throw new Error("Evidence contract ID/version mismatch");
  }
  if (
    objects.engine !== spec.ownerEngine ||
    objects.branch !== spec.owningBranch
  ) {
    throw new Error("Object contract owner engine/branch mismatch");
  }
  if (shared.contract !== "shared_intelligence_metadata") {
    throw new Error("Wrong shared metadata contract");
  }

  const objectRows = objects.objects;
  if (!Array.isArray(objectRows)) {
    throw new Error("Object contract objects must be an array");
  }
  const availableObjectIds = new Set(
    objectRows.map((item) => textField(record(item, "Object"), "id", "Object")),
  );
  for (const objectId of spec.ownedObjectSemanticIds) {
    if (!availableObjectIds.has(objectId)) {
      throw new Error(
        `Owned Object '${objectId}' is absent from Object contract`,
      );
    }
  }
  const outputObjects = Array.isArray(output.objects)
    ? output.objects
    : [output.object];
  if (
    outputObjects.length !== spec.ownedObjectSemanticIds.length ||
    outputObjects.some(
      (objectId) =>
        typeof objectId !== "string" ||
        !spec.ownedObjectSemanticIds.includes(objectId),
    )
  ) {
    throw new Error("Output contract Object ownership mismatch");
  }

  for (const artifact of [reasoning, output, evidence]) {
    assertPathReference(
      artifact,
      "processor_definition",
      spec.artifactPaths.PROCESSOR_DEFINITION,
      "artifact",
    );
    assertPathReference(
      artifact,
      "shared_metadata_authority",
      spec.artifactPaths.SHARED_METADATA_CONTRACT,
      "artifact",
    );
  }
  for (const artifact of [reasoning, output]) {
    assertPathReference(
      artifact,
      "object_authority",
      spec.artifactPaths.OBJECT_CONTRACT,
      "artifact",
    );
  }
  assertPathReference(
    output,
    "reasoning_authority",
    spec.artifactPaths.REASONING_CONTRACT,
    "OUTPUT_CONTRACT",
  );
  assertPathReference(
    evidence,
    "reasoning_authority",
    spec.artifactPaths.REASONING_CONTRACT,
    "EVIDENCE_CONTRACT",
  );
  assertPathReference(
    evidence,
    "output_contract_authority",
    spec.artifactPaths.OUTPUT_CONTRACT,
    "EVIDENCE_CONTRACT",
  );
}

export function bundleHashInput(
  identity: ContractBundleManifestIdentity,
  entries: readonly ContractArtifactManifestEntry[],
): unknown {
  return {
    ...identity,
    artifacts: [...entries]
      .sort((left, right) =>
        `${left.role}:${left.path}`.localeCompare(
          `${right.role}:${right.path}`,
        ),
      )
      .map((entry) => ({
        role: entry.role,
        path: entry.path,
        semanticId: entry.semanticId,
        semanticVersion: entry.semanticVersion,
        status: entry.status,
        required: entry.required,
        byteLength: entry.byteLength,
        sha256: entry.sha256,
      })),
  };
}

function buildBundle(
  sourceRoot: string,
  commitSha: string,
  architectureRepository: string,
  spec: ContractSourceSpec,
): readonly GeneratedFile[] {
  const roles = Object.keys(spec.artifactPaths).sort();
  const expectedRoles = [...CONTRACT_ARTIFACT_ROLES].sort();
  if (canonicalJson(roles) !== canonicalJson(expectedRoles)) {
    throw new Error(
      `Processor '${spec.processorId}' has an unexpected artifact role set`,
    );
  }

  const sourceBytes = {} as Record<ContractArtifactRole, Buffer>;
  const parsed = {} as Record<ContractArtifactRole, Record<string, unknown>>;
  for (const role of CONTRACT_ARTIFACT_ROLES) {
    const bytes = readCommittedArtifact(
      sourceRoot,
      commitSha,
      spec.artifactPaths[role],
    );
    sourceBytes[role] = bytes;
    parsed[role] = record(parse(bytes.toString("utf8")), role);
  }
  assertBundleSemantics(spec, parsed);

  const entries = CONTRACT_ARTIFACT_ROLES.map((role) => {
    const bytes = sourceBytes[role];
    const artifactPath = `artifacts/${role.toLowerCase()}.yaml`;
    return {
      role,
      path: artifactPath,
      semanticId: artifactSemanticId(role, parsed[role]),
      semanticVersion: textField(parsed[role], "version", role),
      status: "FROZEN",
      required: true,
      byteLength: bytes.byteLength,
      sha256: sha256Bytes(bytes),
    } satisfies ContractArtifactManifestEntry;
  }).sort((left, right) => left.role.localeCompare(right.role));

  const identity: ContractBundleManifestIdentity = {
    manifestSchemaVersion: CONTRACT_BUNDLE_MANIFEST_SCHEMA_VERSION,
    bundleId: `${spec.ownerEngine}.${spec.processorId}`,
    bundleVersion: spec.processorVersion,
    ownerEngine: spec.ownerEngine,
    owningBranch: spec.owningBranch,
    architectureRepository,
    architectureCommitSha: commitSha,
    processorId: spec.processorId,
    processorVersion: spec.processorVersion,
    outputContractId: spec.outputContractId,
    outputContractVersion: spec.outputContractVersion,
    evidenceContractId: spec.evidenceContractId,
    evidenceContractVersion: spec.evidenceContractVersion,
    ownedObjectSemanticIds: [...spec.ownedObjectSemanticIds],
    ownedPathPatterns: [...spec.ownedPathPatterns],
    generatedNotice: "GENERATED — DO NOT EDIT",
    generatorVersion: CONTRACT_BUNDLE_GENERATOR_VERSION,
  };
  const manifest: ContractBundleManifest = {
    ...identity,
    artifacts: entries,
    bundleContentHash: sha256Canonical(bundleHashInput(identity, entries)),
  };
  const prefix = join(spec.processorId, spec.processorVersion);
  return [
    {
      relativePath: join(prefix, "manifest.json"),
      bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    },
    ...entries.map((entry) => ({
      relativePath: join(prefix, entry.path),
      bytes: sourceBytes[entry.role],
    })),
  ];
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

function verifyGeneratedFiles(
  outputRoot: string,
  expected: readonly GeneratedFile[],
): void {
  const expectedPaths = expected
    .map((file) => file.relativePath.split(sep).join("/"))
    .sort();
  const actualPaths = listFiles(outputRoot).sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
    throw new Error(
      `Generated bundle file set drift: actual=${actualPaths.join(",")} expected=${expectedPaths.join(",")}`,
    );
  }
  for (const file of expected) {
    const actual = readFileSync(join(outputRoot, file.relativePath));
    if (!actual.equals(file.bytes)) {
      throw new Error(`Generated bundle content drift: ${file.relativePath}`);
    }
  }
}

export function generateContractBundles(options: GenerateOptions): void {
  const sourceRoot = resolve(options.sourceRoot);
  const outputRoot = resolve(options.outputRoot);
  const architectureRepository =
    options.architectureRepository ?? ARCHITECTURE_REPOSITORY;
  const specs = options.specs ?? CONTRACT_SOURCE_SPECS;
  assertExactCleanSource(sourceRoot, options.commitSha);

  const bundleFiles = specs.map((spec) =>
    buildBundle(sourceRoot, options.commitSha, architectureRepository, spec),
  );
  const registrations = bundleFiles.map((files) => {
    const manifestFile = files.find((file) =>
      file.relativePath.endsWith("manifest.json"),
    );
    if (!manifestFile) throw new Error("Generated bundle has no manifest");
    const manifest = JSON.parse(
      manifestFile.bytes.toString("utf8"),
    ) as ContractBundleManifest;
    return {
      processorId: manifest.processorId,
      processorVersion: manifest.processorVersion,
      outputContractId: manifest.outputContractId,
      outputContractVersion: manifest.outputContractVersion,
      bundleId: manifest.bundleId,
      bundleVersion: manifest.bundleVersion,
      bundleContentHash: manifest.bundleContentHash,
      ownedObjectSemanticIds: manifest.ownedObjectSemanticIds,
      ownedPathPatterns: manifest.ownedPathPatterns,
      structuralValidatorId: "contract_output_schema_v1",
      semanticValidatorId: manifest.processorId,
      persistenceValidatorId: "intelligence_persistence_transition_v1",
      bundled: true,
      registered: true,
      executionEnabled: false,
    };
  });
  const registry = {
    generatedNotice: "GENERATED — DO NOT EDIT",
    generatorVersion: CONTRACT_BUNDLE_GENERATOR_VERSION,
    architectureRepository,
    architectureCommitSha: options.commitSha,
    registrations,
  };
  const files = [
    {
      relativePath: "registry.json",
      bytes: Buffer.from(`${JSON.stringify(registry, null, 2)}\n`, "utf8"),
    },
    ...bundleFiles.flat(),
  ].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (options.verifyOnly) {
    verifyGeneratedFiles(outputRoot, files);
    return;
  }

  const parent = dirname(outputRoot);
  mkdirSync(parent, { recursive: true });
  const temporary = mkdtempSync(
    join(tmpdir(), "intelligence-contract-bundles-"),
  );
  try {
    for (const file of files) {
      const destination = join(temporary, file.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.bytes);
    }
    if (existsSync(outputRoot)) {
      const safe =
        basename(outputRoot) === "contract-bundles" &&
        statSync(outputRoot).isDirectory();
      if (!safe)
        throw new Error(
          `Refusing to replace unsafe output path '${outputRoot}'`,
        );
      rmSync(outputRoot, { recursive: true, force: true });
    }
    renameSync(temporary, outputRoot);
  } finally {
    if (existsSync(temporary))
      rmSync(temporary, { recursive: true, force: true });
  }
}

function cli(): void {
  const args = process.argv.slice(2);
  const value = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const sourceRoot = value("--source");
  const commitSha = value("--commit");
  if (!sourceRoot || !commitSha) {
    throw new Error(
      "Usage: npm run intelligence:contracts:generate -- --source <clean-checkout> --commit <40-char-sha> [--verify]",
    );
  }
  generateContractBundles({
    sourceRoot,
    commitSha,
    outputRoot: join(process.cwd(), GENERATED_DIRECTORY),
    verifyOnly: args.includes("--verify"),
  });
  process.stdout.write(
    `${args.includes("--verify") ? "verified" : "generated"} contract bundles from ${commitSha}\n`,
  );
}

if (require.main === module) cli();

export const DEFAULT_PINNED_ARCHITECTURE_COMMIT = PINNED_ARCHITECTURE_COMMIT;

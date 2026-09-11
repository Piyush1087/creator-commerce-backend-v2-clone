import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sha256Canonical } from "./canonical-json";
import {
  bundleHashInput,
  generateContractBundles,
} from "./contract-bundle.generator";
import type {
  ContractArtifactRole,
  ContractBundleManifest,
  ContractBundleManifestIdentity,
  ContractSourceSpec,
} from "./contract-bundle.types";
import { CONTRACT_SOURCE_SPECS } from "./contract-source.spec";

const GENERATED_ROOT = join(
  process.cwd(),
  "src",
  "features",
  "brand-intelligence",
  "generated",
  "contract-bundles",
);

const temporaryRoots: string[] = [];

function sourceSpec(processorId: string): ContractSourceSpec {
  const spec = CONTRACT_SOURCE_SPECS.find(
    (candidate) => candidate.processorId === processorId,
  );
  if (!spec) throw new Error(`Missing contract source spec '${processorId}'`);
  return spec;
}

function command(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  }).trim();
}

function createArchitectureFixture(): { root: string; sha: string } {
  const root = mkdtempSync(join(tmpdir(), "contract-source-"));
  temporaryRoots.push(root);
  for (const spec of CONTRACT_SOURCE_SPECS) {
    const manifest = JSON.parse(
      readFileSync(
        join(
          GENERATED_ROOT,
          spec.processorId,
          spec.processorVersion,
          "manifest.json",
        ),
        "utf8",
      ),
    ) as ContractBundleManifest;
    for (const entry of manifest.artifacts) {
      const sourcePath = spec.artifactPaths[entry.role as ContractArtifactRole];
      const destination = join(root, sourcePath);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(
        join(
          GENERATED_ROOT,
          spec.processorId,
          spec.processorVersion,
          entry.path,
        ),
        destination,
        { force: true },
      );
    }
  }
  command(root, "init");
  command(root, "config", "user.email", "contract-test@example.invalid");
  command(root, "config", "user.name", "Contract Test");
  command(root, "add", ".");
  command(root, "commit", "-m", "fixture");
  return { root, sha: command(root, "rev-parse", "HEAD") };
}

function files(root: string, base = root): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? files(path, base)
      : [relative(base, path).replaceAll("\\", "/")];
  });
}

function snapshot(root: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...files(root)]
      .sort()
      .map((path) => [path, readFileSync(join(root, path)).toString("base64")]),
  );
}

function outputRoot(): string {
  const parent = mkdtempSync(join(tmpdir(), "contract-output-"));
  temporaryRoots.push(parent);
  return join(parent, "contract-bundles");
}

function manifest(root: string, processorId: string): ContractBundleManifest {
  return JSON.parse(
    readFileSync(join(root, processorId, "1.0", "manifest.json"), "utf8"),
  ) as ContractBundleManifest;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("deterministic contract bundle generator", () => {
  it("repins one processor while preserving the other bundle byte-for-byte", () => {
    const source = createArchitectureFixture();
    const first = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: first,
      commitSha: source.sha,
    });
    const artifact =
      sourceSpec("brand_meaning").artifactPaths.EVIDENCE_CONTRACT;
    writeFileSync(
      join(source.root, artifact),
      readFileSync(join(source.root, artifact), "utf8") + "\n",
    );
    command(source.root, "add", artifact);
    command(source.root, "commit", "-m", "bounded meaning amendment");
    const amended = command(source.root, "rev-parse", "HEAD");
    const second = outputRoot();
    const options = {
      sourceRoot: source.root,
      outputRoot: second,
      commitSha: amended,
      processorCommitShas: {
        brand_communication: source.sha,
        brand_meaning: amended,
      },
    };
    generateContractBundles(options);
    generateContractBundles({ ...options, verifyOnly: true });
    expect(snapshot(join(first, "brand_communication"))).toEqual(
      snapshot(join(second, "brand_communication")),
    );
    expect(snapshot(join(first, "brand_meaning"))).not.toEqual(
      snapshot(join(second, "brand_meaning")),
    );
    expect(() =>
      generateContractBundles({
        ...options,
        processorCommitShas: { brand_meaning: "not-a-sha" },
      }),
    ).toThrow("Invalid processor architecture pin");
  });
  it("produces byte-identical manifests and bundle hashes from canonical inputs", () => {
    const source = createArchitectureFixture();
    const first = outputRoot();
    const second = outputRoot();
    for (const outputRoot of [first, second]) {
      generateContractBundles({
        sourceRoot: source.root,
        outputRoot,
        commitSha: source.sha,
        architectureRepository: "fixture/architecture",
      });
    }
    expect(snapshot(first)).toEqual(snapshot(second));
  });

  it("makes artifact ordering irrelevant and excludes the self-hash", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(GENERATED_ROOT, "brand_meaning", "1.0", "manifest.json"),
        "utf8",
      ),
    ) as ContractBundleManifest;
    const { artifacts, bundleContentHash: _excluded, ...identity } = manifest;
    expect(
      sha256Canonical(
        bundleHashInput(identity as ContractBundleManifestIdentity, artifacts),
      ),
    ).toBe(
      sha256Canonical(
        bundleHashInput(
          identity as ContractBundleManifestIdentity,
          [...artifacts].reverse(),
        ),
      ),
    );
  });

  it("changes artifact and bundle hashes after one committed byte changes", () => {
    const source = createArchitectureFixture();
    const first = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: first,
      commitSha: source.sha,
      architectureRepository: "fixture/architecture",
    });
    const artifact = sourceSpec("brand_communication").artifactPaths
      .REASONING_CONTRACT;
    writeFileSync(
      join(source.root, artifact),
      `${readFileSync(join(source.root, artifact), "utf8")} `,
    );
    command(source.root, "add", artifact);
    command(source.root, "commit", "-m", "one-byte-change");
    const changedSha = command(source.root, "rev-parse", "HEAD");
    const second = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: second,
      commitSha: changedSha,
      architectureRepository: "fixture/architecture",
    });
    const manifest = (root: string) =>
      JSON.parse(
        readFileSync(
          join(root, "brand_communication", "1.0", "manifest.json"),
          "utf8",
        ),
      ) as ContractBundleManifest;
    const before = manifest(first);
    const after = manifest(second);
    expect(
      before.artifacts.find((entry) => entry.role === "REASONING_CONTRACT")
        ?.sha256,
    ).not.toBe(
      after.artifacts.find((entry) => entry.role === "REASONING_CONTRACT")
        ?.sha256,
    );
    expect(before.bundleContentHash).not.toBe(after.bundleContentHash);
  });

  it("reads an independently pinned Instagram authority commit byte-for-byte", () => {
    const source = createArchitectureFixture();
    const instagram = sourceSpec("instagram_content_behavior");
    const first = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: first,
      commitSha: source.sha,
      specs: [instagram],
    });
    const reasoningPath = instagram.artifactPaths.REASONING_CONTRACT;
    writeFileSync(
      join(source.root, reasoningPath),
      `${readFileSync(join(source.root, reasoningPath), "utf8")} `,
    );
    command(source.root, "add", reasoningPath);
    command(source.root, "commit", "-m", "independent-instagram-authority");
    const independentSha = command(source.root, "rev-parse", "HEAD");
    command(source.root, "checkout", "--detach", source.sha);
    expect(() =>
      command(
        source.root,
        "merge-base",
        "--is-ancestor",
        independentSha,
        source.sha,
      ),
    ).toThrow();

    const second = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: second,
      commitSha: source.sha,
      specs: [instagram],
      processorCommitShas: { instagram_content_behavior: independentSha },
    });
    const before = manifest(first, instagram.processorId);
    const after = manifest(second, instagram.processorId);
    expect(after.architectureCommitSha).toBe(independentSha);
    expect(
      before.artifacts.find((entry) => entry.role === "REASONING_CONTRACT")
        ?.sha256,
    ).not.toBe(
      after.artifacts.find((entry) => entry.role === "REASONING_CONTRACT")
        ?.sha256,
    );
    expect(before.bundleContentHash).not.toBe(after.bundleContentHash);
    expect(
      readFileSync(
        join(
          second,
          instagram.processorId,
          instagram.processorVersion,
          "artifacts/reasoning_contract.yaml",
        ),
      ),
    ).toEqual(
      execFileSync("git", [
        "-C",
        source.root,
        "show",
        `${independentSha}:${reasoningPath}`,
      ]),
    );
  });

  it("cannot replace committed authority bytes with a backend-only string", () => {
    const source = createArchitectureFixture();
    const instagram = sourceSpec("instagram_content_behavior");
    const injected = {
      ...instagram,
      backendOnlyArtifactText: Object.fromEntries(
        Object.keys(instagram.artifactPaths).map((role) => [
          role,
          "status: FROZEN\nmalicious: backend-only\n",
        ]),
      ),
    } as ContractSourceSpec;
    const output = outputRoot();
    generateContractBundles({
      sourceRoot: source.root,
      outputRoot: output,
      commitSha: source.sha,
      specs: [injected],
    });
    for (const entry of manifest(output, instagram.processorId).artifacts) {
      expect(
        readFileSync(
          join(
            output,
            instagram.processorId,
            instagram.processorVersion,
            entry.path,
          ),
        ),
      ).toEqual(
        readFileSync(
          join(
            source.root,
            instagram.artifactPaths[entry.role as ContractArtifactRole],
          ),
        ),
      );
    }
  });

  it("fails closed for missing, wrong-path, and invalid independent authority", () => {
    const source = createArchitectureFixture();
    const instagram = sourceSpec("instagram_content_behavior");
    const withArtifactPath = (path: string): ContractSourceSpec => ({
      ...instagram,
      artifactPaths: { ...instagram.artifactPaths, EVIDENCE_CONTRACT: path },
    });
    expect(() =>
      generateContractBundles({
        sourceRoot: source.root,
        outputRoot: outputRoot(),
        commitSha: source.sha,
        specs: [withArtifactPath("missing/evidence.yaml")],
      }),
    ).toThrow("Required source artifact is missing");
    expect(() =>
      generateContractBundles({
        sourceRoot: source.root,
        outputRoot: outputRoot(),
        commitSha: source.sha,
        specs: [withArtifactPath(instagram.artifactPaths.PROCESSOR_DEFINITION)],
      }),
    ).toThrow("processor/owner mismatch");
    expect(() =>
      generateContractBundles({
        sourceRoot: source.root,
        outputRoot: outputRoot(),
        commitSha: source.sha,
        specs: [instagram],
        processorCommitShas: {
          instagram_content_behavior:
            "0000000000000000000000000000000000000000",
        },
      }),
    ).toThrow("Independent authority commit does not exist");
  });

  it("detects verify-only generated-file drift", () => {
    const source = createArchitectureFixture();
    const output = outputRoot();
    const options = {
      sourceRoot: source.root,
      outputRoot: output,
      commitSha: source.sha,
      architectureRepository: "fixture/architecture",
    };
    generateContractBundles(options);
    const generatedArtifact = join(
      output,
      "instagram_content_behavior",
      "1.0",
      "artifacts",
      "object_contract.yaml",
    );
    writeFileSync(
      generatedArtifact,
      `${readFileSync(generatedArtifact, "utf8")} `,
    );
    expect(() =>
      generateContractBundles({ ...options, verifyOnly: true }),
    ).toThrow("Generated bundle content drift");
  });

  it("fails dirty, non-frozen, and cross-linked Object ownership sources", () => {
    const dirty = createArchitectureFixture();
    const processorPath = sourceSpec("brand_communication").artifactPaths
      .PROCESSOR_DEFINITION;
    writeFileSync(
      join(dirty.root, processorPath),
      `${readFileSync(join(dirty.root, processorPath), "utf8")} `,
    );
    expect(() =>
      generateContractBundles({
        sourceRoot: dirty.root,
        outputRoot: outputRoot(),
        commitSha: dirty.sha,
        architectureRepository: "fixture/architecture",
      }),
    ).toThrow("dirty");

    const invalid = createArchitectureFixture();
    const outputPath = sourceSpec("brand_communication").artifactPaths
      .OUTPUT_CONTRACT;
    const changed = readFileSync(
      join(invalid.root, outputPath),
      "utf8",
    ).replace("object: communication_profile", "object: brand_description");
    writeFileSync(join(invalid.root, outputPath), changed);
    command(invalid.root, "add", outputPath);
    command(invalid.root, "commit", "-m", "wrong-object");
    expect(() =>
      generateContractBundles({
        sourceRoot: invalid.root,
        outputRoot: outputRoot(),
        commitSha: command(invalid.root, "rev-parse", "HEAD"),
        architectureRepository: "fixture/architecture",
      }),
    ).toThrow("Object ownership mismatch");

    const proposed = createArchitectureFixture();
    const evidencePath =
      sourceSpec("brand_meaning").artifactPaths.EVIDENCE_CONTRACT;
    writeFileSync(
      join(proposed.root, evidencePath),
      readFileSync(join(proposed.root, evidencePath), "utf8").replace(
        "status: FROZEN",
        "status: PROPOSED",
      ),
    );
    command(proposed.root, "add", evidencePath);
    command(proposed.root, "commit", "-m", "proposed");
    expect(() =>
      generateContractBundles({
        sourceRoot: proposed.root,
        outputRoot: outputRoot(),
        commitSha: command(proposed.root, "rev-parse", "HEAD"),
        architectureRepository: "fixture/architecture",
      }),
    ).toThrow("status must be FROZEN");
  });
});

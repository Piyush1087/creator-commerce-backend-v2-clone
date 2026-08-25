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
    files(root)
      .sort()
      .map((path) => [path, readFileSync(join(root, path)).toString("base64")]),
  );
}

function outputRoot(): string {
  const parent = mkdtempSync(join(tmpdir(), "contract-output-"));
  temporaryRoots.push(parent);
  return join(parent, "contract-bundles");
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("deterministic contract bundle generator", () => {
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
    const artifact = CONTRACT_SOURCE_SPECS[0].artifactPaths.REASONING_CONTRACT;
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

  it("fails dirty, non-frozen, and cross-linked Object ownership sources", () => {
    const dirty = createArchitectureFixture();
    const processorPath =
      CONTRACT_SOURCE_SPECS[0].artifactPaths.PROCESSOR_DEFINITION;
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
    const outputPath = CONTRACT_SOURCE_SPECS[0].artifactPaths.OUTPUT_CONTRACT;
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
      CONTRACT_SOURCE_SPECS[1].artifactPaths.EVIDENCE_CONTRACT;
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

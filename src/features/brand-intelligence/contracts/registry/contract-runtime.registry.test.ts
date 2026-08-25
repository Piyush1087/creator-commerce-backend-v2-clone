import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "../bundle/contract-bundle.integrity";
import type { ContractBundleManifest } from "../bundle/contract-bundle.types";
import { SemanticValidator } from "../validation/semantic.validator";
import { ContractRuntimeRegistry } from "./contract-runtime.registry";

const GENERATED_ROOT = join(
  process.cwd(),
  "src",
  "features",
  "brand-intelligence",
  "generated",
  "contract-bundles",
);
const COMMUNICATION_MANIFEST = join(
  "brand_communication",
  "1.0",
  "manifest.json",
);
const temporaryRoots: string[] = [];

function registry(): ContractRuntimeRegistry {
  return new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
}

function copiedRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "contract-runtime-"));
  temporaryRoots.push(root);
  cpSync(GENERATED_ROOT, root, { recursive: true });
  return root;
}

function mutateJson(
  path: string,
  change: (value: Record<string, unknown>) => void,
): void {
  const value = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    unknown
  >;
  change(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("contract runtime registry and startup integrity", () => {
  it("returns only verified exact allow-listed keys with bounded activation", () => {
    const runtime = registry();
    runtime.verifyAtRoot(GENERATED_ROOT);
    expect(runtime.isReady()).toBe(true);
    expect(runtime.registrations()).toHaveLength(2);
    expect(
      runtime
        .registrations()
        .map((entry) => [entry.processorId, entry.executionEnabled]),
    ).toEqual([
      ["brand_communication", true],
      ["brand_meaning", false],
    ]);
    expect(
      runtime.getVerifiedBundle({
        processorId: "brand_communication",
        processorVersion: "1.0",
        outputContractId: "brand_communication_output_contract",
        outputContractVersion: "1.0",
      }).manifest.bundleId,
    ).toBe("brand_intelligence.brand_communication");
  });

  it.each([
    [
      "unknown processor",
      "unknown",
      "1.0",
      "brand_communication_output_contract",
      "1.0",
    ],
    [
      "wrong processor version",
      "brand_communication",
      "2.0",
      "brand_communication_output_contract",
      "1.0",
    ],
    [
      "wrong output-contract version",
      "brand_communication",
      "1.0",
      "brand_communication_output_contract",
      "2.0",
    ],
  ])(
    "fails closed for %s",
    (
      _label,
      processorId,
      processorVersion,
      outputContractId,
      outputContractVersion,
    ) => {
      const runtime = registry();
      runtime.verifyAtRoot(GENERATED_ROOT);
      expect(() =>
        runtime.getVerifiedBundle({
          processorId,
          processorVersion,
          outputContractId,
          outputContractVersion,
        }),
      ).toThrow("not allow-listed");
    },
  );

  it.each([
    [
      "wrong owning branch",
      (value: Record<string, unknown>) => (value.owningBranch = "audience"),
    ],
    [
      "wrong Object ownership",
      (value: Record<string, unknown>) =>
        (value.ownedObjectSemanticIds = ["audience_profile"]),
    ],
    [
      "wrong Evidence-contract version",
      (value: Record<string, unknown>) =>
        (value.evidenceContractVersion = "2.0"),
    ],
    [
      "wrong bundle version",
      (value: Record<string, unknown>) => (value.bundleVersion = "2.0"),
    ],
  ])("rejects manifest drift: %s", (_label, change) => {
    const root = copiedRoot();
    mutateJson(join(root, COMMUNICATION_MANIFEST), change);
    expect(() => registry().verifyAtRoot(root)).toThrow("identity");
  });

  it("rejects changed bytes, missing required files, and unexpected files", () => {
    const changed = copiedRoot();
    const artifact = join(
      changed,
      "brand_communication",
      "1.0",
      "artifacts",
      "reasoning_contract.yaml",
    );
    writeFileSync(artifact, `${readFileSync(artifact, "utf8")} `);
    expect(() => registry().verifyAtRoot(changed)).toThrow("integrity failed");

    const missing = copiedRoot();
    unlinkSync(
      join(
        missing,
        "brand_meaning",
        "1.0",
        "artifacts",
        "evidence_contract.yaml",
      ),
    );
    expect(() => registry().verifyAtRoot(missing)).toThrow(
      "Missing required artifact",
    );

    const unexpected = copiedRoot();
    writeFileSync(join(unexpected, "manual.yaml"), "status: FROZEN\n");
    expect(() => registry().verifyAtRoot(unexpected)).toThrow(
      "file set contains drift",
    );
  });

  it("rejects registry bundle/hash drift and unregistered validators", () => {
    for (const change of [
      (entry: Record<string, unknown>) => (entry.bundleId = "unknown.bundle"),
      (entry: Record<string, unknown>) =>
        (entry.bundleContentHash = "0".repeat(64)),
      (entry: Record<string, unknown>) =>
        (entry.semanticValidatorId = "dynamic.module"),
    ]) {
      const root = copiedRoot();
      mutateJson(join(root, "registry.json"), (value) => {
        const registrations = value.registrations as Record<string, unknown>[];
        change(registrations[0]);
      });
      expect(() => registry().verifyAtRoot(root)).toThrow();
    }
  });

  it("isolates integrity failure as Brand Intelligence NOT_READY", () => {
    const root = copiedRoot();
    unlinkSync(
      join(root, "brand_meaning", "1.0", "artifacts", "object_contract.yaml"),
    );
    const runtime = registry();
    expect(() => runtime.initializeAtRoot(root)).not.toThrow();
    expect(runtime.isReady()).toBe(false);
    expect(runtime.readinessFailure()?.code).toBe("MISSING_BUNDLE_FILE");
    expect(() =>
      runtime.getVerifiedBundle({
        processorId: "brand_meaning",
        processorVersion: "1.0",
        outputContractId: "brand_meaning_output_contract",
        outputContractVersion: "1.0",
      }),
    ).toThrow("NOT_READY");
  });

  it("contains no executable contract code or operational provider/model selection", () => {
    const source = [
      readFileSync(
        join(
          process.cwd(),
          "src/features/brand-intelligence/contracts/bundle/contract-bundle.integrity.ts",
        ),
        "utf8",
      ),
      readFileSync(
        join(
          process.cwd(),
          "src/features/brand-intelligence/contracts/validation/semantic.validator.ts",
        ),
        "utf8",
      ),
    ].join("\n");
    expect(source).not.toMatch(
      /\beval\s*\(|\bFunction\s*\(|require\s*\(\s*(?!["'])/u,
    );

    const generated = readFileSync(
      join(
        GENERATED_ROOT,
        "brand_meaning",
        "1.0",
        "artifacts",
        "reasoning_contract.yaml",
      ),
      "utf8",
    );
    expect(generated).not.toMatch(
      /Gemini|OpenAI|Claude|temperature\s*:|token_budget\s*:/iu,
    );
  });
});

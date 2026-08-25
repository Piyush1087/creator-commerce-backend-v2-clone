import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(
  process.cwd(),
  "src",
  "features",
  "data-extraction",
  "evidence",
);

function productionFiles(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const current = join(path, name);
    if (statSync(current).isDirectory()) return productionFiles(current);
    return current.endsWith(".ts") && !current.endsWith(".test.ts")
      ? [current]
      : [];
  });
}

describe("DE-W1.0A architecture boundary", () => {
  it("contains provider-neutral domain/contracts only", () => {
    const source = productionFiles(root)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
      .toLowerCase();

    for (const forbidden of [
      "brand-intelligence/persistence",
      "brand-preview/runtime",
      "brand-preview/synthesis",
      "gemini",
      "openai",
      "zyte",
      "playwright",
      "@controller",
      "controller(",
      "frontend",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("does not expose generic destructive Evidence repository operations", () => {
    const source = productionFiles(root)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    for (const forbidden of [
      "updateEvidence(",
      "overwriteCapture(",
      "deleteEvidence(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps read and acquisition operations explicitly separate", () => {
    const source = readFileSync(
      join(root, "ports", "evidence-runtime.ports.ts"),
      "utf8",
    );
    expect(source).toContain("interface DataExtractionEvidenceQueryPortV1");
    expect(source).toContain("readExisting(");
    expect(source).toContain(
      "interface DataExtractionCapabilityAcquisitionPortV1",
    );
    expect(source).toContain("request(");
  });
});

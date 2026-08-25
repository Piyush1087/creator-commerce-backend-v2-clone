import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(
  process.cwd(),
  "src",
  "features",
  "data-extraction",
  "evidence",
  "normalization",
);
const productionFiles = [
  "owned-website-wave1-normalizers.ts",
  "owned-website-wave1-normalization.service.ts",
];

function importsOnly(): string {
  return productionFiles
    .flatMap((file) =>
      readFileSync(join(root, file), "utf8")
        .split("\n")
        .filter((line) => line.trim().startsWith("import ")),
    )
    .join("\n")
    .toLowerCase();
}

describe("DE-W1.0E architecture boundary", () => {
  it("does not import acquisition/provider, Intelligence execution, Preview runtime or frontend modules", () => {
    const imports = importsOnly();
    for (const forbidden of [
      "zyte",
      "playwright",
      "http",
      "brand-intelligence/persistence",
      "brand-intelligence/process",
      "brand-preview/runtime",
      "frontend",
      "instagram",
      "controller",
      "resolver",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });

  it("contains no network primitive in E production code", () => {
    const source = productionFiles
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
    expect(source).not.toContain("request(");
  });

  it("writes only through DE Evidence/observation/capability repositories", () => {
    const source = readFileSync(
      join(root, "owned-website-wave1-normalization.service.ts"),
      "utf8",
    );
    expect(source).toContain("tx.evidenceItems.insertOrGetExact");
    expect(source).toContain("tx.capabilityEvidence.attach");
    expect(source).toContain("tx.semanticObservations.attachSupport");
    for (const forbidden of [
      "brandProfile.update",
      "product.create",
      "offering.create",
      "brandCentre",
      "industry.update",
      "audience.create",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("does not bind the Intelligence adapter or enable real processors", () => {
    const source = productionFiles
      .map((file) => readFileSync(join(root, file), "utf8"))
      .join("\n");
    expect(source).not.toContain("DataExtractionIntelligenceEvidenceAdapter");
    expect(source).not.toContain("MissingDataExtractionEvidenceAdapter");
    expect(source).not.toContain("brand_communication.execute");
    expect(source).not.toContain("brand_meaning.execute");
  });
});

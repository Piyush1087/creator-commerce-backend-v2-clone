import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const evidenceRoot = join(
  process.cwd(),
  "src",
  "features",
  "data-extraction",
  "evidence",
);
const querySource = readFileSync(
  join(evidenceRoot, "query", "data-extraction-evidence-query.service.ts"),
  "utf8",
);
const adapterSource = readFileSync(
  join(
    evidenceRoot,
    "intelligence",
    "data-extraction-intelligence-evidence.adapter.ts",
  ),
  "utf8",
);
const fSource = `${querySource}\n${adapterSource}`;
const intelligenceModule = readFileSync(
  join(
    process.cwd(),
    "src",
    "features",
    "brand-intelligence",
    "brand-intelligence.module.ts",
  ),
  "utf8",
);
const dataExtractionModule = readFileSync(
  join(
    process.cwd(),
    "src",
    "features",
    "data-extraction",
    "data-extraction.module.ts",
  ),
  "utf8",
);

describe("DE-W1.0F production reader architecture", () => {
  it("has no acquisition, normalization, provider, Preview, legacy scan, or transport dependency", () => {
    const imports = fSource
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import "))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "/acquisition/",
      "/normalization/",
      "zyte",
      "playwright",
      "cheerio",
      "gemini",
      "openai",
      "brand-preview",
      "stage1",
      "frontend",
      "controller",
      "resolver",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });

  it("is read-only and cannot persist, acquire, normalize, or hydrate raw Content Artifacts", () => {
    for (const forbidden of [
      "withTransaction",
      ".create(",
      ".insert(",
      ".attach(",
      ".complete(",
      "contentArtifacts",
      "OwnedWebsiteWave1AcquisitionService",
      "OwnedWebsiteWave1NormalizationService",
      "fetch(",
    ]) {
      expect(fSource).not.toContain(forbidden);
    }
    expect(querySource).toContain("findLatestCompleted");
    expect(querySource).toContain("evidenceItems.findByRef");
    expect(querySource).not.toContain("capability-execution:not-requested");
    expect(querySource).not.toContain("MISSING_RESULT_TIMESTAMP");
  });

  it("does not use IntelligenceEvidenceReference or any legacy source as the DE store", () => {
    for (const forbidden of [
      "IntelligenceEvidenceReference",
      "BrandProfile",
      "Stage1B",
      "previewRun",
      "provider response",
    ]) {
      expect(fSource).not.toContain(forbidden);
    }
  });

  it("binds production Intelligence reads to the exported DE adapter without a circular module import", () => {
    expect(intelligenceModule).toContain("DataExtractionModule");
    expect(intelligenceModule).toContain("BrandCanonicalStateModule");
    expect(intelligenceModule).toContain("NotificationsModule");
    expect(intelligenceModule).toContain(
      "useExisting: DataExtractionIntelligenceEvidenceAdapter",
    );
    expect(intelligenceModule).not.toContain(
      "useClass: MissingDataExtractionEvidenceAdapter",
    );
    expect(intelligenceModule).toContain(
      "MissingDataExtractionEvidenceAdapter",
    );
    expect(dataExtractionModule).toContain(
      "DataExtractionIntelligenceEvidenceAdapter",
    );
    expect(dataExtractionModule).toContain(
      "DATA_EXTRACTION_EVIDENCE_QUERY_PORT_V1",
    );
    expect(dataExtractionModule).not.toContain("BrandIntelligenceModule");
  });
});

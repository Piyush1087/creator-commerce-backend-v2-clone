import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const persistenceDir = join(__dirname, "persistence");
const persistenceSources = readdirSync(persistenceDir)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => readFileSync(join(persistenceDir, name), "utf8"))
  .join("\n");

const moduleSource = readFileSync(
  join(__dirname, "..", "data-extraction.module.ts"),
  "utf8",
);

describe("DE-W1.0C repository architecture guards", () => {
  it("keeps persistence provider-neutral and outside acquisition/normalizer dependencies", () => {
    for (const forbidden of [
      "zyte",
      "playwright",
      "cheerio",
      "gemini",
      "openai",
      "brand-preview",
      "brand-intelligence",
      "frontend",
      "controller",
      "resolver",
      "DataExtractionIntelligenceEvidenceAdapter",
      "MissingDataExtractionEvidenceAdapter",
    ]) {
      expect(persistenceSources.toLowerCase()).not.toContain(
        forbidden.toLowerCase(),
      );
    }
  });

  it("preserves W1.0A repository ports as the domain-facing boundary", () => {
    expect(persistenceSources).toContain("implements ResourceRepository");
    expect(persistenceSources).toContain("implements CaptureRepository");
    expect(persistenceSources).toContain("implements EvidenceItemRepository");
    expect(persistenceSources).toContain("implements CapabilityExecutionRepository");
    expect(persistenceSources).not.toContain("export type PrismaResource");
    expect(persistenceSources).not.toContain("export type PrismaCapture");
  });

  it("registers persistence internally without exporting a controller or resolver", () => {
    expect(moduleSource).toContain("DataExtractionPersistenceService");
    const exportsBlock = moduleSource.split("exports:")[1] ?? "";
    expect(exportsBlock).not.toContain("DataExtractionPersistenceService");
    expect(moduleSource).not.toContain("controllers:");
    expect(moduleSource).not.toContain("resolvers:");
  });

  it("exposes a caller-owned transaction boundary instead of per-call forced transactions", () => {
    expect(persistenceSources).toContain("withTransaction<T>");
    expect(persistenceSources).toContain("Prisma.TransactionClient");
    expect(persistenceSources).toContain("createDataExtractionRepositorySet(tx)");
  });

  it("keeps conflict/equivalence bounded and winner-free", () => {
    expect(persistenceSources).toContain('"EQUIVALENT_TO"');
    expect(persistenceSources).toContain('"CONFLICTS_WITH"');
    expect(persistenceSources.toLowerCase()).not.toContain("winner");
    expect(persistenceSources.toLowerCase()).not.toContain("precedence");
  });
});

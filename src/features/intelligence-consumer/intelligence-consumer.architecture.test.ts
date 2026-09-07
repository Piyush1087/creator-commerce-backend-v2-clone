import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const moduleRoot = join(process.cwd(), "src/features/intelligence-consumer");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("Common Intelligence consumer architecture", () => {
  it("has no direct Intelligence or Data Extraction persistence dependency", () => {
    const forbidden = [
      "PrismaService",
      "IntelligenceCurrentStateRepository",
      "IntelligenceGenerationRepository",
      "IntelligenceCandidateRepository",
      "ProcessorExecutionRepository",
      "DataExtractionPersistenceService",
      "intelligenceSubject",
      "intelligenceObjectGeneration",
      "intelligenceComponentGeneration",
      "intelligenceProcessorExecution",
    ];
    for (const path of sourceFiles(moduleRoot)) {
      const source = readFileSync(path, "utf8");
      for (const dependency of forbidden) {
        expect(
          source,
          `${relative(moduleRoot, path)} directly references ${dependency}`,
        ).not.toContain(dependency);
      }
    }
  });

  it("depends only on authoritative Brand and Product domain consumers", () => {
    const brand = readFileSync(
      join(moduleRoot, "adapters/brand-intelligence-consumer.adapter.ts"),
      "utf8",
    );
    const product = readFileSync(
      join(moduleRoot, "adapters/product-intelligence-consumer.adapter.ts"),
      "utf8",
    );
    expect(brand).toContain("BrandConsumerService");
    expect(product).toContain("ProductConsumerService");
    expect(brand).toContain("domainPayload: payload");
    expect(product).toContain("domainPayload: payload");
  });

  it("registers an internal module without creating Chat, Home, or HTTP surfaces", () => {
    expect(
      readFileSync(join(process.cwd(), "src/app.module.ts"), "utf8"),
    ).toContain("IntelligenceConsumerModule");
    const productionFiles = sourceFiles(moduleRoot).map((path) =>
      relative(moduleRoot, path),
    );
    expect(
      productionFiles.some((path) => path.endsWith(".controller.ts")),
    ).toBe(false);
    expect(productionFiles.some((path) => /(?:chat|home)/iu.test(path))).toBe(
      false,
    );
  });
});

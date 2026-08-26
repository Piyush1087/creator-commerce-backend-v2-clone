import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const executionRoot = join(__dirname, "execution");

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith(".ts") && !path.endsWith(".test.ts")
        ? [path]
        : [];
  });
}

describe("W1.0D architecture boundary", () => {
  it("does not bind provider, M1, Data Extraction, HTTP, or GraphQL runtime code", () => {
    const source = sourceFiles(executionRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .toLowerCase();
    for (const forbidden of [
      "@google/genai",
      "@google/generative-ai",
      "openai",
      "zyte",
      "playwright",
      "controller(",
      "resolver(",
      "data-extraction",
      "brand-profile",
      "brand-preview",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("uses only the synthetic executor and four explicitly compiled real executors", () => {
    const registry = readFileSync(
      join(executionRoot, "executor", "processor-executor.registry.ts"),
      "utf8",
    );
    expect(registry).toContain("SYNTHETIC_PROCESSOR_ID");
    expect(registry).toContain("BrandCommunicationProcessorExecutor");
    expect(registry).toContain("BrandMeaningProcessorExecutor");
    expect(registry).toContain("BrandCharacterProcessorExecutor");
    expect(registry).toContain("AudiencePersonaProcessorExecutor");
    expect(registry).not.toContain("brand_communication");
    expect(registry).not.toContain("brand_meaning");
  });

  it("activates exactly the four accepted Brand processors", () => {
    const registry = JSON.parse(
      readFileSync(
        join(__dirname, "generated", "contract-bundles", "registry.json"),
        "utf8",
      ),
    ) as {
      registrations: Array<{
        processorId: string;
        bundled: boolean;
        registered: boolean;
        executionEnabled: boolean;
      }>;
    };
    expect(
      registry.registrations.map((registration) => ({
        processorId: registration.processorId,
        bundled: registration.bundled,
        registered: registration.registered,
        executionEnabled: registration.executionEnabled,
      })),
    ).toEqual([
      {
        processorId: "brand_communication",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "brand_meaning",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "brand_character",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "audience_persona_synthesis",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
    ]);
  });
});

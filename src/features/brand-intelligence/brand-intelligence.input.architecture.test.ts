import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import registry from "./generated/contract-bundles/registry.json";

const inputRoot = join(__dirname, "input");

function productionTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("W1.0E input-port architecture", () => {
  it("keeps the permanent canonical request Brand-ID-only", () => {
    const source = readFileSync(
      join(inputRoot, "canonical-state", "canonical-brand-state.port.ts"),
      "utf8",
    );
    expect(source).toContain("readonly brandId: string");
    expect(source).not.toMatch(/leadId|previewRunId|gatekeeperSubmissionId/);
  });

  it("does not couple input orchestration to provider, Preview, Gatekeeper, or transport modules", () => {
    const forbiddenImport =
      /^import[^;]+(?:zyte|playwright|cheerio|gemini|openai|brand-preview|gatekeeper|controller|resolver|frontend)[^;]*;/gim;
    for (const file of productionTypeScriptFiles(inputRoot)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(forbiddenImport);
    }
  });

  it("keeps input ports bounded with seven Brand and one Product executable", () => {
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
      {
        processorId: "brand_differentiation",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "visual_style_synthesis",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "serviceability_synthesis",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
      {
        processorId: "offering_factual_synthesis",
        bundled: true,
        registered: true,
        executionEnabled: true,
      },
    ]);
  });
});

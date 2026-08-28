import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contracts,
  registryKey,
  capabilities,
} from "./processors/brand-differentiation/brand-differentiation.test-fixtures";
import { READ_ONLY_OBJECT_CONTRACTS } from "./projection/current-read-contracts.generated";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";
import { PROCESSOR_ARCHITECTURE_COMMITS } from "./contracts/bundle/contract-source.spec";

describe("brand_differentiation architecture boundaries", () => {
  it("retains seven Brand processors, three Product processors, and six differentiation paths", () => {
    const runtime = contracts(),
      bundle = runtime.getVerifiedBundle(registryKey);
    expect(
      runtime
        .registrations()
        .filter((r) => r.executionEnabled)
        .map((r) => r.processorId)
        .sort(),
    ).toEqual([
      "audience_persona_synthesis",
      "brand_character",
      "brand_communication",
      "brand_differentiation",
      "brand_meaning",
      "offering_actionability_synthesis",
      "offering_creator_communication",
      "offering_factual_synthesis",
      "serviceability_synthesis",
      "visual_style_synthesis",
    ]);
    expect(PROCESSOR_ARCHITECTURE_COMMITS).toEqual({
      brand_communication: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
      brand_meaning: "2e13fa40235094d127f72b38f43c510232e38be4",
      brand_character: "56b52c1106feff2a92f23a7c49674fd116bf8c63",
      audience_persona_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      brand_differentiation: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      visual_style_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      serviceability_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      offering_factual_synthesis: "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
      offering_creator_communication:
        "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
      offering_actionability_synthesis:
        "bbb0be3345c36e9cc7c4f06ca68fb491b742b83f",
    });
    expect(bundle.manifest.ownedObjectSemanticIds).toEqual([
      "differentiation_and_proof",
    ]);
    expect(
      bundle.manifest.ownedPathPatterns
        .map((p) => p.componentPathPattern)
        .sort(),
    ).toEqual(
      [
        ...READ_ONLY_OBJECT_CONTRACTS.find(
          (c) => c.objectSemanticId === "differentiation_and_proof",
        )!.ownedPathPatterns,
      ].sort(),
    );
    const profile = new ProcessorDependencyProfileRegistry().resolve(bundle);
    expect(profile.capabilityIds).toEqual(capabilities);
    expect(profile.requiredCapabilityLineages).toEqual(capabilities);
    expect(profile.requiredCanonicalSemantics).toEqual([
      "brand_name",
      "website_url",
      "industry",
      "sub_industry",
    ]);
  });
  it("has no DE acquisition/write, Offering mutation, other BI current, transport or transaction engine", () => {
    const root = join(__dirname, "processors/brand-differentiation");
    for (const file of readdirSync(root).filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test-fixtures.ts"),
    )) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(
        /\.\$transaction\(|\.offering\.(create|update|delete|upsert)|\.brandProfile\.|\.dataExtraction\w+\.(create|update|delete)|intelligenceCurrentComponent\.(create|update|delete)|@Controller|@Resolver/u,
      );
      const imports =
        source.match(/^import[\s\S]*?from ["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports, file).not.toMatch(
        /brand-meaning|brand-character|brand-communication|audience-persona|evidence\/(acquisition|normalization)|brand-preview|frontend/iu,
      );
    }
    const identity = readFileSync(
      join(root, "brand-differentiation-identity.ts"),
      "utf8",
    );
    expect(identity).not.toMatch(
      /toLowerCase|wordOverlap|levenshtein|0\.8|embedding/iu,
    );
  });
});

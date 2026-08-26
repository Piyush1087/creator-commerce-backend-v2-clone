import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contracts,
  registryKey,
  capabilities,
} from "./processors/visual-style/visual-style.test-fixtures";
import { READ_ONLY_OBJECT_CONTRACTS } from "./projection/current-read-contracts.generated";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";

describe("visual_style_synthesis architecture boundaries", () => {
  it("pins the sixth executable to authority and owns exactly 22 frozen paths", () => {
    const runtime = contracts(),
      bundle = runtime.getVerifiedBundle(registryKey);
    expect(
      runtime.registrations().filter((r) => r.executionEnabled),
    ).toHaveLength(6);
    expect(
      runtime
        .registrations()
        .some(
          (r) =>
            r.processorId === "serviceability_synthesis" && r.executionEnabled,
        ),
    ).toBe(false);
    expect(bundle.manifest.architectureCommitSha).toBe(
      "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
    );
    expect(bundle.manifest.ownedObjectSemanticIds).toEqual([
      "visual_style_profile",
    ]);
    const paths = bundle.manifest.ownedPathPatterns
      .map((p) => p.componentPathPattern)
      .sort();
    expect(paths).toHaveLength(22);
    expect(paths).toEqual(
      [
        ...READ_ONLY_OBJECT_CONTRACTS.find(
          (c) => c.objectSemanticId === "visual_style_profile",
        )!.ownedPathPatterns,
      ].sort(),
    );
    const profile = new ProcessorDependencyProfileRegistry().resolve(bundle);
    expect(profile.capabilityIds).toEqual(capabilities);
    expect(profile.representativeEvidenceAnyOf).toEqual(capabilities);
    expect(profile.includeVisualState).toBe(true);
    expect(profile.requiredCanonicalSemantics).toEqual(["brand_name"]);
  });
  it("never writes canonical/DE state, owns transactions, chains BI, or infers fuzzy identity", () => {
    const root = join(__dirname, "processors/visual-style");
    for (const file of readdirSync(root).filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test-fixtures.ts"),
    )) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(
        /\.\$transaction\(|\.brandVisual\w*\.(create|update|delete|upsert)|\.dataExtraction\w*\.(create|update|delete)|intelligenceCurrentComponent\.(create|update|delete)|@Controller|@Resolver|\.save(Color|Asset|Typography)\(/u,
      );
      const imports =
        source.match(/^import[\s\S]*?from ["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports, file).not.toMatch(
        /brand-meaning|brand-character|brand-communication|audience-persona|brand-differentiation|evidence\/(acquisition|normalization)|brand-preview|frontend/iu,
      );
    }
    expect(
      readFileSync(join(root, "visual-style-identity.ts"), "utf8"),
    ).not.toMatch(
      /toLowerCase|wordOverlap|levenshtein|embedding|colorDistance|rgbDistance|threshold/iu,
    );
  });
});

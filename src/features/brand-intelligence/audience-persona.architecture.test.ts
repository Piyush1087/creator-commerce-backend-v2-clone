import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contracts,
  registryKey,
} from "./processors/audience-persona/audience-persona.test-fixtures";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";
import { BundlePathOwnershipRegistry } from "./contracts/registry/bundle-path-ownership.registry";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { READ_ONLY_OBJECT_CONTRACTS } from "./projection/current-read-contracts.generated";

describe("Audience processor boundaries", () => {
  it("owns the frozen Audience paths while retaining seven Brand and three Product processors", () => {
    const runtime = contracts(),
      bundle = runtime.getVerifiedBundle(registryKey);
    expect(bundle.manifest.architectureCommitSha).toBe(
      "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
    );
    expect(bundle.manifest.ownedObjectSemanticIds).toEqual([
      "audience_personas",
    ]);
    expect(
      bundle.manifest.ownedPathPatterns
        .map((p) => p.componentPathPattern)
        .sort(),
    ).toEqual(
      [
        ...READ_ONLY_OBJECT_CONTRACTS.find(
          (c) => c.objectSemanticId === "audience_personas",
        )!.ownedPathPatterns,
      ].sort(),
    );
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
    const ownership = new BundlePathOwnershipRegistry(
      runtime,
      new ComponentPathCodec(),
    );
    expect(
      ownership.ownsForBundle(registryKey, {
        brandId: "b",
        objectSemanticId: "positioning",
        pathSchemeVersion: 1,
        componentSemanticPath: "$",
      }),
    ).toBe(false);
  });
  it("no single Evidence capability, user input, Preview, Instagram or complete Offering is required", () => {
    const profile = new ProcessorDependencyProfileRegistry().resolve(
      contracts().getVerifiedBundle(registryKey),
    );
    expect(profile.representativeEvidenceAnyOf).toEqual(profile.capabilityIds);
    expect(profile.capabilityIds).toEqual([
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
    ]);
    expect(profile.nonNullableCanonicalAnchors).toEqual([
      "brand_name",
      "industry",
    ]);
  });
  it("contains no DE write/acquisition, Preview read, cross-processor current read, transport, or new transaction runtime", () => {
    const root = join(__dirname, "processors/audience-persona");
    for (const file of readdirSync(root).filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".test-fixtures.ts"),
    )) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, file).not.toMatch(
        /\.\$transaction\(|\.dataExtraction\w+\.(create|update|delete)|intelligenceCurrentComponent\.(create|update|delete)|@Controller|@Resolver|\.brandPreview|\.brandProfile\./u,
      );
      const imports =
        source.match(/^import[\s\S]*?from ["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports, file).not.toMatch(
        /brand-meaning|brand-character|brand-communication|evidence\/(acquisition|normalization)|brand-preview|controller|frontend/iu,
      );
    }
    const identity = readFileSync(
      join(root, "audience-persona-identity.ts"),
      "utf8",
    );
    expect(identity).not.toMatch(
      /similarity|toLowerCase|wordOverlap|levenshtein|0\.8/iu,
    );
  });
});

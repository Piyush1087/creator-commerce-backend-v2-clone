import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSOR_ARCHITECTURE_COMMITS } from "./contracts/bundle/contract-source.spec";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";
import {
  contracts,
  registryKey,
} from "./processors/brand-meaning/brand-meaning.test-fixtures";
import { BRAND_MEANING_SYSTEM_INSTRUCTION } from "./processors/brand-meaning/brand-meaning-prompt";

describe("brand_meaning activation boundaries", () => {
  it("has no communication, DE-write, Preview, legacy, or transport dependency", () => {
    for (const file of [
      "brand-meaning-processor.executor.ts",
      "brand-meaning-persistence.hook.ts",
      "brand-meaning-model.provider.ts",
      "brand-meaning-prompt.ts",
    ]) {
      const source = readFileSync(
        join(__dirname, "processors/brand-meaning", file),
        "utf8",
      );
      const imports =
        source.match(/^import[\s\S]*?from ["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports).not.toMatch(
        /brand-communication|projection|brand-preview|stage1b|legacy|frontend|controller|resolver|evidence\/(acquisition|normalization|persistence)|brand-profile/iu,
      );
      expect(source).not.toMatch(
        /\.brandProfile\.|\.dataExtraction[A-Z]|\.intelligenceCurrentComponent\.(?:update|create|delete)/u,
      );
    }
  });
  it("owns three independent roots and keeps the amendment authoritative without adding a DE capability", () => {
    const registry = contracts();
    const bundle = registry.getVerifiedBundle(registryKey);
    expect(bundle.manifest.architectureCommitSha).toBe(
      PROCESSOR_ARCHITECTURE_COMMITS.brand_meaning,
    );
    expect(bundle.manifest.ownedPathPatterns).toEqual(
      ["brand_description", "positioning", "value_proposition"].map(
        (objectSemanticId) => ({ objectSemanticId, componentPathPattern: "$" }),
      ),
    );
    const evidence = bundle.artifacts.evidenceContract.capabilities as Record<
      string,
      Record<string, unknown>
    >;
    expect(evidence.brand_user_input_and_confirmations).toMatchObject({
      required_for_processor: false,
      optional_for_mvp: true,
    });
    expect(evidence.brand_user_input_and_confirmations.rules).toContain(
      "absence_does_not_block_processor_execution",
    );
    const profile = new ProcessorDependencyProfileRegistry().resolve(bundle);
    expect(profile.capabilityIds).toEqual([
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
    ]);
    expect(profile.requiredCanonicalSemantics).toEqual([
      "brand_name",
      "website_url",
      "industry",
      "sub_industry",
    ]);
    expect(profile.nonNullableCanonicalAnchors).toEqual([
      "brand_name",
      "website_url",
      "industry",
    ]);
    expect(
      registry.registrations().map((r) => [r.processorId, r.executionEnabled]),
    ).toEqual([
      ["brand_communication", true],
      ["brand_meaning", true],
      ["brand_character", true],
      ["audience_persona_synthesis", true],
    ]);
  });
  it("retains explicit prompt restrictions and only wires existing runtime services", () => {
    for (const text of [
      "SINGLE_OFFERING",
      "No filler",
      "competitor ranking",
      "market share",
      "efficacy",
      "Campaign",
      "canonical business-state mutations",
      "Optional user-input",
    ])
      expect(BRAND_MEANING_SYSTEM_INSTRUCTION).toContain(text);
    const module = readFileSync(
      join(__dirname, "brand-intelligence.module.ts"),
      "utf8",
    );
    expect(module).toContain("useClass: ProcessorPersistenceRouter");
    expect(module).toContain("useClass: StructuredBrandMeaningModelProvider");
    expect(module).toContain(
      "useExisting: DataExtractionIntelligenceEvidenceAdapter",
    );
    expect(module).toContain("useClass: M1CanonicalBrandStateAdapter");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contracts,
  registryKey,
} from "./processors/brand-character/brand-character.test-fixtures";
import { ProcessorDependencyProfileRegistry } from "./input/dependency/processor-dependency-profile.registry";
import { BRAND_CHARACTER_SYSTEM_INSTRUCTION } from "./processors/brand-character/brand-character-prompt";
import { PROCESSOR_ARCHITECTURE_COMMITS } from "./contracts/bundle/contract-source.spec";
import { ComponentPathCodec } from "./semantic-path/component-path.codec";
import { BundlePathOwnershipRegistry } from "./contracts/registry/bundle-path-ownership.registry";
import { PersistenceTransitionValidator } from "./contracts/validation/persistence-transition.validator";

describe("brand_character architecture", () => {
  it("has only owned Character state and no other-processor, DE-write, Preview, legacy or transport dependency", () => {
    const root = join(__dirname, "processors/brand-character");
    for (const file of readdirSync(root).filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        !name.endsWith(".test-fixtures.ts"),
    )) {
      const source = readFileSync(join(root, file), "utf8");
      const imports =
        source.match(/^import[\s\S]*?from ["'][^"']+["'];/gm)?.join("\n") ?? "";
      expect(imports, file).not.toMatch(
        /brand-communication|brand-meaning|evidence\/(acquisition|normalization)|brand-preview|stage1b|legacy|frontend|controller|resolver|visual.style/iu,
      );
      expect(source, file).not.toMatch(
        /\.brandProfile\.|\.dataExtraction[A-Z]|\.intelligenceCurrentComponent\.(create|update|delete)/u,
      );
    }
  });
  it("preserves Character's pin and optional Evidence alongside all accepted executors", () => {
    const runtime = contracts();
    const bundle = runtime.getVerifiedBundle(registryKey);
    expect(
      runtime
        .registrations()
        .map((r) => [
          r.processorId,
          r.bundled,
          r.registered,
          r.executionEnabled,
        ]),
    ).toEqual([
      ["brand_communication", true, true, true],
      ["brand_meaning", true, true, true],
      ["brand_character", true, true, true],
      ["audience_persona_synthesis", true, true, true],
      ["brand_differentiation", true, true, true],
      ["visual_style_synthesis", true, true, true],
      ["serviceability_synthesis", true, true, true],
    ]);
    expect(PROCESSOR_ARCHITECTURE_COMMITS).toEqual({
      brand_communication: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
      brand_meaning: "2e13fa40235094d127f72b38f43c510232e38be4",
      brand_character: "56b52c1106feff2a92f23a7c49674fd116bf8c63",
      audience_persona_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      brand_differentiation: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      visual_style_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
      serviceability_synthesis: "a6bed1f28564c002f7d76931de0b4dd960ea5ae1",
    });
    expect(bundle.manifest.architectureCommitSha).toBe(
      PROCESSOR_ARCHITECTURE_COMMITS.brand_character,
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
    expect(profile.requiredCanonicalSemantics).toEqual([
      "brand_name",
      "industry",
      "sub_industry",
    ]);
    expect(profile.capabilityIds).toEqual([
      "owned_website.brand_company_context",
      "owned_website.brand_messaging",
    ]);
    const optional = [
      "brand_user_input_and_confirmations",
      "instagram.owned_brand_context",
    ];
    expect(bundle.artifacts.processorDefinition.evidence_requirements).toEqual(
      profile.capabilityIds,
    );
    expect(bundle.artifacts.processorDefinition.optional_enrichment).toEqual(
      optional,
    );
    expect(bundle.artifacts.reasoningContract.inputs).toMatchObject({
      evidence_capabilities: { required: [...profile.capabilityIds], optional },
    });
    for (const capability of profile.capabilityIds)
      expect(evidence[capability].required_for_processor).toBe(true);
    expect(bundle.artifacts.evidenceContract.optional_enrichment).toMatchObject(
      {
        "instagram.owned_brand_context": { required_for_processor: false },
      },
    );
  });
  it("uses frozen item metadata authority and exact root/item ownership in persistence validation", () => {
    const runtime = contracts();
    const ownership = new BundlePathOwnershipRegistry(
      runtime,
      new ComponentPathCodec(),
    );
    const validator = new PersistenceTransitionValidator(runtime, ownership);
    const address = {
      brandId: "brand",
      objectSemanticId: "brand_values",
      componentSemanticPath: "$/i/principle_transparency",
      pathSchemeVersion: 1,
    };
    const request = {
      registryKey,
      activeScope: [address],
      currentState: [],
      proposals: [
        {
          ...address,
          disposition: "APPLY_CURRENT" as const,
          authority: "CREATOR_SHOP_DERIVED",
          expectedCurrent: { state: "ABSENT" as const },
          evidenceRefs: ["evidence"],
          businessStateRefs: [],
        },
      ],
    };
    expect(validator.validate(request).valid).toBe(true);
    expect(
      validator.validate({
        ...request,
        proposals: [{ ...request.proposals[0], authority: "BRAND_CONFIRMED" }],
      }).valid,
    ).toBe(false);
    expect(
      ownership.ownsForBundle(registryKey, {
        ...address,
        objectSemanticId: "positioning",
      }),
    ).toBe(false);
    expect(
      ownership.ownsForBundle(registryKey, {
        ...address,
        componentSemanticPath: "$/i/0",
      }),
    ).toBe(false);
  });
  it("retains explicit prompt restrictions and reuses schema and persistence frameworks", () => {
    for (const text of [
      "No generic filler",
      "visual-style-to-personality",
      "founder-to-brand",
      "Campaign character guidance",
      "positioning/proposition",
      "Optional user-input",
      "comparison-only",
      "same semantic_id",
      "Materially equivalent meanings share one ID",
      "comparison-only, NOT Evidence",
    ])
      expect(BRAND_CHARACTER_SYSTEM_INSTRUCTION).toContain(text);
    const module = readFileSync(
      join(__dirname, "brand-intelligence.module.ts"),
      "utf8",
    );
    expect(module).toContain("useClass: ProcessorPersistenceRouter");
    expect(module).toContain("useClass: StructuredBrandCharacterModelProvider");
  });
  it("keeps semantic identity independent of lexical scoring", () => {
    const source = readFileSync(
      join(__dirname, "processors/brand-character/brand-character-identity.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /equivalentLabel|characterLabel|intersection|Math\.(min|max)|toLowerCase|localeCompare\(.*label|0\.8/u,
    );
    expect(source).toContain("new Set(ids)");
    expect(source).toContain("itemPath(item.semantic_id)");
  });
});

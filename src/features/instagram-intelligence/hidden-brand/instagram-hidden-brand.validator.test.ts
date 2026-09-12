import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "../../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";

const validator = new SemanticValidator();
const registry = new ContractRuntimeRegistry(
  new ContractBundleIntegrityVerifier(),
  validator,
);
registry.initializeAtRoot(
  resolve(
    process.cwd(),
    "src/features/brand-intelligence/generated/contract-bundles",
  ),
);

function evidence(capabilityId: string, count = 3) {
  return Array.from({ length: count }, (_, index) => ({
    evidenceRef: `evidence:${capabilityId}:${index}`,
    capabilityId,
    semanticId: `evidence:${capabilityId}:${index}`,
    revisionIdentity: `capture-${index}`,
    sourceClass: "INSTAGRAM_OWNED",
    freshness: "CURRENT",
    representativeness: "CONTEXT_SPECIFIC",
    normalizedPayload: {
      semanticPayload: {
        caption: `Representative caption ${index}`,
        inspection: { depth: "IMAGE_ONLY" },
      },
    },
  }));
}

const meta = (refs: readonly string[], semanticId: string | null = null) => ({
  semantic_id: semanticId,
  authority: "CREATOR_SHOP_DERIVED",
  source_class: "INSTAGRAM_OWNED",
  freshness: "CURRENT",
  evidence_refs: refs,
});

describe("Instagram source-profile validator adaptations", () => {
  it("admits repeated exact Instagram captions for communication and rejects insufficient support", () => {
    const manifest = evidence("instagram.caption_context");
    const refs = manifest.map((entry) => entry.evidenceRef);
    const output = {
      communication_profile: {
        tone_traits: null,
        free_text_guidance: "Use concise, direct captions.",
        communication_constraints: null,
        primary_language: null,
      },
      output_metadata: {
        tone_traits: null,
        free_text_guidance: meta(refs),
        communication_constraints: null,
        primary_language: null,
      },
    };
    const bundle = registry.getVerifiedBundle({
      processorId: "brand_communication",
      processorVersion: "1.0",
      outputContractId: "brand_communication_output_contract",
      outputContractVersion: "1.0",
    });
    expect(
      validator.validate(output, {
        bundle,
        evidenceManifest: manifest,
        businessStateManifest: [],
      }).valid,
    ).toBe(true);
    const insufficient = validator.validate(
      {
        ...output,
        output_metadata: {
          ...output.output_metadata,
          free_text_guidance: meta(refs.slice(0, 1)),
        },
      },
      { bundle, evidenceManifest: manifest, businessStateManifest: [] },
    );
    expect(insufficient.valid).toBe(false);
    expect(insufficient.issues.map((issue) => issue.code)).toContain(
      "INSTAGRAM_REPRESENTATIVE_SUPPORT_REQUIRED",
    );
  });

  it("admits repeated exact captions for existing Brand Character semantics", () => {
    const manifest = evidence("instagram.caption_context");
    const refs = manifest.map((entry) => entry.evidenceRef);
    const bundle = registry.getVerifiedBundle({
      processorId: "brand_character",
      processorVersion: "1.0",
      outputContractId: "brand_character_output_contract",
      outputContractVersion: "1.0",
    });
    const result = validator.validate(
      {
        brand_values: [{ semantic_id: "care", value: "Care" }],
        brand_personality: null,
        output_metadata: {
          brand_values: [meta(refs, "care")],
          brand_personality: null,
        },
      },
      { bundle, evidenceManifest: manifest, businessStateManifest: [] },
    );
    expect(result.valid).toBe(true);
  });

  it("admits repeated inspected Instagram Evidence for descriptive Visual Style only", () => {
    const manifest = evidence("instagram.media_visual_observations");
    const refs = manifest.map((entry) => entry.evidenceRef);
    const bundle = registry.getVerifiedBundle({
      processorId: "visual_style_synthesis",
      processorVersion: "1.0",
      outputContractId: "visual_style_synthesis_output_contract",
      outputContractVersion: "1.0",
    });
    const result = validator.validate(
      {
        visual_style_profile: {
          summary: "Repeated photographic treatment uses centered subjects.",
          style_traits: null,
          imagery_style: null,
          graphic_treatment: null,
          visual_constraints: null,
        },
        output_metadata: {
          summary: meta(refs),
          style_traits: null,
          imagery_style: null,
          graphic_treatment: null,
          visual_constraints: null,
        },
      },
      { bundle, evidenceManifest: manifest, businessStateManifest: [] },
    );
    expect(result.valid).toBe(true);
  });
});

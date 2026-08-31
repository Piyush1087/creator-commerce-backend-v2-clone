import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";

const businessRef = "business:offering-a:revision-1";
const factualRef = "business:offering-a:factual-current-1";
const proofRef = "evidence:offering-a:proof-1";

function runtime() {
  const registry = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  registry.verifyAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return registry;
}

const businesses = [
  {
    businessStateRef: businessRef,
    semanticId: "offering-a",
    revisionIdentity: "revision-1",
  },
  {
    businessStateRef: factualRef,
    semanticId: "offering_factual_profile",
    revisionIdentity: "factual-1",
  },
];

function meta(
  semanticId: string,
  evidenceRefs: string[] = [],
  businessStateRefs = [businessRef],
) {
  return {
    semantic_id: semanticId,
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "SYSTEM_DERIVATION_INPUT",
    freshness: "CURRENT",
    evidence_refs: evidenceRefs,
    business_state_refs: businessStateRefs,
  };
}

describe("remaining frozen Product processor contracts", () => {
  it("accepts grounded reusable creator ingredients with factual lineage", () => {
    const bundle = runtime().getVerifiedBundle({
      processorId: "offering_creator_communication",
      processorVersion: "1.0",
      outputContractId: "offering_creator_communication_output_contract",
      outputContractVersion: "1.0",
    });
    const output = {
      offering_creator_communication_profile: {
        creator_talking_points: [
          {
            semantic_id: "reusable-steel-material",
            talking_point: "Made from stainless steel for everyday reuse.",
          },
        ],
        communication_constraints: [
          {
            semantic_id: "avoid-medical-efficacy",
            constraint:
              "Do not describe the bottle as providing medical benefits.",
          },
        ],
      },
      output_metadata: {
        creator_talking_points: [
          meta("reusable-steel-material", [], [businessRef, factualRef]),
        ],
        communication_constraints: [meta("avoid-medical-efficacy")],
      },
    };
    expect(
      new StructuralValidator().validate(
        bundle,
        verifiedOutputZodSchema(bundle).parse(output),
      ).valid,
    ).toBe(true);
    expect(
      new SemanticValidator().validate(output, {
        bundle,
        evidenceManifest: [],
        businessStateManifest: businesses,
      }).valid,
    ).toBe(true);
  });

  it("rejects positional IDs, final copy, and unsupported claim-sensitive talking points", () => {
    const bundle = runtime().getVerifiedBundle({
      processorId: "offering_creator_communication",
      processorVersion: "1.0",
      outputContractId: "offering_creator_communication_output_contract",
      outputContractVersion: "1.0",
    });
    const output = {
      offering_creator_communication_profile: {
        creator_talking_points: [
          {
            semantic_id: "0",
            talking_point: "Caption: Buy now—the #1 clinically proven bottle.",
          },
        ],
        communication_constraints: null,
      },
      output_metadata: {
        creator_talking_points: [meta("0")],
        communication_constraints: null,
      },
    };
    const validation = new SemanticValidator().validate(output, {
      bundle,
      evidenceManifest: [
        {
          evidenceRef: proofRef,
          capabilityId: "explicit_factual_proof_or_claim_evidence",
          semanticId: proofRef,
          revisionIdentity: "capture-1",
          normalizedPayload: { proof_strength: "OBSERVED_CLAIM" },
        },
      ],
      businessStateManifest: businesses,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid)
      expect(validation.issues.map((item) => item.code)).toEqual(
        expect.arrayContaining([
          "INVALID_SEMANTIC_ITEM_ID",
          "FINAL_CAMPAIGN_COPY_FORBIDDEN",
          "INSUFFICIENT_CLAIM_SUPPORT",
        ]),
      );
  });

  it("accepts bounded no-price actionability and null commercial context", () => {
    const bundle = runtime().getVerifiedBundle({
      processorId: "offering_actionability_synthesis",
      processorVersion: "1.0",
      outputContractId: "offering_actionability_synthesis_output_contract",
      outputContractVersion: "1.0",
    });
    const output = {
      offering_actionability_profile: {
        customer_action: [
          {
            semantic_id: "visit-canonical-destination",
            action:
              "Visit the Offering's exact customer destination to learn more.",
          },
        ],
        commercial_context: null,
      },
      output_metadata: {
        customer_action: [meta("visit-canonical-destination")],
        commercial_context: null,
      },
    };
    expect(
      new StructuralValidator().validate(
        bundle,
        verifiedOutputZodSchema(bundle).parse(output),
      ).valid,
    ).toBe(true);
    expect(
      new SemanticValidator().validate(output, {
        bundle,
        evidenceManifest: [],
        businessStateManifest: businesses,
      }).valid,
    ).toBe(true);
  });

  it("rejects invented broad availability and legacy-price inference", () => {
    const bundle = runtime().getVerifiedBundle({
      processorId: "offering_actionability_synthesis",
      processorVersion: "1.0",
      outputContractId: "offering_actionability_synthesis_output_contract",
      outputContractVersion: "1.0",
    });
    const output = {
      offering_actionability_profile: {
        customer_action: [
          {
            semantic_id: "invented-shipping",
            action: "Buy now; it ships everywhere and is in stock.",
          },
        ],
        commercial_context: [
          {
            semantic_id: "legacy-price",
            context: "The legacy priceAmount is the current price.",
          },
        ],
      },
      output_metadata: {
        customer_action: [meta("invented-shipping")],
        commercial_context: [meta("legacy-price")],
      },
    };
    const validation = new SemanticValidator().validate(output, {
      bundle,
      evidenceManifest: [],
      businessStateManifest: businesses,
    });
    expect(validation.valid).toBe(false);
    if (!validation.valid)
      expect(validation.issues.map((item) => item.code)).toEqual(
        expect.arrayContaining([
          "INVENTED_ACTIONABILITY",
          "LEGACY_PRICE_FORBIDDEN",
        ]),
      );
  });
});

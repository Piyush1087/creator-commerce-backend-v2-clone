import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { StructuralValidator } from "../../contracts/validation/structural.validator";
import type {
  BusinessStateManifestEntry,
  EvidenceManifestEntry,
} from "../../contracts/validation/validation.types";
import { verifiedOutputZodSchema } from "../../contracts/validation/verified-output-zod-schema";

const registryKey = {
  processorId: "offering_factual_synthesis",
  processorVersion: "1.0",
  outputContractId: "offering_factual_synthesis_output_contract",
  outputContractVersion: "1.0",
};
const contextRef = "evidence:offering-a:context";
const businessRef = "business:offering-a:revision-1";

function runtime() {
  const result = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  result.verifyAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return result;
}

function metadata(evidenceRefs: readonly string[] = [contextRef]) {
  return {
    authority: "OBSERVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT",
    evidence_refs: evidenceRefs,
    business_state_refs: [businessRef],
  };
}

function partialOutput() {
  return {
    offering_factual_profile: {
      factual_summary: "A lightweight reusable water bottle.",
      key_facts: [
        { semantic_id: "material-stainless-steel", fact: "Made from steel." },
      ],
      key_benefits: null,
      proof_points: null,
      usage_context: null,
      customer_context: null,
    },
    output_metadata: {
      factual_summary: metadata(),
      key_facts: [{ semantic_id: "material-stainless-steel", ...metadata() }],
      key_benefits: null,
      proof_points: null,
      usage_context: null,
      customer_context: null,
    },
  };
}

function evidence(
  overrides: Partial<EvidenceManifestEntry> = {},
): EvidenceManifestEntry {
  return {
    evidenceRef: contextRef,
    capabilityId: "owned_website.offering_context",
    semanticId: contextRef,
    revisionIdentity: "capture-1",
    representativeness: "OFFERING_SPECIFIC",
    generalizationScope: "SINGLE_OFFERING",
    normalizedPayload: {
      generalization_scope: "SINGLE_OFFERING",
      canonical_offering_ref: "offering-a",
    },
    ...overrides,
  };
}

const business: BusinessStateManifestEntry = {
  businessStateRef: businessRef,
  semanticId: "offering-a",
  revisionIdentity: "revision-1",
};

describe("offering_factual_synthesis frozen output and semantics", () => {
  it("accepts a useful grounded partial result from exact Offering context", () => {
    const bundle = runtime().getVerifiedBundle(registryKey);
    const output = verifiedOutputZodSchema(bundle).parse(partialOutput());
    expect(new StructuralValidator().validate(bundle, output).valid).toBe(true);
    expect(
      new SemanticValidator().validate(output, {
        bundle,
        evidenceManifest: [evidence()],
        businessStateManifest: [business],
      }).valid,
    ).toBe(true);
  });

  it("rejects extra shape, positional identity, and unsupported high-risk benefit", () => {
    const bundle = runtime().getVerifiedBundle(registryKey);
    expect(
      new StructuralValidator().validate(bundle, {
        ...partialOutput(),
        audience: [],
      }).valid,
    ).toBe(false);
    const positional = partialOutput();
    positional.offering_factual_profile.key_facts[0].semantic_id = "0";
    positional.output_metadata.key_facts[0].semantic_id = "0";
    expect(
      new SemanticValidator().validate(positional, {
        bundle,
        evidenceManifest: [evidence()],
        businessStateManifest: [business],
      }).valid,
    ).toBe(false);
    const risky = partialOutput();
    risky.offering_factual_profile.key_benefits = [
      { semantic_id: "guaranteed-result", benefit: "Guaranteed safe results." },
    ];
    risky.output_metadata.key_benefits = [
      { semantic_id: "guaranteed-result", ...metadata() },
    ];
    expect(
      new SemanticValidator().validate(risky, {
        bundle,
        evidenceManifest: [evidence()],
        businessStateManifest: [business],
      }).valid,
    ).toBe(false);
  });

  it("allows only bounded direct same-Offering factual support as a proof point", () => {
    const bundle = runtime().getVerifiedBundle(registryKey);
    const output = partialOutput();
    const proofRef = "evidence:offering-a:direct-fact";
    output.offering_factual_profile.proof_points = [
      {
        semantic_id: "founded-2018",
        statement: "The workshop was founded in 2018.",
      },
    ];
    output.output_metadata.proof_points = [
      { semantic_id: "founded-2018", ...metadata([proofRef]) },
    ];
    const validate = (normalizedPayload: unknown) =>
      new SemanticValidator().validate(output, {
        bundle,
        evidenceManifest: [
          evidence(),
          evidence({
            evidenceRef: proofRef,
            semanticId: proofRef,
            capabilityId: "explicit_factual_proof_or_claim_evidence",
            normalizedPayload,
          }),
        ],
        businessStateManifest: [business],
      });
    expect(
      validate({
        proof_strength: "TESTIMONIAL_OR_SOCIAL_PROOF",
        proof_class: "OTHER_BOUNDED_PROOF_CONTEXT",
        verification_status: "NOT_EXTERNALLY_VERIFIED",
        claim_sensitivity: ["TESTIMONIAL"],
      }).valid,
    ).toBe(false);
    expect(
      validate({
        proof_strength: "DIRECT_FIRST_PARTY_FACT",
        proof_class: "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
        verification_status: "NOT_EXTERNALLY_VERIFIED",
        claim_sensitivity: [],
      }).valid,
    ).toBe(true);
  });
});

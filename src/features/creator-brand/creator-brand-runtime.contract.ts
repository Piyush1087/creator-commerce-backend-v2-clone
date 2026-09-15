import type { VerifiedContractBundle } from "../brand-intelligence/contracts/bundle/contract-bundle.types";
import type { GeneratedContractRegistration } from "../brand-intelligence/contracts/bundle/contract-bundle.integrity";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import { CREATOR_BRAND_ARCHETYPE_SOURCE } from "./contracts/creator-brand-archetype.adapter";
import {
  CREATOR_BRAND_BOUNDS,
  CREATOR_BRAND_NICHE_IDS,
  CREATOR_BRAND_VOICE_IDS,
} from "./contracts/creator-brand-taxonomies";
import {
  CREATOR_BRAND_MUTATION_BOUNDARY,
  CREATOR_BRAND_ROLE_POLICY,
} from "./contracts/creator-brand-profile.contract";
import {
  CREATOR_BRAND_SUGGESTION_FAMILIES,
  CREATOR_BRAND_SUFFICIENCY_PROFILE,
  CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY,
} from "./contracts/creator-brand-suggestions.contract";

export const CREATOR_BRAND_REGISTRY_KEY = Object.freeze({
  processorId: "creator_brand_suggestions_v0",
  processorVersion: "1.0",
  outputContractId: "creator_brand_suggestions_v0_output",
  outputContractVersion: "1.0",
});
export const CREATOR_BRAND_COMPONENT_PATHS =
  CREATOR_BRAND_SUGGESTION_FAMILIES.map((name) => `$/f/${name}`);
/** Existing compiled Creator bundle convention; P0 registers but NEVER executes. */
export function creatorBrandVerifiedContract(): {
  registration: GeneratedContractRegistration;
  bundle: VerifiedContractBundle;
} {
  const ownedPathPatterns = CREATOR_BRAND_COMPONENT_PATHS.map(
    (componentPathPattern) => ({
      objectSemanticId: "creator_brand_suggestions",
      componentPathPattern,
    }),
  );
  const artifacts = {
    processorDefinition: {
      id: CREATOR_BRAND_REGISTRY_KEY.processorId,
      version: "1.0",
      status: "FROZEN",
      owner_engine: "creator_intelligence",
      owning_branch: "creator_brand",
      implementation: "PROHIBITED_IN_P0",
      execution_enabled: false,
    },
    reasoningContract: {
      id: "creator_brand_suggestions_reasoning",
      version: "1.0",
      status: "FROZEN",
      support_profile: CREATOR_BRAND_SUFFICIENCY_PROFILE,
      reacquire_content: false,
      calculate_content: false,
      auto_apply: false,
      canonical_mutation: false,
      model_calls_in_p0: false,
    },
    outputContract: {
      id: CREATOR_BRAND_REGISTRY_KEY.outputContractId,
      version: "1.0",
      status: "FROZEN",
      response: { type: "object" },
      families: CREATOR_BRAND_SUGGESTION_FAMILIES,
      source_components_by_family: CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY,
      exact_hex_requires_deterministic_support: true,
      commercial_bio_suggestion: false,
      confidence: ["LOW", "MEDIUM"],
      availability: [
        "AVAILABLE",
        "UNKNOWN",
        "UNAVAILABLE",
        "INSUFFICIENT_EVIDENCE",
        "INTENTIONALLY_ABSENT",
      ],
      bounds: CREATOR_BRAND_BOUNDS,
      niche_ids: CREATOR_BRAND_NICHE_IDS,
      voice_ids: CREATOR_BRAND_VOICE_IDS,
      archetypes: CREATOR_BRAND_ARCHETYPE_SOURCE,
      strict_runtime_schema: "CreatorBrandSuggestionsSchema@1.0",
      role_policy: CREATOR_BRAND_ROLE_POLICY,
      confirmed_truth_boundary: CREATOR_BRAND_MUTATION_BOUNDARY,
    },
    evidenceContract: {
      id: "creator_brand_suggestions_evidence",
      version: "1.0",
      status: "FROZEN",
      capabilities: { "instagram.media_insights": {} },
      input_object: "creator_content",
      exact_component_generation_support: true,
      exact_field_evidence_subset: true,
      exact_creator_subject: true,
    },
    objectContract: {
      contract: "creator_brand_suggestions_object",
      version: "1.0",
      status: "FROZEN",
      owner_scope: "CREATOR",
      authority: "CREATOR_SHOP_DERIVED",
      protection: "UNPROTECTED",
      objects: [{ id: "creator_brand_suggestions" }],
      ownedPathPatterns,
    },
    sharedMetadataContract: {
      contract: "shared_intelligence_metadata",
      version: "1.0",
      status: "FROZEN",
    },
  };
  const identity = {
    manifestSchemaVersion: 1 as const,
    bundleId: "creator_intelligence.creator_brand_suggestions_v0",
    bundleVersion: "1.0",
    ownerEngine: "creator_intelligence",
    owningBranch: "creator_brand",
    architectureRepository: "Piyush1087/dummy_tcs",
    architectureCommitSha: "7e54d3980ca3454263600e44766041dbb58e0a06",
    ...CREATOR_BRAND_REGISTRY_KEY,
    evidenceContractId: "creator_brand_suggestions_evidence",
    evidenceContractVersion: "1.0",
    ownedObjectSemanticIds: ["creator_brand_suggestions"],
    ownedPathPatterns,
    generatedNotice: "GENERATED — DO NOT EDIT" as const,
    generatorVersion: "1.0.0" as const,
  };
  const bundleContentHash = sha256Canonical({ identity, artifacts });
  return {
    registration: {
      ...CREATOR_BRAND_REGISTRY_KEY,
      bundleId: identity.bundleId,
      bundleVersion: "1.0",
      bundleContentHash,
      ownedObjectSemanticIds: identity.ownedObjectSemanticIds,
      ownedPathPatterns,
      structuralValidatorId: "contract_output_schema_v1",
      semanticValidatorId: CREATOR_BRAND_REGISTRY_KEY.processorId,
      persistenceValidatorId: "intelligence_persistence_transition_v1",
      bundled: true,
      registered: true,
      executionEnabled: false,
    },
    bundle: {
      manifest: { ...identity, artifacts: [], bundleContentHash },
      artifacts,
    },
  };
}

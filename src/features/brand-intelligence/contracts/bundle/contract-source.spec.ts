import type { ContractSourceSpec } from "./contract-bundle.types";

const ROOT =
  "intelligence/engines/brand_intelligence/branches/brand_expression";

export const ARCHITECTURE_REPOSITORY = "Piyush1087/dummy_tcs";
export const PINNED_ARCHITECTURE_COMMIT =
  "a6bed1f28564c002f7d76931de0b4dd960ea5ae1";

// Independent immutable bundles: the amendment does not repin communication.
export const PROCESSOR_ARCHITECTURE_COMMITS: Readonly<Record<string, string>> =
  {
    brand_communication: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
    brand_meaning: "2e13fa40235094d127f72b38f43c510232e38be4",
    brand_character: "56b52c1106feff2a92f23a7c49674fd116bf8c63",
    audience_persona_synthesis: PINNED_ARCHITECTURE_COMMIT,
    brand_differentiation: PINNED_ARCHITECTURE_COMMIT,
    visual_style_synthesis: PINNED_ARCHITECTURE_COMMIT,
  };

export const EXECUTABLE_CONTRACT_PROCESSORS: ReadonlySet<string> = new Set([
  "brand_communication",
  "brand_meaning",
  "brand_character",
  "audience_persona_synthesis",
  "brand_differentiation",
  "visual_style_synthesis",
]);

export const CONTRACT_SOURCE_SPECS: readonly ContractSourceSpec[] = [
  {
    processorId: "brand_communication",
    processorVersion: "1.0",
    outputContractId: "brand_communication_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_communication_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "brand_expression",
    ownedObjectSemanticIds: ["communication_profile"],
    ownedPathPatterns: [
      { objectSemanticId: "communication_profile", componentPathPattern: "$" },
      {
        objectSemanticId: "communication_profile",
        componentPathPattern: "$/f/tone_traits/i/{semantic_id}",
      },
      {
        objectSemanticId: "communication_profile",
        componentPathPattern: "$/f/free_text_guidance",
      },
      {
        objectSemanticId: "communication_profile",
        componentPathPattern: "$/f/communication_constraints/i/{semantic_id}",
      },
      {
        objectSemanticId: "communication_profile",
        componentPathPattern: "$/f/primary_language",
      },
    ],
    artifactPaths: {
      PROCESSOR_DEFINITION: `${ROOT}/processors/brand_communication.yaml`,
      REASONING_CONTRACT: `${ROOT}/artifacts/brand_communication/reasoning.yaml`,
      OUTPUT_CONTRACT: `${ROOT}/artifacts/brand_communication/output_contract.yaml`,
      EVIDENCE_CONTRACT: `${ROOT}/evidence/brand_communication_evidence.yaml`,
      OBJECT_CONTRACT: `${ROOT}/objects.yaml`,
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
  {
    processorId: "brand_meaning",
    processorVersion: "1.0",
    outputContractId: "brand_meaning_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_meaning_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "brand_expression",
    ownedObjectSemanticIds: [
      "brand_description",
      "positioning",
      "value_proposition",
    ],
    ownedPathPatterns: [
      { objectSemanticId: "brand_description", componentPathPattern: "$" },
      { objectSemanticId: "positioning", componentPathPattern: "$" },
      { objectSemanticId: "value_proposition", componentPathPattern: "$" },
    ],
    artifactPaths: {
      PROCESSOR_DEFINITION: `${ROOT}/processors/brand_meaning.yaml`,
      REASONING_CONTRACT: `${ROOT}/artifacts/brand_meaning/reasoning.yaml`,
      OUTPUT_CONTRACT: `${ROOT}/artifacts/brand_meaning/output_contract.yaml`,
      EVIDENCE_CONTRACT: `${ROOT}/evidence/brand_meaning_evidence.yaml`,
      OBJECT_CONTRACT: `${ROOT}/objects.yaml`,
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
  {
    processorId: "brand_character",
    processorVersion: "1.0",
    outputContractId: "brand_character_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_character_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "brand_expression",
    ownedObjectSemanticIds: ["brand_values", "brand_personality"],
    ownedPathPatterns: [
      { objectSemanticId: "brand_values", componentPathPattern: "$" },
      {
        objectSemanticId: "brand_values",
        componentPathPattern: "$/i/{semantic_id}",
      },
      { objectSemanticId: "brand_personality", componentPathPattern: "$" },
      {
        objectSemanticId: "brand_personality",
        componentPathPattern: "$/i/{semantic_id}",
      },
    ],
    artifactPaths: {
      PROCESSOR_DEFINITION: `${ROOT}/processors/brand_character.yaml`,
      REASONING_CONTRACT: `${ROOT}/artifacts/brand_character/reasoning.yaml`,
      OUTPUT_CONTRACT: `${ROOT}/artifacts/brand_character/output_contract.yaml`,
      EVIDENCE_CONTRACT: `${ROOT}/evidence/brand_character_evidence.yaml`,
      OBJECT_CONTRACT: `${ROOT}/objects.yaml`,
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
  {
    processorId: "audience_persona_synthesis",
    processorVersion: "1.0",
    outputContractId: "audience_persona_synthesis_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "audience_persona_synthesis_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "audience",
    ownedObjectSemanticIds: ["audience_personas"],
    ownedPathPatterns: [
      "$",
      "$/i/{semantic_id}",
      ...[
        "label",
        "summary",
        "lifecycle",
        "geography_context",
        "demographic_context",
      ].map((field) => `$/i/{semantic_id}/f/${field}`),
      ...[
        "key_characteristics",
        "motivations",
        "barriers_or_concerns",
        "trust_credibility_needs",
        "creator_communication_implications",
      ].flatMap((field) => [
        `$/i/{semantic_id}/f/${field}`,
        `$/i/{semantic_id}/f/${field}/i/{semantic_id}`,
        `$/i/{semantic_id}/f/${field}/i/{semantic_id}/f/value`,
      ]),
    ].map((componentPathPattern) => ({
      objectSemanticId: "audience_personas",
      componentPathPattern,
    })),
    artifactPaths: {
      PROCESSOR_DEFINITION:
        "intelligence/engines/brand_intelligence/branches/audience/processors/audience_persona_synthesis.yaml",
      REASONING_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/audience/artifacts/audience_persona_synthesis/reasoning.yaml",
      OUTPUT_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/audience/artifacts/audience_persona_synthesis/output_contract.yaml",
      EVIDENCE_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/audience/evidence/audience_persona_synthesis_evidence.yaml",
      OBJECT_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/audience/objects.yaml",
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
  {
    processorId: "brand_differentiation",
    processorVersion: "1.0",
    outputContractId: "brand_differentiation_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_differentiation_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "brand_expression",
    ownedObjectSemanticIds: ["differentiation_and_proof"],
    ownedPathPatterns: [
      "$",
      "$/i/{semantic_id}",
      "$/i/{semantic_id}/f/differentiator",
      "$/i/{semantic_id}/f/proof_points",
      "$/i/{semantic_id}/f/proof_points/i/{semantic_id}",
      "$/i/{semantic_id}/f/proof_points/i/{semantic_id}/f/statement",
    ].map((componentPathPattern) => ({
      objectSemanticId: "differentiation_and_proof",
      componentPathPattern,
    })),
    artifactPaths: {
      PROCESSOR_DEFINITION: `${ROOT}/processors/brand_differentiation.yaml`,
      REASONING_CONTRACT: `${ROOT}/artifacts/brand_differentiation/reasoning.yaml`,
      OUTPUT_CONTRACT: `${ROOT}/artifacts/brand_differentiation/output_contract.yaml`,
      EVIDENCE_CONTRACT: `${ROOT}/evidence/brand_differentiation_evidence.yaml`,
      OBJECT_CONTRACT: `${ROOT}/objects.yaml`,
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
  {
    processorId: "visual_style_synthesis",
    processorVersion: "1.0",
    outputContractId: "visual_style_synthesis_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "visual_style_synthesis_evidence",
    evidenceContractVersion: "1.0",
    ownerEngine: "brand_intelligence",
    owningBranch: "visual_identity",
    ownedObjectSemanticIds: ["visual_style_profile"],
    ownedPathPatterns: [
      "$",
      "$/f/summary",
      "$/f/style_traits",
      "$/f/style_traits/i/{semantic_id}",
      "$/f/style_traits/i/{semantic_id}/f/trait",
      "$/f/imagery_style",
      ...[
        "photographic_tendencies",
        "subject_tendencies",
        "mood_or_treatment",
      ].flatMap((field) => [
        `$/f/imagery_style/f/${field}`,
        `$/f/imagery_style/f/${field}/i/{semantic_id}`,
        `$/f/imagery_style/f/${field}/i/{semantic_id}/f/value`,
      ]),
      "$/f/graphic_treatment",
      "$/f/graphic_treatment/f/traits",
      "$/f/graphic_treatment/f/traits/i/{semantic_id}",
      "$/f/graphic_treatment/f/traits/i/{semantic_id}/f/value",
      "$/f/visual_constraints",
      "$/f/visual_constraints/i/{semantic_id}",
      "$/f/visual_constraints/i/{semantic_id}/f/rule",
    ].map((componentPathPattern) => ({
      objectSemanticId: "visual_style_profile",
      componentPathPattern,
    })),
    artifactPaths: {
      PROCESSOR_DEFINITION:
        "intelligence/engines/brand_intelligence/branches/visual_identity/processors/visual_style_synthesis.yaml",
      REASONING_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/visual_identity/artifacts/visual_style_synthesis/reasoning.yaml",
      OUTPUT_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/visual_identity/artifacts/visual_style_synthesis/output_contract.yaml",
      EVIDENCE_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/visual_identity/evidence/visual_style_synthesis_evidence.yaml",
      OBJECT_CONTRACT:
        "intelligence/engines/brand_intelligence/branches/visual_identity/objects.yaml",
      SHARED_METADATA_CONTRACT:
        "intelligence/architecture/shared_intelligence_metadata_contract.yaml",
    },
  },
];

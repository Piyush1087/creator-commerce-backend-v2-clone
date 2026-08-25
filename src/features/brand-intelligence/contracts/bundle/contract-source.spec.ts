import type { ContractSourceSpec } from "./contract-bundle.types";

const ROOT =
  "intelligence/engines/brand_intelligence/branches/brand_expression";

export const ARCHITECTURE_REPOSITORY = "Piyush1087/dummy_tcs";
export const PINNED_ARCHITECTURE_COMMIT =
  "2e13fa40235094d127f72b38f43c510232e38be4";

// Independent immutable bundles: the amendment does not repin communication.
export const PROCESSOR_ARCHITECTURE_COMMITS: Readonly<Record<string, string>> =
  {
    brand_communication: "017dbceac494f0861ec9a6bea7af3129b70fa5cb",
    brand_meaning: PINNED_ARCHITECTURE_COMMIT,
  };

export const EXECUTABLE_CONTRACT_PROCESSORS: ReadonlySet<string> = new Set([
  "brand_communication",
  "brand_meaning",
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
];

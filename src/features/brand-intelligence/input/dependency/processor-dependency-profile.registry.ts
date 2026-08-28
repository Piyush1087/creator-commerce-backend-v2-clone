import { Injectable } from "@nestjs/common";

import type { VerifiedContractBundle } from "../../contracts/bundle/contract-bundle.types";
import { PROCESSOR_ARCHITECTURE_COMMITS } from "../../contracts/bundle/contract-source.spec";
import type { CanonicalBrandStateSemantic } from "../canonical-state/canonical-brand-state.port";
import { InputDependencyError } from "../domain/input-dependency.error";
import type { NormalizedEvidenceCapabilityId } from "../evidence/intelligence-evidence.port";

export interface ProcessorDependencyProfile {
  readonly processorId:
    | "brand_communication"
    | "visual_style_synthesis"
    | "brand_differentiation"
    | "brand_meaning"
    | "audience_persona_synthesis"
    | "brand_character"
    | "serviceability_synthesis";
  readonly processorVersion: "1.0";
  readonly outputContractId:
    | "brand_communication_output_contract"
    | "visual_style_synthesis_output_contract"
    | "brand_differentiation_output_contract"
    | "brand_character_output_contract"
    | "audience_persona_synthesis_output_contract"
    | "brand_meaning_output_contract"
    | "serviceability_synthesis_output_contract";
  readonly outputContractVersion: "1.0";
  readonly evidenceContractId:
    | "brand_communication_evidence"
    | "visual_style_synthesis_evidence"
    | "brand_differentiation_evidence"
    | "brand_character_evidence"
    | "audience_persona_synthesis_evidence"
    | "brand_meaning_evidence"
    | "serviceability_evidence";
  readonly requiredCanonicalSemantics: readonly CanonicalBrandStateSemantic[];
  readonly nonNullableCanonicalAnchors: readonly CanonicalBrandStateSemantic[];
  readonly blockingConflictSemantics: readonly CanonicalBrandStateSemantic[];
  readonly capabilityIds: readonly NormalizedEvidenceCapabilityId[];
  readonly representativeEvidenceAnyOf: readonly NormalizedEvidenceCapabilityId[];
  /** Opt-in lineage readiness; available empty captures are not factual proof. */
  readonly requiredCapabilityLineages?: readonly NormalizedEvidenceCapabilityId[];
  readonly includeOfferingFacts?: boolean;
  readonly includeVisualState?: boolean;
  readonly includeServiceabilityState?: boolean;
}

const ARCHITECTURE_REPOSITORY = "Piyush1087/dummy_tcs";

const PROFILES: readonly ProcessorDependencyProfile[] = [
  {
    processorId: "serviceability_synthesis",
    processorVersion: "1.0",
    outputContractId: "serviceability_synthesis_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "serviceability_evidence",
    requiredCanonicalSemantics: ["brand_name", "country"],
    nonNullableCanonicalAnchors: ["brand_name"],
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.serviceability_evidence",
      "owned_website.location_evidence",
    ],
    representativeEvidenceAnyOf: [],
    requiredCapabilityLineages: [
      "owned_website.serviceability_evidence",
      "owned_website.location_evidence",
    ],
    includeServiceabilityState: true,
  },
  {
    processorId: "visual_style_synthesis",
    processorVersion: "1.0",
    outputContractId: "visual_style_synthesis_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "visual_style_synthesis_evidence",
    requiredCanonicalSemantics: ["brand_name"],
    nonNullableCanonicalAnchors: [],
    blockingConflictSemantics: [],
    capabilityIds: ["owned_website.visual_evidence"],
    representativeEvidenceAnyOf: ["owned_website.visual_evidence"],
    includeVisualState: true,
  },
  {
    processorId: "brand_differentiation",
    processorVersion: "1.0",
    outputContractId: "brand_differentiation_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_differentiation_evidence",
    requiredCanonicalSemantics: [
      "brand_name",
      "website_url",
      "industry",
      "sub_industry",
    ],
    nonNullableCanonicalAnchors: ["brand_name", "website_url", "industry"],
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.brand_company_context",
      "owned_website.brand_messaging",
      "owned_website.offering_context",
      "explicit_factual_proof_or_claim_evidence",
    ],
    requiredCapabilityLineages: [
      "owned_website.brand_company_context",
      "owned_website.brand_messaging",
      "owned_website.offering_context",
      "explicit_factual_proof_or_claim_evidence",
    ],
    representativeEvidenceAnyOf: [],
    includeOfferingFacts: true,
  },
  {
    processorId: "audience_persona_synthesis",
    processorVersion: "1.0",
    outputContractId: "audience_persona_synthesis_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "audience_persona_synthesis_evidence",
    requiredCanonicalSemantics: ["brand_name", "industry", "sub_industry"],
    nonNullableCanonicalAnchors: ["brand_name", "industry"],
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
    ],
    representativeEvidenceAnyOf: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
    ],
  },
  {
    processorId: "brand_character",
    processorVersion: "1.0",
    outputContractId: "brand_character_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_character_evidence",
    requiredCanonicalSemantics: ["brand_name", "industry", "sub_industry"],
    nonNullableCanonicalAnchors: ["brand_name", "industry"],
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.brand_company_context",
      "owned_website.brand_messaging",
    ],
    representativeEvidenceAnyOf: [
      "owned_website.brand_company_context",
      "owned_website.brand_messaging",
    ],
  },
  {
    processorId: "brand_communication",
    processorVersion: "1.0",
    outputContractId: "brand_communication_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_communication_evidence",
    requiredCanonicalSemantics: ["brand_name", "industry"],
    nonNullableCanonicalAnchors: ["brand_name", "industry"],
    // The frozen processor contract preserves conflicts but does not declare
    // either canonical input conflict to be execution-blocking.
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "observed_brand_communication_language_signals",
      "derived_communication_constraint_evidence",
    ],
    representativeEvidenceAnyOf: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "observed_brand_communication_language_signals",
    ],
  },
  {
    processorId: "brand_meaning",
    processorVersion: "1.0",
    outputContractId: "brand_meaning_output_contract",
    outputContractVersion: "1.0",
    evidenceContractId: "brand_meaning_evidence",
    requiredCanonicalSemantics: [
      "brand_name",
      "website_url",
      "industry",
      "sub_industry",
    ],
    nonNullableCanonicalAnchors: ["brand_name", "website_url", "industry"],
    blockingConflictSemantics: [],
    capabilityIds: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
    ],
    representativeEvidenceAnyOf: [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
    ],
  },
];

@Injectable()
export class ProcessorDependencyProfileRegistry {
  resolve(bundle: VerifiedContractBundle): ProcessorDependencyProfile {
    const profile = PROFILES.find(
      (candidate) =>
        candidate.processorId === bundle.manifest.processorId &&
        candidate.processorVersion === bundle.manifest.processorVersion &&
        candidate.outputContractId === bundle.manifest.outputContractId &&
        candidate.outputContractVersion ===
          bundle.manifest.outputContractVersion,
    );
    if (
      !profile ||
      bundle.manifest.evidenceContractId !== profile.evidenceContractId ||
      bundle.manifest.architectureRepository !== ARCHITECTURE_REPOSITORY ||
      bundle.manifest.architectureCommitSha !==
        PROCESSOR_ARCHITECTURE_COMMITS[profile.processorId]
    ) {
      throw new InputDependencyError(
        "CONFIGURATION_DRIFT",
        "No dependency profile matches the exact frozen verified bundle",
      );
    }
    return profile;
  }
}

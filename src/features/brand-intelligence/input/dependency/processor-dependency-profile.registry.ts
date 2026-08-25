import { Injectable } from "@nestjs/common";

import type { VerifiedContractBundle } from "../../contracts/bundle/contract-bundle.types";
import { PROCESSOR_ARCHITECTURE_COMMITS } from "../../contracts/bundle/contract-source.spec";
import type { CanonicalBrandStateSemantic } from "../canonical-state/canonical-brand-state.port";
import { InputDependencyError } from "../domain/input-dependency.error";
import type { NormalizedEvidenceCapabilityId } from "../evidence/intelligence-evidence.port";

export interface ProcessorDependencyProfile {
  readonly processorId: "brand_communication" | "brand_meaning";
  readonly processorVersion: "1.0";
  readonly outputContractId:
    | "brand_communication_output_contract"
    | "brand_meaning_output_contract";
  readonly outputContractVersion: "1.0";
  readonly evidenceContractId:
    | "brand_communication_evidence"
    | "brand_meaning_evidence";
  readonly requiredCanonicalSemantics: readonly CanonicalBrandStateSemantic[];
  readonly nonNullableCanonicalAnchors: readonly CanonicalBrandStateSemantic[];
  readonly blockingConflictSemantics: readonly CanonicalBrandStateSemantic[];
  readonly capabilityIds: readonly NormalizedEvidenceCapabilityId[];
  readonly representativeEvidenceAnyOf: readonly NormalizedEvidenceCapabilityId[];
}

const ARCHITECTURE_REPOSITORY = "Piyush1087/dummy_tcs";

const PROFILES: readonly ProcessorDependencyProfile[] = [
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

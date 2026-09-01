export type LegacyCreatorPayoutEvidence = {
  accountNumber?: string | null;
  routingOrIfsc?: string | null;
  panNumber?: string | null;
  verificationStatus?: string | null;
  providerReference?: string | null;
};

export type LegacyCreatorPayoutAssessment = {
  disposition: "COMPATIBILITY_ONLY";
  reasonCode:
    | "NO_DESTINATION_EVIDENCE"
    | "PLAINTEXT_SECRET_REQUIRES_SEPARATE_DATA_AUTHORITY"
    | "AMBIGUOUS_LEGACY_DESTINATION"
    | "PROVIDER_STATE_IS_NOT_CANONICAL_VERIFICATION";
  importsCanonicalDestination: false;
  importsPan: false;
  canonicalState: "CONFIGURED_UNVERIFIED" | null;
};

/**
 * Legacy Creator payout rows are evidence, never write authority. This pure
 * assessment deliberately emits no secret values and performs no database
 * access or automatic migration.
 */
export function assessLegacyCreatorPayoutEvidence(
  evidence: LegacyCreatorPayoutEvidence | null,
): LegacyCreatorPayoutAssessment {
  if (!evidence) {
    return {
      disposition: "COMPATIBILITY_ONLY",
      reasonCode: "NO_DESTINATION_EVIDENCE",
      importsCanonicalDestination: false,
      importsPan: false,
      canonicalState: null,
    };
  }
  if (evidence.accountNumber || evidence.routingOrIfsc || evidence.panNumber) {
    return {
      disposition: "COMPATIBILITY_ONLY",
      reasonCode: "PLAINTEXT_SECRET_REQUIRES_SEPARATE_DATA_AUTHORITY",
      importsCanonicalDestination: false,
      importsPan: false,
      canonicalState: "CONFIGURED_UNVERIFIED",
    };
  }
  if (evidence.verificationStatus || evidence.providerReference) {
    return {
      disposition: "COMPATIBILITY_ONLY",
      reasonCode: "PROVIDER_STATE_IS_NOT_CANONICAL_VERIFICATION",
      importsCanonicalDestination: false,
      importsPan: false,
      canonicalState: "CONFIGURED_UNVERIFIED",
    };
  }
  return {
    disposition: "COMPATIBILITY_ONLY",
    reasonCode: "AMBIGUOUS_LEGACY_DESTINATION",
    importsCanonicalDestination: false,
    importsPan: false,
    canonicalState: null,
  };
}

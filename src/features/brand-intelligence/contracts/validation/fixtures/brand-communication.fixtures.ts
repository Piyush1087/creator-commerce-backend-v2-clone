import type {
  BusinessStateManifestEntry,
  EvidenceManifestEntry,
} from "../validation.types";

const metadata = (semanticId: string | null, evidenceRef: string) => ({
  semantic_id: semanticId,
  authority: "CREATOR_SHOP_DERIVED",
  source_class: "OWNED_WEBSITE",
  freshness: "CURRENT",
  evidence_refs: [evidenceRef],
});

export const BRAND_COMMUNICATION_EVIDENCE_MANIFEST: readonly EvidenceManifestEntry[] =
  [
    {
      evidenceRef: "ev:message:1",
      capabilityId: "owned_website.brand_messaging",
      semanticId: "brand_messaging_observation",
      revisionIdentity: "capture:1",
    },
    {
      evidenceRef: "ev:constraint:1",
      capabilityId: "communication_constraint_evidence",
      semanticId: "communication_constraint_observation",
      revisionIdentity: "capture:1",
    },
    {
      evidenceRef: "ev:language:1",
      capabilityId: "observed_brand_communication_language_signals",
      semanticId: "communication_language_observation",
      revisionIdentity: "capture:1",
    },
  ];

export const EMPTY_BUSINESS_STATE_MANIFEST: readonly BusinessStateManifestEntry[] =
  [];

export const VALID_BRAND_COMMUNICATION_FULL = {
  communication_profile: {
    tone_traits: [
      { semantic_id: "warm-direct", trait: "Warm and direct" },
      { semantic_id: "plain-spoken", trait: "Plain-spoken" },
    ],
    free_text_guidance: "Use concise, conversational explanations.",
    communication_constraints: [
      {
        semantic_id: "no-unverified-claims",
        constraint: "Avoid unverified performance claims",
      },
      {
        semantic_id: "use-product-names",
        constraint: "Use the official product names",
      },
    ],
    primary_language: "en",
  },
  output_metadata: {
    tone_traits: [
      metadata("warm-direct", "ev:message:1"),
      metadata("plain-spoken", "ev:message:1"),
    ],
    free_text_guidance: metadata(null, "ev:message:1"),
    communication_constraints: [
      metadata("no-unverified-claims", "ev:constraint:1"),
      metadata("use-product-names", "ev:constraint:1"),
    ],
    primary_language: metadata(null, "ev:language:1"),
  },
} as const;

export const VALID_BRAND_COMMUNICATION_PARTIAL = {
  communication_profile: {
    tone_traits: null,
    free_text_guidance: null,
    communication_constraints: null,
    primary_language: "en",
  },
  output_metadata: {
    tone_traits: null,
    free_text_guidance: null,
    communication_constraints: null,
    primary_language: metadata(null, "ev:language:1"),
  },
} as const;

export const VALID_BRAND_COMMUNICATION_EXPLICIT_NULL = {
  communication_profile: null,
  output_metadata: {
    tone_traits: null,
    free_text_guidance: null,
    communication_constraints: null,
    primary_language: null,
  },
} as const;

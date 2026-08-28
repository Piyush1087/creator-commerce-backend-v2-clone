import type {
  BusinessStateManifestEntry,
  EvidenceManifestEntry,
} from "../validation.types";

const metadata = (evidenceRefs: readonly string[]) => ({
  authority: "CREATOR_SHOP_DERIVED",
  source_class: "OWNED_WEBSITE",
  freshness: "CURRENT",
  evidence_refs: evidenceRefs,
  business_state_refs: ["state:brand-name:7"],
});

export const BRAND_MEANING_EVIDENCE_MANIFEST: readonly EvidenceManifestEntry[] =
  [
    {
      evidenceRef: "ev:company:1",
      capabilityId: "owned_website.brand_company_context",
      semanticId: "company_context_observation",
      revisionIdentity: "capture:4",
    },
    {
      evidenceRef: "ev:message:4",
      capabilityId: "owned_website.brand_messaging",
      semanticId: "brand_messaging_observation",
      revisionIdentity: "capture:4",
    },
  ];

export const BRAND_MEANING_BUSINESS_STATE_MANIFEST: readonly BusinessStateManifestEntry[] =
  [
    {
      businessStateRef: "state:brand-name:7",
      semanticId: "brand_name",
      revisionIdentity: "7",
    },
  ];

export const VALID_BRAND_MEANING_FULL = {
  brand_description:
    "A digital studio that helps independent brands publish useful customer education.",
  positioning:
    "A practical partner for small teams that need credible content systems.",
  value_proposition:
    "Clearer publishing workflows grounded in each brand's owned knowledge.",
  output_metadata: {
    brand_description: metadata(["ev:company:1"]),
    positioning: metadata(["ev:message:4"]),
    value_proposition: metadata(["ev:company:1", "ev:message:4"]),
  },
} as const;

export const VALID_BRAND_MEANING_PARTIAL = {
  brand_description: "A digital studio for independent brands.",
  positioning: null,
  value_proposition: null,
  output_metadata: {
    brand_description: metadata(["ev:company:1"]),
    positioning: null,
    value_proposition: null,
  },
} as const;

export const VALID_BRAND_MEANING_EXPLICIT_NULL = {
  brand_description: null,
  positioning: null,
  value_proposition: null,
  output_metadata: {
    brand_description: null,
    positioning: null,
    value_proposition: null,
  },
} as const;

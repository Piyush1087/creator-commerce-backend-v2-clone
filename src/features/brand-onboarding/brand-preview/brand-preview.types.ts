export type BrandPreviewRuntimeState =
  | "ANALYSIS_ACTIVE"
  | "PREVIEW_READY"
  | "PREVIEW_FAILED_RECOVERABLE"
  | "PREVIEW_NOT_READY";

export type BrandPreviewPhase =
  | "UNDERSTANDING_BRAND"
  | "LEARNING_AUDIENCE"
  | "FINDING_CREATOR_OPPORTUNITIES"
  | "PREPARING_PREVIEW";

export type BrandPreviewEvidencePage = {
  url: string;
  pageType: string;
  title?: string;
  cleanText: string;
};

export type BrandPreviewEvidence = {
  brandName: string | null;
  logoUrl: string | null;
  pages: BrandPreviewEvidencePage[];
  evidenceRefs: string[];
  sufficientForPreviewSynthesisAttempt: boolean;
  coverage: {
    brandProposition: "PRESENT" | "WEAK" | "ABSENT";
    customerUseContext: "PRESENT" | "WEAK" | "ABSENT";
    commercialOfferingConversion: "PRESENT" | "WEAK" | "ABSENT";
  };
  availability: "AVAILABLE" | "PARTIALLY_AVAILABLE" | "UNAVAILABLE";
  qualityState: "VALID" | "DEGRADED" | "INVALID";
  qualityFlags: string[];
};

export type PublicWebEnrichment = {
  brand_summary: string;
  audience_or_use_context: string[];
  offering_or_commercial_context: string[];
  grounding_refs: string[];
};

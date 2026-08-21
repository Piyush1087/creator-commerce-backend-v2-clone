import type {
  BrandPreviewEvidence,
  PublicWebEnrichment,
} from "../brand-preview.types";

export const BRAND_PREVIEW_WEBSITE_EVIDENCE = Symbol(
  "brand_preview.website_evidence",
);
export const BRAND_PREVIEW_PUBLIC_WEB_ENRICHMENT = Symbol(
  "brand_preview.public_web_enrichment",
);

export interface BrandPreviewWebsiteEvidencePort {
  acquire(args: {
    websiteUrl: string;
    sameRunGatekeeperEvidence?: unknown;
  }): Promise<BrandPreviewEvidence>;
}

export interface BrandPreviewPublicWebEnrichmentPort {
  acquire(args: {
    runId: string;
    websiteUrl: string;
    modelId: string;
  }): Promise<{ payload: PublicWebEnrichment; evidenceRefs: string[] }>;
}

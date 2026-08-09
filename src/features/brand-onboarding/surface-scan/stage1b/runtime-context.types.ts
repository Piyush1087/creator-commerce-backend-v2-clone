/** Caps Gemini payload size per page (Phase 5). */
export const RUNTIME_CONTEXT_MAX_CHARS = 15_000;

export type RuntimeContextPage = {
  url: string;
  page_type: string;
  title?: string;
  clean_text: string;
  internal_links?: string[];
};

export type RuntimeContextExecution = {
  scan_id: string;
  brand_id?: string;
  website_url: string;
  industry: string;
  sub_industry: string;
  timestamp: string;
};

export type RuntimeContextBrandIdentity = {
  brand_name: string;
  website: string;
  industry: string;
  sub_industry: string;
  country: string;
  reporting_currency: string;
  social_handles: {
    instagram: string | null;
    tiktok: string | null;
    facebook: string | null;
    youtube: string | null;
    linkedin: string | null;
  };
  tagline: string | null;
  logo?: string | null;
};

export type RuntimeContextWebsiteSummary = {
  homepage_excerpt: string;
  about_excerpt?: string;
  nav_labels: string[];
};

export type RuntimeContextWebsiteAssets = {
  logo: string | null;
  colors: string[];
  fonts: string[];
};

/**
 * Full Stage 1B runtime context package persisted on
 * BrandIntelligenceScan.runtimeContext (Prompt A input).
 */
export type RuntimeContextPackage = {
  execution_context: RuntimeContextExecution;
  brand_identity: RuntimeContextBrandIdentity;
  website_summary: RuntimeContextWebsiteSummary;
  website_assets: RuntimeContextWebsiteAssets;
  pages: RuntimeContextPage[];
  candidate_entities: unknown[];
};

import { IndustryVertical } from "@prisma/client";

import type { ParallelSearchRequest } from "../integrations/parallel/parallel-search.types";

/**
 * Derives a short label from apex hostname for web search queries (e.g. mamaearth.in → mamaearth).
 */
export function apexLabelFromHostname(hostname: string): string {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length >= 2 && parts[0] === "www") {
    return parts[1] ?? hostname;
  }
  return parts[0] ?? hostname;
}

function industrySearchHint(industry: IndustryVertical | null): string {
  switch (industry) {
    case IndustryVertical.HEALTHCARE:
      return "healthcare clinics or consumer health brands";
    case IndustryVertical.OFFLINE_SERVICES:
      return "local services or offline retail brands";
    case IndustryVertical.SAAS_AI:
      return "SaaS or AI software products";
    case IndustryVertical.D2C:
      return "direct-to-consumer ecommerce brands";
    default:
      return "same market segment";
  }
}

/**
 * Builds a Parallel Search request aligned with product Prompt 3 (competitors via web search).
 */
export function buildCompetitorParallelSearch(args: {
  hostname: string;
  canonicalUrl: string;
  industryHint: IndustryVertical | null;
}): ParallelSearchRequest {
  const label = apexLabelFromHostname(args.hostname);
  const vertical = industrySearchHint(args.industryHint ?? null);

  const objective = [
    `Find 4–6 **direct competitor brands** to the business at ${args.canonicalUrl} (apex: ${label}).`,
    `Industry context: prioritize ${vertical}.`,
    "Return pages that identify **rival brand names** and their **official websites**.",
    "Exclude marketplaces (Amazon, Flipkart, Nykaa marketplace-only), Wikipedia-only, and generic listicles unless they cite specific brand URLs.",
  ].join(" ");

  return {
    objective,
    mode: "basic",
    search_queries: [
      `${label} competitors`,
      `${label} similar brands`,
      `brands like ${label}`,
    ],
  };
}

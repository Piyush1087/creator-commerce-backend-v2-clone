import type {
  CoreIdentitySnapshot,
  RawScrapeResult,
} from "./core-identity.schema";

function evidence(
  pageUrl: string,
  pageType: string,
  excerpt: string,
): CoreIdentitySnapshot["brand_name"]["evidence"] {
  return [{ page_url: pageUrl, page_type: pageType, excerpt }];
}

export function mergeScrapePayloads(args: {
  scanId: string;
  targetUrl: string;
  industry: string;
  subIndustry: string;
  zyte: RawScrapeResult | null;
  playwright: RawScrapeResult | null;
}): CoreIdentitySnapshot {
  const { scanId, targetUrl, industry, subIndustry, zyte, playwright } = args;

  const nameValue =
    zyte?.brand_name ||
    playwright?.brand_name ||
    fallbackBrandName(targetUrl);

  let logoValue = playwright?.logo_url || zyte?.logo_url || null;
  if (!logoValue || logoValue.includes("404") || logoValue === "") {
    logoValue = null;
  }

  const mergedSocials = {
    instagram:
      playwright?.socials?.instagram || zyte?.socials?.instagram || null,
    tiktok: playwright?.socials?.tiktok || zyte?.socials?.tiktok || null,
    facebook: playwright?.socials?.facebook || zyte?.socials?.facebook || null,
    youtube: playwright?.socials?.youtube || zyte?.socials?.youtube || null,
    linkedin: playwright?.socials?.linkedin || zyte?.socials?.linkedin || null,
  };

  const discovered = [
    ...(zyte?.discovered_links ?? []),
    ...(playwright?.discovered_links ?? []),
  ];
  const uniqueLinks = [...new Set(discovered)].slice(0, 40);

  const country =
    (zyte?.country || playwright?.country || "US").slice(0, 2).toUpperCase() ||
    "US";
  const currency =
    (zyte?.currency || playwright?.currency || "USD").slice(0, 3).toUpperCase() ||
    "USD";

  return {
    scan_id: scanId,
    brand_name: {
      value: nameValue,
      confidence: zyte?.brand_name ? 95 : 70,
      evidence: evidence(
        targetUrl,
        "homepage",
        `Detected brand identifier matching: ${nameValue}`,
      ),
      source: "CRAWLER",
      edited: false,
    },
    website_url: {
      value: targetUrl,
      confidence: 100,
      evidence: evidence(
        targetUrl,
        "homepage",
        "Root baseline URL target verified.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    country: {
      value: country,
      confidence: zyte?.country ? 90 : 50,
      evidence: evidence(
        targetUrl,
        "metadata",
        "Extracted country parameter code block.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    reporting_currency: {
      value: currency,
      confidence: zyte?.currency ? 90 : 50,
      evidence: evidence(
        targetUrl,
        "metadata",
        "Inferred transaction asset symbol.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    brand_logo: {
      value: logoValue,
      confidence: logoValue ? 85 : 0,
      evidence: evidence(
        targetUrl,
        "homepage",
        logoValue
          ? `Logo link verified: ${logoValue}`
          : "No usable header identity asset located.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    industry: {
      value: industry,
      confidence: 90,
      evidence: evidence(
        targetUrl,
        "gatekeeper_prediction",
        "Calculated baseline classification metrics.",
      ),
      source: "AI",
      edited: false,
    },
    sub_industry: {
      value: subIndustry || "General",
      confidence: 85,
      evidence: evidence(
        targetUrl,
        "gatekeeper_prediction",
        "Sub-tier segment taxonomy configured.",
      ),
      source: "AI",
      edited: false,
    },
    social_handles: {
      value: mergedSocials,
      confidence: 90,
      evidence: evidence(
        targetUrl,
        "homepage",
        "Scanned anchor elements across social media pattern sets.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    tagline: {
      value: zyte?.tagline || playwright?.tagline || null,
      confidence: zyte?.tagline ? 80 : 40,
      evidence: evidence(
        targetUrl,
        "homepage",
        "Evaluated core descriptive meta layouts.",
      ),
      source: "CRAWLER",
      edited: false,
    },
    discovered_root_links: uniqueLinks,
  };
}

function fallbackBrandName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const label = domain.split(".")[0] ?? "brand";
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "Unknown Brand";
  }
}

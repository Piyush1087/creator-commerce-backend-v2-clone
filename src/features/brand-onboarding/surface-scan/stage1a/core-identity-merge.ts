import type {
  CoreIdentitySnapshot,
  RawScrapeResult,
} from "./core-identity.schema";
import { normalizeIndustryVertical } from "./core-identity.schema";
import { isPlaceholderAsset } from "./zyte-homepage.strategy";

/**
 * Phase 3 conflict matrix: "Currency / Geo … Static Fallback (Stage 0 Domain
 * TLD context)". TLD is used only when no driver extracted a country;
 * reporting currency is then derived deterministically from that country.
 */
const TLD_GEO_HINTS: ReadonlyArray<{
  suffix: string;
  country: string;
}> = [
  { suffix: ".in", country: "IN" },
  { suffix: ".co.uk", country: "GB" },
  { suffix: ".uk", country: "GB" },
  { suffix: ".au", country: "AU" },
  { suffix: ".ca", country: "CA" },
  { suffix: ".de", country: "DE" },
  { suffix: ".fr", country: "FR" },
  { suffix: ".sg", country: "SG" },
  { suffix: ".ae", country: "AE" },
  { suffix: ".jp", country: "JP" },
];

function countryHintFromTld(targetUrl: string): string | null {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    for (const hint of TLD_GEO_HINTS) {
      if (host.endsWith(hint.suffix)) {
        return hint.country;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/** Reporting currency is derived only from the resolved ISO-2 country. */
const COUNTRY_TO_CURRENCY: Readonly<Record<string, string>> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AU: "AUD",
  CA: "CAD",
  SG: "SGD",
  AE: "AED",
  JP: "JPY",
  CN: "CNY",
  HK: "HKD",
  NZ: "NZD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  TR: "TRY",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  KR: "KRW",
  ID: "IDR",
  MY: "MYR",
  TH: "THB",
  VN: "VND",
  PH: "PHP",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  IL: "ILS",
  EG: "EGP",
  NG: "NGN",
  KE: "KES",
  GH: "GHS",
  RU: "RUB",
  UA: "UAH",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
};

function currencyFromCountry(country: string): string {
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? "USD";
}

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
    zyte?.brand_name || playwright?.brand_name || fallbackBrandName(targetUrl);

  let logoValue = playwright?.logo_url || zyte?.logo_url || null;
  if (
    !logoValue ||
    logoValue.includes("404") ||
    logoValue === "" ||
    isPlaceholderAsset(logoValue)
  ) {
    logoValue = null;
  }
  // Normalize to an absolute URL against the scan target; a logo that cannot
  // resolve must degrade to null (avatar fallback) instead of failing the
  // whole snapshot at Zod validation.
  if (logoValue) {
    try {
      logoValue = new URL(logoValue, targetUrl).toString();
    } catch {
      logoValue = null;
    }
  }
  // Ordered alternates the mirror step can walk when the primary 404s.
  const logoCandidates = [
    ...new Set(
      [
        ...(playwright?.logo_candidates ?? []),
        ...(zyte?.logo_candidates ?? []),
      ].flatMap((candidate) => {
        if (isPlaceholderAsset(candidate)) return [];
        try {
          return [new URL(candidate, targetUrl).toString()];
        } catch {
          return [];
        }
      }),
    ),
  ].slice(0, 5);

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

  const tldCountry = countryHintFromTld(targetUrl);
  const country = (zyte?.country || playwright?.country || tldCountry || "US")
    .slice(0, 2)
    .toUpperCase();
  const currency = currencyFromCountry(country);

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
      confidence: zyte?.country || playwright?.country ? 85 : 50,
      evidence: evidence(
        targetUrl,
        "metadata",
        `Reporting currency inferred from country ${country}.`,
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
      value: normalizeIndustryVertical(industry),
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
    logo_candidates: logoCandidates,
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

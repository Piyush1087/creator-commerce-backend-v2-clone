import type {
  CoreIdentitySnapshot,
  RawScrapeResult,
} from "./core-identity.schema";
import { normalizeIndustryVertical } from "./core-identity.schema";
import { isPlaceholderAsset } from "./zyte-homepage.strategy";

type FieldSource = CoreIdentitySnapshot["brand_name"]["source"];

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

/**
 * Phase 3 merge engine — deterministic weights, no LLM:
 * - Brand name: Zyte (JSON-LD / meta) over Playwright (title / OG)
 * - Logo / socials: Playwright (hydrated DOM) over Zyte (static)
 * - Geo: Zyte over Playwright over TLD hint
 * - Tagline: Zyte over Playwright
 */
export function mergeScrapePayloads(args: {
  scanId: string;
  targetUrl: string;
  industry: string;
  subIndustry: string;
  zyte: RawScrapeResult | null;
  playwright: RawScrapeResult | null;
}): CoreIdentitySnapshot {
  const { scanId, targetUrl, industry, subIndustry, zyte, playwright } = args;

  const nameFromZyte = Boolean(zyte?.brand_name?.trim());
  const nameFromPw = Boolean(playwright?.brand_name?.trim());
  const nameValue =
    zyte?.brand_name?.trim() ||
    playwright?.brand_name?.trim() ||
    fallbackBrandName(targetUrl);
  const nameSource: FieldSource = nameFromZyte
    ? "ZYTE"
    : nameFromPw
      ? "PLAYWRIGHT"
      : "SYSTEM";

  const logoFromPw = Boolean(playwright?.logo_url?.trim());
  const logoFromZyte = Boolean(zyte?.logo_url?.trim());
  let logoValue = playwright?.logo_url || zyte?.logo_url || null;
  if (
    !logoValue ||
    logoValue.includes("404") ||
    logoValue === "" ||
    isPlaceholderAsset(logoValue)
  ) {
    logoValue = null;
  }
  if (logoValue) {
    try {
      logoValue = new URL(logoValue, targetUrl).toString();
    } catch {
      logoValue = null;
    }
  }
  const logoSource: FieldSource = !logoValue
    ? "SYSTEM"
    : logoFromPw
      ? "PLAYWRIGHT"
      : logoFromZyte
        ? "ZYTE"
        : "SYSTEM";

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
  const socialFromPw = Object.values(playwright?.socials ?? {}).some(Boolean);
  const socialFromZyte = Object.values(zyte?.socials ?? {}).some(Boolean);
  const socialSource: FieldSource = socialFromPw
    ? "PLAYWRIGHT"
    : socialFromZyte
      ? "ZYTE"
      : "SYSTEM";

  const discovered = [
    ...(zyte?.discovered_links ?? []),
    ...(playwright?.discovered_links ?? []),
  ];
  const uniqueLinks = [...new Set(discovered)].slice(0, 40);

  const tldCountry = countryHintFromTld(targetUrl);
  const countryFromZyte = Boolean(zyte?.country?.trim());
  const countryFromPw = Boolean(playwright?.country?.trim());
  const country = (
    zyte?.country ||
    playwright?.country ||
    tldCountry ||
    "US"
  )
    .slice(0, 2)
    .toUpperCase();
  const countrySource: FieldSource = countryFromZyte
    ? "ZYTE"
    : countryFromPw
      ? "PLAYWRIGHT"
      : "SYSTEM";
  const currency = currencyFromCountry(country);

  const taglineFromZyte = Boolean(zyte?.tagline?.trim());
  const taglineFromPw = Boolean(playwright?.tagline?.trim());
  const taglineValue = zyte?.tagline || playwright?.tagline || null;
  const taglineSource: FieldSource = taglineFromZyte
    ? "ZYTE"
    : taglineFromPw
      ? "PLAYWRIGHT"
      : "SYSTEM";

  return {
    scan_id: scanId,
    brand_name: {
      value: nameValue,
      confidence: nameFromZyte ? 95 : nameFromPw ? 70 : 40,
      evidence: evidence(
        targetUrl,
        "homepage",
        nameFromZyte
          ? `Zyte (JSON-LD/meta): detected brand name "${nameValue}"`
          : nameFromPw
            ? `Playwright (DOM title/OG): detected brand name "${nameValue}"`
            : `System fallback: brand name derived from domain → "${nameValue}"`,
      ),
      source: nameSource,
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
      source: "SYSTEM",
      edited: false,
    },
    country: {
      value: country,
      confidence: countryFromZyte ? 90 : countryFromPw ? 70 : 50,
      evidence: evidence(
        targetUrl,
        "metadata",
        countryFromZyte
          ? `Zyte metadata: country "${country}"`
          : countryFromPw
            ? `Playwright metadata: country "${country}"`
            : `System TLD/geo hint: country "${country}"`,
      ),
      source: countrySource,
      edited: false,
    },
    reporting_currency: {
      value: currency,
      confidence: countryFromZyte || countryFromPw ? 85 : 50,
      evidence: evidence(
        targetUrl,
        "metadata",
        `Reporting currency inferred from country ${country} (${countrySource}).`,
      ),
      source: countrySource,
      edited: false,
    },
    brand_logo: {
      value: logoValue,
      confidence: logoValue ? (logoFromPw ? 90 : 80) : 0,
      evidence: evidence(
        targetUrl,
        "homepage",
        logoValue
          ? logoFromPw
            ? `Playwright (rendered DOM): logo ${logoValue}`
            : `Zyte (og:image/static): logo ${logoValue}`
          : "No usable header identity asset located.",
      ),
      source: logoSource,
      edited: false,
    },
    industry: {
      value: normalizeIndustryVertical(industry),
      confidence: 90,
      evidence: evidence(
        targetUrl,
        "gatekeeper_prediction",
        "Gemini Gatekeeper baseline classification.",
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
        "Gemini Gatekeeper sub-industry taxonomy.",
      ),
      source: "AI",
      edited: false,
    },
    social_handles: {
      value: mergedSocials,
      confidence: socialFromPw || socialFromZyte ? 90 : 0,
      evidence: evidence(
        targetUrl,
        "homepage",
        socialFromPw
          ? "Playwright: scanned hydrated DOM anchors for social patterns."
          : socialFromZyte
            ? "Zyte: static HTML regex / anchor social matches."
            : "No social handles located by Zyte or Playwright.",
      ),
      source: socialSource,
      edited: false,
    },
    tagline: {
      value: taglineValue,
      confidence: taglineFromZyte ? 80 : taglineFromPw ? 60 : 0,
      evidence: evidence(
        targetUrl,
        "homepage",
        taglineFromZyte
          ? "Zyte: descriptive meta / OG tagline."
          : taglineFromPw
            ? "Playwright: OG/description tagline from rendered DOM."
            : "No tagline located.",
      ),
      source: taglineSource,
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

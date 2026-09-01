import { load } from "cheerio";
import { z } from "zod";

const boundedText = z.string().max(600);
const statement = z
  .object({
    text: boundedText,
    locator: z.string().max(160),
    authorship: z.enum(["BRAND_AUTHORED", "TESTIMONIAL", "UNKNOWN"]),
    offeringContext: z.boolean(),
  })
  .strict();
const visual = z
  .object({
    semantic: z.enum([
      "COLOUR_USAGE_OBSERVATION",
      "TYPOGRAPHY_OBSERVATION",
      "LAYOUT_OR_COMPOSITION_OBSERVATION",
      "LOGO_OR_MARK_OBSERVATION",
      "GENERAL_VISUAL_PATTERN",
    ]),
    locator: z.string().max(160),
    property: z.string().max(80),
    value: boundedText,
    matchedElements: z.number().int().min(1).max(1000),
    siteLevelDeclaration: z.boolean(),
  })
  .strict();
const location = z
  .object({
    locator: z.string().max(160),
    statement: boundedText,
    name: boundedText.nullable(),
    streetAddress: boundedText.nullable(),
    city: boundedText.nullable(),
    region: boundedText.nullable(),
    postalCode: boundedText.nullable(),
    country: boundedText.nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    telephone: boundedText.nullable(),
    email: boundedText.nullable(),
    sourceIdentifier: boundedText.nullable(),
  })
  .strict();
const commercial = z
  .object({
    locator: z.string().max(160),
    sourceKind: z.enum(["HTML", "JSON_LD"]),
    observedPriceMode: z.enum([
      "EXACT",
      "STARTING_AT",
      "RANGE",
      "NOT_PUBLICLY_LISTED",
    ]),
    currentMinAmount: z.number().finite().nonnegative().nullable(),
    currentMaxAmount: z.number().finite().nonnegative().nullable(),
    regularReferenceMinAmount: z.number().finite().nonnegative().nullable(),
    regularReferenceMaxAmount: z.number().finite().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    relationship: z.enum([
      "CURRENT_ONLY",
      "CURRENT_IS_SALE_WITH_REGULAR_REFERENCE",
      "NOT_APPLICABLE",
    ]),
    explicitNotPubliclyListed: z.boolean(),
    context: boundedText,
  })
  .strict();

/** Provider-neutral bounded source descriptors, never computed styles or canonical state. */
export const ownedSiteObservationFragmentSchema = z
  .object({
    version: z.literal("owned-site-observations/1.0"),
    statements: z.array(statement).max(80),
    visuals: z.array(visual).max(32),
    locations: z.array(location).max(24),
    commercials: z.array(commercial).max(24).default([]),
    limitations: z.array(z.string().max(80)).max(12),
  })
  .strict();
export type OwnedSiteObservationFragment = z.infer<
  typeof ownedSiteObservationFragmentSchema
>;
export type ObservedStatement = z.infer<typeof statement>;
export type ObservedLocation = z.infer<typeof location>;
export type ObservedCommercial = z.infer<typeof commercial>;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const textValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? clean(value).slice(0, 600) : null;
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const coordinate = (value: unknown, limit: number): number | null => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(numeric) && Math.abs(numeric) <= limit
    ? numeric
    : null;
};

const intlCurrencySupport = Intl as typeof Intl & {
  supportedValuesOf(key: "currency"): string[];
};
const ISO_CURRENCIES = new Set(
  intlCurrencySupport.supportedValuesOf("currency"),
);
type Money = { amount: number; currency: string | null; raw: string };
const moneyPattern =
  /(?:\b(AED|AUD|CAD|CHF|CNY|EUR|GBP|INR|JPY|NZD|SGD|USD)\s*|([$₹€£])\s*)(\d{1,12}(?:[,.]\d{1,3})*(?:\.\d{1,2})?)|\b(\d{1,12}(?:[,.]\d{1,3})*(?:\.\d{1,2})?)\s*(AED|AUD|CAD|CHF|CNY|EUR|GBP|INR|JPY|NZD|SGD|USD)\b/gi;

function numericAmount(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function safeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return ISO_CURRENCIES.has(normalized) ? normalized : null;
}

function symbolCurrency(symbol: string | undefined): string | null {
  if (symbol === "₹") return "INR";
  if (symbol === "€") return "EUR";
  if (symbol === "£") return "GBP";
  // A bare dollar symbol is not defensible as USD, CAD, AUD, NZD or SGD.
  return null;
}

function monies(text: string): Money[] {
  return [...text.matchAll(moneyPattern)].flatMap((match) => {
    const amount = numericAmount(match[3] ?? match[4]);
    if (amount === null) return [];
    return [
      {
        amount,
        currency:
          safeCurrency(match[1] ?? match[5]) ?? symbolCurrency(match[2]),
        raw: match[0],
      },
    ];
  });
}

function commonCurrency(values: readonly Money[]): string | null {
  const observed = [...new Set(values.map((value) => value.currency))];
  return observed.length === 1 ? observed[0] : null;
}

function commercialFromText(
  text: string,
  locator: string,
): z.infer<typeof commercial> | null {
  const context = clean(text).slice(0, 600);
  if (
    /\b(?:price|pricing|cost)\s+(?:is\s+)?(?:not\s+public(?:ly\s+(?:available|listed))?|available\s+(?:only\s+)?on\s+request)|\bcontact\s+(?:us\s+)?for\s+pric(?:e|ing)|\brequest\s+(?:a\s+)?quote\b/i.test(
      context,
    )
  ) {
    return {
      locator,
      sourceKind: "HTML",
      observedPriceMode: "NOT_PUBLICLY_LISTED",
      currentMinAmount: null,
      currentMaxAmount: null,
      regularReferenceMinAmount: null,
      regularReferenceMaxAmount: null,
      currency: null,
      relationship: "NOT_APPLICABLE",
      explicitNotPubliclyListed: true,
      context,
    };
  }
  const values = monies(context);
  if (!values.length) return null;
  const regularCurrent =
    /\b(?:was|regular(?:ly)?|regular price|mrp|list price)\b[\s\S]{0,80}\b(?:now|sale(?: price)?|promotional(?: price)?)\b/i.test(
      context,
    );
  if (regularCurrent && values.length === 2) {
    return {
      locator,
      sourceKind: "HTML",
      observedPriceMode: "EXACT",
      currentMinAmount: values[1].amount,
      currentMaxAmount: values[1].amount,
      regularReferenceMinAmount: values[0].amount,
      regularReferenceMaxAmount: values[0].amount,
      currency: commonCurrency(values),
      relationship: "CURRENT_IS_SALE_WITH_REGULAR_REFERENCE",
      explicitNotPubliclyListed: false,
      context,
    };
  }
  if (
    values.length === 2 &&
    /(?:\bbetween\b[\s\S]{0,80}\band\b|\b(?:price|pricing|cost)?\s*range\b|\bfrom\b[\s\S]{0,80}\bto\b|\s[-–—]\s)/i.test(
      context,
    )
  ) {
    return {
      locator,
      sourceKind: "HTML",
      observedPriceMode: "RANGE",
      currentMinAmount: Math.min(values[0].amount, values[1].amount),
      currentMaxAmount: Math.max(values[0].amount, values[1].amount),
      regularReferenceMinAmount: null,
      regularReferenceMaxAmount: null,
      currency: commonCurrency(values),
      relationship: "CURRENT_ONLY",
      explicitNotPubliclyListed: false,
      context,
    };
  }
  if (
    values.length === 1 &&
    /\b(?:from|starting\s+(?:at|from)|starts?\s+at|as\s+low\s+as)\b/i.test(
      context,
    )
  ) {
    return {
      locator,
      sourceKind: "HTML",
      observedPriceMode: "STARTING_AT",
      currentMinAmount: values[0].amount,
      currentMaxAmount: null,
      regularReferenceMinAmount: null,
      regularReferenceMaxAmount: null,
      currency: values[0].currency,
      relationship: "CURRENT_ONLY",
      explicitNotPubliclyListed: false,
      context,
    };
  }
  if (values.length !== 1) return null;
  return {
    locator,
    sourceKind: "HTML",
    observedPriceMode: "EXACT",
    currentMinAmount: values[0].amount,
    currentMaxAmount: values[0].amount,
    regularReferenceMinAmount: null,
    regularReferenceMaxAmount: null,
    currency: values[0].currency,
    relationship: "CURRENT_ONLY",
    explicitNotPubliclyListed: false,
    context,
  };
}

function topLevelStyleRules(
  css: string,
): Array<{ selector: string; declarations: string }> {
  const rules: Array<{ selector: string; declarations: string }> = [];
  let start = 0;
  let bodyStart = 0;
  let depth = 0;
  let selector = "";
  let nested = false;
  for (let index = 0; index < css.length; index++) {
    if (css[index] === "{") {
      if (depth === 0) {
        selector = css.slice(start, index).trim();
        bodyStart = index + 1;
        nested = false;
      } else nested = true;
      depth++;
    } else if (css[index] === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        if (!nested && !selector.startsWith("@"))
          rules.push({ selector, declarations: css.slice(bodyStart, index) });
        start = index + 1;
      }
    }
  }
  return rules;
}

export function retainOwnedSiteObservations(
  html: string,
): OwnedSiteObservationFragment {
  // Extraction work is bounded independently of retained HTML. No scripts execute.
  const $ = load(html.slice(0, 250_000));
  const result: OwnedSiteObservationFragment = {
    version: "owned-site-observations/1.0",
    statements: [],
    visuals: [],
    locations: [],
    commercials: [],
    limitations: ["DOM_DECLARATIONS_NOT_COMPUTED_OR_RENDERED"],
  };
  if (html.length > 250_000)
    result.limitations.push("SOURCE_INSPECTION_TRUNCATED");
  if ($('link[rel="stylesheet"]').length)
    result.limitations.push("EXTERNAL_STYLESHEETS_NOT_FETCHED");
  const hidden = (node: ReturnType<typeof $>) =>
    node.closest(
      'script, style, template, noscript, [hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]',
    ).length > 0;
  $("h1,h2,h3,p,li,blockquote,td,main,section,div").each((index, element) => {
    const node = $(element);
    if (
      hidden(node) ||
      node.closest("nav").length ||
      node.find("p,li,blockquote,td,h1,h2,h3,div,section").length
    )
      return;
    const testimonial =
      node.closest(
        'blockquote,[itemprop="review"],[class*="testimonial"],[class*="review"]',
      ).length > 0;
    const offeringContext =
      node.closest(
        '[itemtype*="Product"],[itemtype*="Service"],[data-offering],[class*="product-card"],[class*="plan-card"]',
      ).length > 0;
    const units = clean(node.text()).split(/(?<=[.!?])\s+/);
    for (const [unitIndex, text] of units.entries()) {
      if (text.length < 10 || text.length > 600) continue;
      if (result.statements.length >= 80) {
        if (!result.limitations.includes("STATEMENT_LIMIT"))
          result.limitations.push("STATEMENT_LIMIT");
        break;
      }
      result.statements.push({
        text,
        locator: `text:${index}:${unitIndex}`,
        authorship: testimonial ? "TESTIMONIAL" : "BRAND_AUTHORED",
        offeringContext,
      });
      if (
        !testimonial &&
        result.commercials.length < 24 &&
        !node.closest(
          '[class*="related"],[class*="recommend"],[class*="upsell"],[class*="cross-sell"],[data-related-products]',
        ).length
      ) {
        const observed = commercialFromText(text, `text:${index}:${unitIndex}`);
        if (observed) result.commercials.push(observed);
      }
    }
  });
  function addStyle(
    selector: string,
    declarations: string,
    count: number,
    siteLevel: boolean,
  ) {
    for (const declaration of declarations.split(";")) {
      const match = /^\s*([a-z-]+)\s*:\s*(.{1,600})$/i.exec(declaration);
      if (!match || result.visuals.length >= 32) continue;
      const property = match[1].toLowerCase();
      const value = match[2].trim();
      const semantic =
        /^(color|background-color|border-color|fill|stroke)$/.test(property)
          ? "COLOUR_USAGE_OBSERVATION"
          : /^(font-family|font-weight|font-size|letter-spacing)$/.test(
                property,
              )
            ? "TYPOGRAPHY_OBSERVATION"
            : /^(display|grid-template-columns|gap|padding|margin|border-radius|text-align|max-width)$/.test(
                  property,
                )
              ? "LAYOUT_OR_COMPOSITION_OBSERVATION"
              : null;
      if (semantic)
        result.visuals.push({
          semantic,
          locator: selector.slice(0, 160),
          property,
          value,
          matchedElements: Math.min(1000, count),
          siteLevelDeclaration: siteLevel,
        });
    }
  }
  $("style").each((_index, element) => {
    // Only ordinary flat rules with a DOM match; media/pseudo-state applicability is not inferred.
    const css = $(element)
      .text()
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of topLevelStyleRules(css)) {
      const selector = rule.selector;
      if (/[{}@:]|url\(/i.test(selector) || selector.length > 160) continue;
      try {
        const matches = $(selector).filter((_i, el) => !hidden($(el))).length;
        if (matches)
          addStyle(
            selector,
            rule.declarations,
            matches,
            /^(html|body)$/.test(selector),
          );
      } catch {
        /* Unsupported selector: retain no inferred observation. */
      }
    }
  });
  $("[style]").each((index, element) => {
    const node = $(element);
    if (!hidden(node))
      addStyle(
        `inline:${index}`,
        node.attr("style") ?? "",
        1,
        node.is("body,html"),
      );
  });
  $("img").each((index, element) => {
    if (result.visuals.length >= 32 || hidden($(element))) return;
    const node = $(element);
    const src = node.attr("src");
    if (!src || src.length > 500 || !/^(https?:|\/|\.\/|[^:]+$)/i.test(src))
      return;
    result.visuals.push({
      semantic: /logo|brand mark/i.test(node.attr("alt") ?? "")
        ? "LOGO_OR_MARK_OBSERVATION"
        : "GENERAL_VISUAL_PATTERN",
      locator: `img:${index}`,
      property: "image_presence",
      value: src,
      matchedElements: 1,
      siteLevelDeclaration: false,
    });
  });
  function addLocation(value: Record<string, unknown>, locator: string) {
    if (result.locations.length >= 24) return;
    const address = object(value.address);
    const rawAddress = textValue(value.address);
    const types = Array.isArray(value["@type"])
      ? value["@type"]
      : [value["@type"]];
    const isAddress = types.includes("PostalAddress");
    const fields = address ?? (isAddress ? value : {});
    const streetAddress = textValue(fields.streetAddress) ?? rawAddress;
    if (!streetAddress && !textValue(fields.addressLocality)) return;
    const geo = object(value.geo);
    const name = textValue(value.name);
    result.locations.push({
      locator,
      statement: [
        name,
        streetAddress,
        textValue(fields.addressLocality),
        textValue(fields.addressRegion),
        textValue(fields.postalCode),
        textValue(fields.addressCountry),
      ]
        .filter(Boolean)
        .join(", ")
        .slice(0, 600),
      name,
      streetAddress,
      city: textValue(fields.addressLocality),
      region: textValue(fields.addressRegion),
      postalCode: textValue(fields.postalCode),
      country:
        textValue(fields.addressCountry) ??
        textValue(object(fields.addressCountry)?.name),
      latitude: coordinate(geo?.latitude, 90),
      longitude: coordinate(geo?.longitude, 180),
      telephone: textValue(value.telephone),
      email: textValue(value.email),
      sourceIdentifier: textValue(value["@id"]) ?? textValue(value.identifier),
    });
  }
  function visit(value: unknown, locator: string, depth: number) {
    if (depth > 4 || result.locations.length >= 24) return;
    if (Array.isArray(value)) {
      value
        .slice(0, 24)
        .forEach((entry, index) =>
          visit(entry, `${locator}:${index}`, depth + 1),
        );
      return;
    }
    const node = object(value);
    if (!node) return;
    // Product shipping destinations/review authors are not business locations.
    const types = Array.isArray(node["@type"])
      ? node["@type"]
      : [node["@type"]];
    if (
      types.some(
        (type) =>
          typeof type === "string" &&
          /^(PostalAddress|Organization|LocalBusiness|Store|MedicalClinic|MedicalBusiness|ProfessionalService|Place|Office|Restaurant|Hospital|Dentist|HealthAndBeautyBusiness)$/.test(
            type,
          ),
      )
    )
      addLocation(node, locator);
    for (const key of ["@graph", "location", "department", "subOrganization"])
      if (node[key]) visit(node[key], `${locator}:${key}`, depth + 1);
  }

  function typed(value: Record<string, unknown>, expected: string): boolean {
    const types = Array.isArray(value["@type"])
      ? value["@type"]
      : [value["@type"]];
    return types.includes(expected);
  }

  function structuredCommercial(
    offer: Record<string, unknown>,
    locator: string,
  ): z.infer<typeof commercial> | null {
    const currency = safeCurrency(offer.priceCurrency);
    const low = numericAmount(offer.lowPrice);
    const high = numericAmount(offer.highPrice);
    const price = numericAmount(offer.price);
    if (low !== null && high !== null) {
      return {
        locator,
        sourceKind: "JSON_LD",
        observedPriceMode: low === high ? "EXACT" : "RANGE",
        currentMinAmount: Math.min(low, high),
        currentMaxAmount: Math.max(low, high),
        regularReferenceMinAmount: null,
        regularReferenceMaxAmount: null,
        currency,
        relationship: "CURRENT_ONLY",
        explicitNotPubliclyListed: false,
        context: `Structured Offer ${low}-${high}${currency ? ` ${currency}` : ""}`,
      };
    }
    if (price === null) return null;
    return {
      locator,
      sourceKind: "JSON_LD",
      observedPriceMode: "EXACT",
      currentMinAmount: price,
      currentMaxAmount: price,
      regularReferenceMinAmount: null,
      regularReferenceMaxAmount: null,
      currency,
      relationship: "CURRENT_ONLY",
      explicitNotPubliclyListed: false,
      context: `Structured Offer ${price}${currency ? ` ${currency}` : ""}`,
    };
  }

  function collectTyped(
    value: unknown,
    expected: string,
    output: Record<string, unknown>[],
    depth = 0,
  ): void {
    if (depth > 4 || output.length > 24) return;
    if (Array.isArray(value)) {
      value
        .slice(0, 24)
        .forEach((entry) => collectTyped(entry, expected, output, depth + 1));
      return;
    }
    const node = object(value);
    if (!node) return;
    if (typed(node, expected)) output.push(node);
    for (const key of ["@graph", "mainEntity"])
      if (node[key]) collectTyped(node[key], expected, output, depth + 1);
  }

  function addStructuredCommercial(value: unknown, locator: string): void {
    if (result.commercials.length >= 24) return;
    const products: Record<string, unknown>[] = [];
    collectTyped(value, "Product", products);
    if (products.length > 1) {
      if (
        !result.limitations.includes(
          "AMBIGUOUS_MULTI_OFFERING_STRUCTURED_COMMERCIAL",
        )
      )
        result.limitations.push(
          "AMBIGUOUS_MULTI_OFFERING_STRUCTURED_COMMERCIAL",
        );
      return;
    }
    let rawOffers: unknown;
    if (products.length === 1) rawOffers = products[0].offers;
    else {
      const directOffers: Record<string, unknown>[] = [];
      collectTyped(value, "Offer", directOffers);
      collectTyped(value, "AggregateOffer", directOffers);
      if (directOffers.length !== 1) return;
      rawOffers = directOffers[0];
    }
    const offers = Array.isArray(rawOffers) ? rawOffers : [rawOffers];
    // Multiple Offer nodes can describe sibling variants or products; never turn them into a range.
    if (offers.length !== 1) return;
    const offer = object(offers[0]);
    if (!offer || (!typed(offer, "Offer") && !typed(offer, "AggregateOffer")))
      return;
    const observed = structuredCommercial(offer, `${locator}:offers:0`);
    if (observed) result.commercials.push(observed);
  }
  $('script[type="application/ld+json"]').each((index, element) => {
    try {
      const structured = JSON.parse($(element).text()) as unknown;
      visit(structured, `jsonld:${index}`, 0);
      addStructuredCommercial(structured, `jsonld:${index}`);
    } catch {
      if (!result.limitations.includes("MALFORMED_STRUCTURED_SOURCE"))
        result.limitations.push("MALFORMED_STRUCTURED_SOURCE");
    }
  });
  $("address").each((index, element) => {
    const node = $(element);
    const text = clean(node.text());
    if (
      hidden(node) ||
      !text ||
      text.length > 600 ||
      result.locations.length >= 24
    )
      return;
    result.locations.push({
      locator: `address:${index}`,
      statement: text,
      name: null,
      streetAddress: text,
      city: null,
      region: null,
      postalCode: null,
      country: null,
      latitude: null,
      longitude: null,
      telephone: textValue(node.find('a[href^="tel:"]').text()),
      email: textValue(node.find('a[href^="mailto:"]').text()),
      sourceIdentifier: null,
    });
  });
  return ownedSiteObservationFragmentSchema.parse(result);
}

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

/** Provider-neutral bounded source descriptors, never computed styles or canonical state. */
export const ownedSiteObservationFragmentSchema = z
  .object({
    version: z.literal("owned-site-observations/1.0"),
    statements: z.array(statement).max(80),
    visuals: z.array(visual).max(32),
    locations: z.array(location).max(24),
    limitations: z.array(z.string().max(80)).max(12),
  })
  .strict();
export type OwnedSiteObservationFragment = z.infer<
  typeof ownedSiteObservationFragmentSchema
>;
export type ObservedStatement = z.infer<typeof statement>;
export type ObservedLocation = z.infer<typeof location>;

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
  $('script[type="application/ld+json"]').each((index, element) => {
    try {
      visit(JSON.parse($(element).text()) as unknown, `jsonld:${index}`, 0);
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

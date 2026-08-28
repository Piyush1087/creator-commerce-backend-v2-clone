import type {
  DataExtractionEvidenceNormalizer,
  DataExtractionNormalizationInput,
} from "../owned-website-wave1-normalizers";
import {
  serviceabilityEvidenceSchema,
  type geographyAssertionSchema,
} from "./wave2-evidence-contracts";
import {
  commonPayload,
  draftFor,
  polarity,
  repeated,
  statementsFor,
} from "./wave2-normalization-helpers";
import type { z } from "zod";

type Geography = z.infer<typeof geographyAssertionSchema>;
const countries: readonly [RegExp, string][] = [
  [/\bIndia\b/i, "IN"],
  [/\bUnited States|\bUSA\b/i, "US"],
  [/\bUnited Kingdom|\bUK\b/i, "GB"],
  [/\bCanada\b/i, "CA"],
  [/\bAustralia\b/i, "AU"],
];
const exclusion =
  /\b(?:not|no|never|cannot|can't|don't|doesn't|isn't|aren't|except|excluding|excludes?|unsupported)\b/i;
function excludedBefore(text: string, index: number): boolean {
  const clause =
    text
      .slice(0, index)
      .split(/\bbut\b|[.!;]/i)
      .pop() ?? "";
  return exclusion.test(clause);
}
function geography(text: string): Geography[] {
  const excluded = exclusion.test(text);
  const base = {
    polarity: excluded ? ("EXCLUDED" as const) : ("SUPPORTED" as const),
    country_code: null,
    region: null,
    locality: null,
    radius_km: null,
  };
  const assertions: Geography[] = [];
  if (
    /\b(?:worldwide|globally|global availability|international(?:ly)?)\b/i.test(
      text,
    )
  ) {
    // "International" does not mean every country.
    const global = /\b(?:worldwide|globally|global availability)\b/i.exec(text);
    if (global)
      assertions.push({
        ...base,
        polarity: excludedBefore(text, global.index) ? "EXCLUDED" : "SUPPORTED",
        scope: "GLOBAL",
      });
  }
  for (const [pattern, code] of countries) {
    const found = pattern.exec(text);
    if (!found) continue;
    assertions.push({
      ...base,
      polarity: excludedBefore(text, found.index) ? "EXCLUDED" : "SUPPORTED",
      scope: "COUNTRY",
      country_code: code,
    });
  }
  if (!assertions.length && /\bnationwide\b/i.test(text))
    assertions.push({ ...base, scope: "COUNTRY" });
  const radius = /\b(\d+(?:\.\d+)?)\s*(?:km|kilomet(?:er|re)s?)\b/i.exec(text);
  if (radius)
    assertions.push({ ...base, scope: "LOCAL", radius_km: Number(radius[1]) });
  if (!assertions.length) {
    const place =
      /\b(?:in|to|across|within|serves?|serving)\s+(?:only\s+)?([A-Z][\p{L} .-]{1,80})(?=[.!;]|$)/u.exec(
        text,
      );
    if (place)
      assertions.push({
        ...base,
        scope: /\bstates?|regions?\b/i.test(text) ? "REGIONAL" : "LOCAL",
        locality: /\bstates?|regions?\b/i.test(text) ? null : place[1].trim(),
        region: /\bstates?|regions?\b/i.test(text) ? place[1].trim() : null,
      });
  }
  return assertions.slice(0, 8);
}

export class ServiceabilityEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.serviceability_evidence" as const;
  normalize(input: DataExtractionNormalizationInput) {
    const drafts = input.sources.flatMap((source) =>
      statementsFor(source)
        .flatMap((unit) => {
          const text = unit.text;
          if (unit.authorship === "TESTIMONIAL") return [];
          const shipping =
            /\b(?:ships?|shipping|deliver(?:s|y|ies)?|delivery|shipments?)\b/i.test(
              text,
            );
          const remote =
            /\b(?:online.only|digital (?:product|service)|remote (?:service|consultation)|virtual (?:service|consultation))\b/i.test(
              text,
            );
          const booking = /\b(?:bookings?|appointments?)\b/i.test(text);
          const physical =
            /\b(?:in.person only|service radius|service area|we serve|we service|serves? (?:customers|clients)|services? (?:available|in))\b/i.test(
              text,
            );
          const availability =
            /\b(?:available|availability|unsupported|not supported)\b/i.test(
              text,
            );
          const geographic =
            /\b(?:nationwide|worldwide|globally|international|states?|regions?|cities|radius|within|across|in|to|only|exclud|except)\b/i.test(
              text,
            );
          if (
            !(
              (shipping || physical || booking || availability) &&
              geographic
            ) &&
            !remote
          )
            return [];
          if (
            /\b(?:website|site|webpage)\b.{0,30}\b(?:accessible|reachable|available)\b/i.test(
              text,
            ) &&
            !shipping &&
            !physical &&
            !remote
          )
            return [];
          const observedPolarity = polarity(text);
          const modality = shipping
            ? "SHIPPING_DELIVERY"
            : remote
              ? "DIGITAL_REMOTE"
              : booking
                ? "BOOKING_SERVICE"
                : physical
                  ? "PHYSICAL_LOCATION"
                  : "TRANSACTIONAL";
          const type =
            observedPolarity === "EXPLICIT_NEGATIVE"
              ? "EXPLICIT_UNSUPPORTED_GEOGRAPHY"
              : observedPolarity === "RESTRICTION"
                ? "GEOGRAPHY_RESTRICTION"
                : shipping
                  ? "SHIPPING_DELIVERY_GEOGRAPHY"
                  : remote
                    ? "DIGITAL_REMOTE_AVAILABILITY"
                    : booking
                      ? "BOOKING_AVAILABILITY"
                      : physical
                        ? "SERVICE_AREA_STATEMENT"
                        : "GENERAL_BRAND_AVAILABILITY";
          const common = commonPayload(source, unit);
          const payload = serviceabilityEvidenceSchema.parse({
            ...common,
            evidence_semantic: "first_party_serviceability_observation",
            observation_type: type,
            coverage_modality: modality,
            geography_assertions: geography(text),
            offering_ref: null,
            offering_candidate_ref:
              common.subject_scope === "OFFERING_SPECIFIC"
                ? source.resource.resourceRef
                : null,
            statement_or_normalized_fact: text,
            evidence_strength: geographic
              ? "SPECIFIC_AVAILABILITY_STATEMENT"
              : "GENERAL_AVAILABILITY_STATEMENT",
          });
          return [
            draftFor(source, this.capabilityId, text, payload, {
              polarity: observedPolarity,
            }),
          ];
        })
        .slice(0, 24),
    );
    return {
      drafts: repeated(drafts),
      reasonCodes: drafts.length ? [] : ["NO_EXPLICIT_SERVICEABILITY_OBSERVED"],
    };
  }
}

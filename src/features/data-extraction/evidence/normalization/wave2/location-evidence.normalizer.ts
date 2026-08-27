import type {
  DataExtractionEvidenceNormalizer,
  DataExtractionNormalizationInput,
} from "../owned-website-wave1-normalizers";
import { canonicalOfferingRefForSource } from "../owned-website-wave1-normalizers";
import { locationEvidenceSchema } from "./wave2-evidence-contracts";
import {
  draftFor,
  fragmentFor,
  statementsFor,
} from "./wave2-normalization-helpers";

export class LocationEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.location_evidence" as const;
  normalize(input: DataExtractionNormalizationInput) {
    const drafts = input.sources.flatMap((source) => {
      const canonicalOfferingRef = canonicalOfferingRefForSource(input, source);
      const observations = [...fragmentFor(source).locations];
      // Unstructured observations stay unparsed; do not invent city/country from a name.
      for (const unit of statementsFor(source)) {
        if (
          unit.authorship === "TESTIMONIAL" ||
          !/\b(?:our (?:office|store|clinic|branch|headquarters)|visit (?:us|our)|located at|address:)\b/i.test(
            unit.text,
          )
        )
          continue;
        if (observations.length >= 24) break;
        observations.push({
          locator: unit.locator,
          statement: unit.text,
          name: null,
          streetAddress: null,
          city: null,
          region: null,
          postalCode: null,
          country: null,
          latitude: null,
          longitude: null,
          telephone: null,
          email: null,
          sourceIdentifier: null,
        });
      }
      return observations.map((observation) => {
        const reconciliation = input.locationReconciliations?.find(
          (entry) =>
            entry.captureRef === source.capture.captureRef &&
            entry.sourceLocator === observation.locator,
        );
        const payload = locationEvidenceSchema.parse({
          evidence_semantic: "first_party_location_observation",
          source_url: source.resource.canonicalUrl,
          source_locator: observation.locator,
          page_role: source.resource.pageRole ?? "OTHER",
          subject_scope: canonicalOfferingRef
            ? "OFFERING_SPECIFIC"
            : "CONTEXT_SPECIFIC",
          authorship: "BRAND_AUTHORED",
          observation_type:
            /\b(?:permanently closed|temporarily closed|no longer open)\b/i.test(
              observation.statement,
            )
              ? "LOCATION_STATUS_SIGNAL"
              : observation.locator.startsWith("jsonld")
                ? "LOCATION_DIRECTORY_ENTRY"
                : "PHYSICAL_ADDRESS_OR_PRESENCE",
          candidate_location_ref: null,
          canonical_location_ref: reconciliation?.canonicalLocationRef ?? null,
          geography_assertion: null,
          booking_or_access_ref: null,
          offering_ref: canonicalOfferingRef,
          statement_or_normalized_fact: observation.statement,
          observed_name: observation.name,
          street_address: observation.streetAddress,
          city: observation.city,
          region: observation.region,
          postal_code: observation.postalCode,
          country: observation.country,
          latitude: observation.latitude,
          longitude: observation.longitude,
          telephone: observation.telephone,
          email: observation.email,
          source_location_identifier: observation.sourceIdentifier,
        });
        // Locator participates in identity: duplicate-looking entries remain distinct observations.
        return draftFor(
          source,
          this.capabilityId,
          observation.statement,
          payload,
          {
            semanticIdentity: `${source.resource.resourceRef}|${observation.locator}|${observation.statement}`,
            polarity:
              payload.observation_type === "LOCATION_STATUS_SIGNAL"
                ? "EXPLICIT_NEGATIVE"
                : "NEUTRAL",
          },
        );
      });
    });
    return {
      drafts,
      reasonCodes: drafts.length ? [] : ["NO_LOCATION_OBSERVATION"],
    };
  }
}

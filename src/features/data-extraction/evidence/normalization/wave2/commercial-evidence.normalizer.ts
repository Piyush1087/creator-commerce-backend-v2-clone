import type {
  DataExtractionEvidenceNormalizer,
  DataExtractionNormalizationInput,
} from "../owned-website-wave1-normalizers";
import { canonicalOfferingRefForSource } from "../owned-website-wave1-normalizers";
import { commercialEvidenceSchema } from "./wave2-evidence-contracts";
import { draftFor, fragmentFor, repeated } from "./wave2-normalization-helpers";

function tupleIdentity(
  canonicalOfferingRef: string,
  observation: ReturnType<typeof fragmentFor>["commercials"][number],
): string {
  return JSON.stringify([
    canonicalOfferingRef,
    observation.observedPriceMode,
    observation.currentMinAmount,
    observation.currentMaxAmount,
    observation.regularReferenceMinAmount,
    observation.regularReferenceMaxAmount,
    observation.currency,
    observation.relationship,
    observation.explicitNotPubliclyListed,
  ]);
}

export class CommercialEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.offering_commercial_evidence" as const;

  normalize(input: DataExtractionNormalizationInput) {
    const drafts = input.sources.flatMap((source) => {
      const canonicalOfferingRef = canonicalOfferingRefForSource(input, source);
      if (
        !canonicalOfferingRef ||
        source.resource.pageRole !== "OFFERING_DETAIL" ||
        !source.capture.capturedAt
      )
        return [];
      return fragmentFor(source)
        .commercials.slice(0, 24)
        .map((observation) => {
          const payload = commercialEvidenceSchema.parse({
            source_url: source.resource.canonicalUrl,
            source_locator: observation.locator,
            page_role: source.resource.pageRole,
            subject_scope: "OFFERING_SPECIFIC",
            authorship: "BRAND_AUTHORED",
            evidence_semantic: "exact_offering_commercial_observation",
            canonical_offering_ref: canonicalOfferingRef,
            observed_price_mode: observation.observedPriceMode,
            current_min_amount: observation.currentMinAmount,
            current_max_amount: observation.currentMaxAmount,
            regular_reference_min_amount: observation.regularReferenceMinAmount,
            regular_reference_max_amount: observation.regularReferenceMaxAmount,
            currency: observation.currency,
            sale_or_reference_relationship: observation.relationship,
            explicit_not_publicly_listed: observation.explicitNotPubliclyListed,
            observed_at: source.capture.capturedAt,
            commercial_context: observation.context,
            observation_source: observation.sourceKind,
          });
          return draftFor(
            source,
            this.capabilityId,
            observation.context,
            payload,
            {
              semanticIdentity: tupleIdentity(
                canonicalOfferingRef,
                observation,
              ),
              conflictFamily: `commercial:${canonicalOfferingRef}`,
            },
          );
        });
    });
    return {
      drafts: repeated(drafts),
      reasonCodes: drafts.length
        ? []
        : ["NO_EXPLICIT_EXACT_OFFERING_COMMERCIAL_OBSERVATION"],
    };
  }
}

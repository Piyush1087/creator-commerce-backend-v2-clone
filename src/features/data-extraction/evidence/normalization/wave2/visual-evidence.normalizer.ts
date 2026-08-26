import type {
  DataExtractionEvidenceNormalizer,
  DataExtractionNormalizationInput,
} from "../owned-website-wave1-normalizers";
import { visualEvidenceSchema } from "./wave2-evidence-contracts";
import { draftFor, fragmentFor, repeated } from "./wave2-normalization-helpers";

export class VisualEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.visual_evidence" as const;
  normalize(input: DataExtractionNormalizationInput) {
    const drafts = input.sources.flatMap((source) => {
      const fragment = fragmentFor(source);
      return fragment.visuals.map((observation) => {
        const payload = visualEvidenceSchema.parse({
          source_url: source.resource.canonicalUrl,
          source_locator: observation.locator,
          page_role: source.resource.pageRole ?? "OTHER",
          subject_scope:
            observation.siteLevelDeclaration &&
            source.resource.pageRole === "HOMEPAGE"
              ? "BRAND_LEVEL"
              : "CONTEXT_SPECIFIC",
          authorship: "BRAND_AUTHORED",
          evidence_semantic: observation.semantic,
          observed_property: observation.property,
          observed_value: observation.value,
          matched_element_count: observation.matchedElements,
          observation_basis: "RETAINED_DOM_DECLARATION",
          computed_or_rendered: false,
          canonical_asset_ref: null,
          limitations: fragment.limitations,
        });
        const semantic = `${observation.semantic}:${observation.property}:${observation.value}`;
        return draftFor(source, this.capabilityId, semantic, payload, {
          semanticIdentity: semantic,
        });
      });
    });
    return {
      drafts: repeated(drafts),
      reasonCodes: [
        "BOUNDED_DOM_VISUAL_OBSERVATIONS_ONLY",
        ...(drafts.length ? [] : ["NO_USABLE_VISUAL_OBSERVATION"]),
      ],
    };
  }
}

import { visualEvidenceSchema } from "../../../data-extraction/evidence/normalization/wave2/wave2-evidence-contracts";
import type { EvidenceManifestEntry } from "../../contracts/validation/validation.types";
import type { NormalizedEvidenceSet } from "./intelligence-evidence.port";

/** MVP admission uses retained declarations, never computed/rendered appearance or image semantics. */
export function visualEvidenceSupport(
  item: Pick<
    EvidenceManifestEntry,
    | "capabilityId"
    | "normalizedPayload"
    | "representativeness"
    | "freshness"
    | "sourceClass"
    | "polarity"
    | "conflictGroupRef"
  >,
) {
  const parsed = visualEvidenceSchema.safeParse(item.normalizedPayload);
  if (
    !parsed.success ||
    item.capabilityId !== "owned_website.visual_evidence" ||
    item.sourceClass !== "OWNED_WEBSITE" ||
    item.freshness !== "CURRENT" ||
    item.polarity === "EXPLICIT_NEGATIVE" ||
    item.conflictGroupRef ||
    !["PERSISTENT_BRAND_LEVEL", "REPEATED_REPRESENTATIVE"].includes(
      item.representativeness ?? "",
    ) ||
    parsed.data.authorship !== "BRAND_AUTHORED" ||
    parsed.data.observed_property === "image_presence" ||
    ![
      "COLOUR_USAGE_OBSERVATION",
      "TYPOGRAPHY_OBSERVATION",
      "LAYOUT_OR_COMPOSITION_OBSERVATION",
    ].includes(parsed.data.evidence_semantic)
  )
    return undefined;
  return parsed.data;
}
export function hasRepresentativeVisualEvidence(
  evidence: NormalizedEvidenceSet,
): boolean {
  return evidence.capabilityResults.some(
    (cap) =>
      ["AVAILABLE", "PARTIAL", "DEGRADED"].includes(cap.status) &&
      cap.acquisitionQuality.state !== "UNAVAILABLE" &&
      cap.evidence.some(
        (item) =>
          item.acquisitionQuality.state !== "UNAVAILABLE" &&
          visualEvidenceSupport({
            capabilityId: cap.capabilityId,
            normalizedPayload: item.boundedNormalizedPayload,
            representativeness: item.representativeness,
            freshness: item.freshness.state,
            sourceClass: item.sourceClass,
            polarity: item.polarity,
            conflictGroupRef: item.conflictGroupRef,
          }),
      ),
  );
}

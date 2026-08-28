import {
  serviceabilityEvidenceSchema,
  locationEvidenceSchema,
} from "../../../data-extraction/evidence/normalization/wave2/wave2-evidence-contracts";
import type { EvidenceManifestEntry } from "../../contracts/validation/validation.types";
import type { NormalizedEvidenceSet } from "./intelligence-evidence.port";

export function serviceabilityEvidenceSupport(
  item: Pick<
    EvidenceManifestEntry,
    | "capabilityId"
    | "normalizedPayload"
    | "freshness"
    | "sourceClass"
    | "polarity"
  >,
) {
  const parsed = serviceabilityEvidenceSchema.safeParse(item.normalizedPayload);
  if (
    !parsed.success ||
    item.capabilityId !== "owned_website.serviceability_evidence" ||
    item.sourceClass !== "OWNED_WEBSITE" ||
    item.freshness !== "CURRENT" ||
    parsed.data.authorship !== "BRAND_AUTHORED" ||
    item.polarity === "EXPLICIT_NEGATIVE" ||
    ![
      "SHIPPING_DELIVERY_GEOGRAPHY",
      "SERVICE_AREA_STATEMENT",
      "DIGITAL_REMOTE_AVAILABILITY",
      "BOOKING_AVAILABILITY",
      "TRANSACTION_AVAILABILITY",
      "GENERAL_BRAND_AVAILABILITY",
    ].includes(parsed.data.observation_type) ||
    !parsed.data.geography_assertions.some(
      (assertion) => assertion.polarity === "SUPPORTED",
    )
  )
    return undefined;
  return parsed.data;
}

export function serviceabilityLocationSupport(
  item: Pick<
    EvidenceManifestEntry,
    "capabilityId" | "normalizedPayload" | "freshness" | "sourceClass"
  >,
) {
  const parsed = locationEvidenceSchema.safeParse(item.normalizedPayload);
  if (
    !parsed.success ||
    item.capabilityId !== "owned_website.location_evidence" ||
    item.sourceClass !== "OWNED_WEBSITE" ||
    item.freshness !== "CURRENT" ||
    parsed.data.authorship !== "BRAND_AUTHORED"
  )
    return undefined;
  return parsed.data;
}

/** Both durable lineages are checked separately; admission needs positive current availability. */
export function hasDefensibleServiceabilityEvidence(
  evidence: NormalizedEvidenceSet,
): boolean {
  return evidence.capabilityResults.some(
    (cap) =>
      ["AVAILABLE", "PARTIAL", "DEGRADED"].includes(cap.status) &&
      cap.acquisitionQuality.state !== "UNAVAILABLE" &&
      cap.evidence.some(
        (item) =>
          item.acquisitionQuality.state !== "UNAVAILABLE" &&
          serviceabilityEvidenceSupport({
            capabilityId: cap.capabilityId,
            normalizedPayload: item.boundedNormalizedPayload,
            freshness: item.freshness.state,
            sourceClass: item.sourceClass,
            polarity: item.polarity,
          }),
      ),
  );
}

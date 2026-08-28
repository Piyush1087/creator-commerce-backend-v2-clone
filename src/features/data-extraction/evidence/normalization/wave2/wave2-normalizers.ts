import type {
  DataExtractionEvidenceNormalizer,
  NormalizedEvidenceDraft,
} from "../owned-website-wave1-normalizers";
import { LocationEvidenceNormalizer } from "./location-evidence.normalizer";
import { CommercialEvidenceNormalizer } from "./commercial-evidence.normalizer";
import { ProofEvidenceNormalizer } from "./proof-evidence.normalizer";
import { ServiceabilityEvidenceNormalizer } from "./serviceability-evidence.normalizer";
import { VisualEvidenceNormalizer } from "./visual-evidence.normalizer";
import {
  commercialEvidenceSchema,
  serviceabilityEvidenceSchema,
} from "./wave2-evidence-contracts";

export const WAVE2_NORMALIZERS: readonly DataExtractionEvidenceNormalizer[] = [
  new ProofEvidenceNormalizer(),
  new VisualEvidenceNormalizer(),
  new ServiceabilityEvidenceNormalizer(),
  new LocationEvidenceNormalizer(),
  new CommercialEvidenceNormalizer(),
];

export function wave2Conflict(
  left: NormalizedEvidenceDraft,
  right: NormalizedEvidenceDraft,
): boolean {
  if (left.semanticObservationKey === right.semanticObservationKey)
    return false;
  if (
    left.boundedNormalizedPayload.evidence_semantic ===
      "proof_or_claim_observation" &&
    right.boundedNormalizedPayload.evidence_semantic ===
      "proof_or_claim_observation" &&
    left.conflictFamily &&
    left.conflictFamily === right.conflictFamily
  )
    return true;
  const commercialA = commercialEvidenceSchema.safeParse(
    left.boundedNormalizedPayload,
  );
  const commercialB = commercialEvidenceSchema.safeParse(
    right.boundedNormalizedPayload,
  );
  if (commercialA.success || commercialB.success) {
    return (
      commercialA.success &&
      commercialB.success &&
      commercialA.data.canonical_offering_ref ===
        commercialB.data.canonical_offering_ref &&
      left.conflictFamily !== undefined &&
      left.conflictFamily === right.conflictFamily
    );
  }
  const a = serviceabilityEvidenceSchema.safeParse(
    left.boundedNormalizedPayload,
  );
  const b = serviceabilityEvidenceSchema.safeParse(
    right.boundedNormalizedPayload,
  );
  if (
    !a.success ||
    !b.success ||
    a.data.subject_scope !== b.data.subject_scope ||
    a.data.coverage_modality !== b.data.coverage_modality
  )
    return false;
  if (
    a.data.subject_scope === "OFFERING_SPECIFIC" &&
    a.data.offering_candidate_ref !== b.data.offering_candidate_ref
  )
    return false;
  const opposing = a.data.geography_assertions.some((x) =>
    b.data.geography_assertions.some((y) => {
      const overlapping =
        x.scope === "GLOBAL" ||
        y.scope === "GLOBAL" ||
        (x.country_code !== null && x.country_code === y.country_code) ||
        (x.locality !== null && x.locality === y.locality) ||
        (x.region !== null && x.region === y.region);
      return x.polarity !== y.polarity && overlapping;
    }),
  );
  return (
    opposing ||
    (a.data.geography_assertions.some(
      (x) => x.scope === "GLOBAL" && x.polarity === "SUPPORTED",
    ) &&
      right.polarity === "RESTRICTION") ||
    (b.data.geography_assertions.some(
      (x) => x.scope === "GLOBAL" && x.polarity === "SUPPORTED",
    ) &&
      left.polarity === "RESTRICTION")
  );
}

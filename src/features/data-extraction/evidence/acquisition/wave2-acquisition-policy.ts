import type { Wave2EvidenceCapabilityId } from "../domain/evidence-vocabulary";
import {
  ownedSiteObservationFragmentSchema,
  retainOwnedSiteObservations,
} from "./owned-site-observation-fragment";
import type { DataExtractionContentArtifactRecord } from "../domain/evidence-records";

export function wave2PageScore(
  capability: Wave2EvidenceCapabilityId,
  url: string,
): number {
  const path = new URL(url).pathname;
  if (capability === "owned_website.location_evidence")
    return /contact|locations?|stores?|clinics?|branches|offices?/i.test(path)
      ? 5
      : /about|company/i.test(path)
        ? 1
        : 0;
  if (capability === "owned_website.serviceability_evidence")
    return /shipping|delivery|service.area|coverage|availability|returns|polic/i.test(
      path,
    )
      ? 5
      : /services?|products?|contact/i.test(path)
        ? 1
        : 0;
  if (capability === "explicit_factual_proof_or_claim_evidence")
    return /about|company|credential|accredit|certif|compliance/i.test(path)
      ? 5
      : /products?|services?|pricing|plans|portfolio/i.test(path)
        ? 2
        : 0;
  return /about|company|products?|services?|portfolio/i.test(path) ? 2 : 0;
}

/** Selection hint only. Semantic classification/completion remains in normalization. */
export function retainedMaterialForWave2(
  capability: Wave2EvidenceCapabilityId,
  artifacts: readonly DataExtractionContentArtifactRecord[],
): boolean {
  const retained = artifacts.find(
    (a) =>
      a.artifactKind === "STRUCTURED_SOURCE_FRAGMENT" &&
      a.normalizationContractVersion === "owned-site-observations/1.0",
  );
  let fragment = retainOwnedSiteObservations(
    artifacts.find((a) => a.artifactKind === "ACQUIRED_SOURCE_BODY")
      ?.inlineContent ?? "",
  );
  if (retained?.inlineContent) {
    try {
      fragment = ownedSiteObservationFragmentSchema.parse(
        JSON.parse(retained.inlineContent) as unknown,
      );
    } catch {
      /* Older/incompatible fragment cannot establish coverage. */
    }
  }
  const text =
    fragment.statements.map((s) => s.text).join("\n") ||
    artifacts.find((a) => a.artifactKind === "NORMALIZED_TEXT")
      ?.inlineContent ||
    "";
  if (capability === "owned_website.visual_evidence")
    return fragment.visuals.length > 0;
  if (capability === "owned_website.location_evidence")
    return (
      fragment.locations.length > 0 ||
      /our (?:office|store|clinic)|located at|address:/i.test(text)
    );
  if (capability === "owned_website.serviceability_evidence")
    return /\b(?:shipping|ships?|delivery|service area|nationwide|online.only|available in)\b/i.test(
      text,
    );
  return /\b(?:founded|established|certified|accredited|leading|best|clinical|guaranteed|proven|we operate)\b/i.test(
    text,
  );
}

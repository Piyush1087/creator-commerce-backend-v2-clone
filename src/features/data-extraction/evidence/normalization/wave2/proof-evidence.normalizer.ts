import type {
  DataExtractionEvidenceNormalizer,
  DataExtractionNormalizationInput,
} from "../owned-website-wave1-normalizers";
import { canonicalOfferingRefForSource } from "../owned-website-wave1-normalizers";
import { proofEvidenceSchema } from "./wave2-evidence-contracts";
import {
  commonPayload,
  draftFor,
  polarity,
  repeated,
  statementsFor,
} from "./wave2-normalization-helpers";

type Sensitivity = ReturnType<
  typeof proofEvidenceSchema.parse
>["claim_sensitivity"][number];
export class ProofEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "explicit_factual_proof_or_claim_evidence" as const;
  normalize(input: DataExtractionNormalizationInput) {
    const drafts = input.sources.flatMap((source) =>
      statementsFor(source)
        .flatMap((unit) => {
          const text = unit.text;
          const sensitivity: Sensitivity[] = [];
          if (
            /\b(?:cur[ei]|cures|treats?|treatment|efficacy|effective against|reliev[ei]|heals?)\b/i.test(
              text,
            )
          )
            sensitivity.push("TREATMENT_EFFICACY");
          if (/diagnos(?:tic|is|e)|accuracy/i.test(text))
            sensitivity.push("DIAGNOSTIC_ACCURACY");
          if (
            /clinical(?:ly)? (?:superior|proven)|best (?:clinic|treatment)/i.test(
              text,
            )
          )
            sensitivity.push("CLINICAL_SUPERIORITY");
          if (/guarantee|100%|guaranteed/i.test(text))
            sensitivity.push("GUARANTEED_OUTCOME_LANGUAGE");
          if (/success rate|survival rate/i.test(text))
            sensitivity.push("MEDICAL_SUCCESS_RATE");
          if (/\b(?:safe|safety|risk.free|side.effects?)\b/i.test(text))
            sensitivity.push("SAFETY_CLAIM");
          const clinical = sensitivity.length > 0;
          const credential =
            /\b(?:certified|accredited|licen[cs]ed|certification|credential|approved by|FDA|ISO\s*\d|registered)\b/i.test(
              text,
            );
          const assertion =
            /\b(?:best|leading|trusted|innovative|unique|unmatched|superior|world.class|award.winning|number one|#1|fastest)\b/i.test(
              text,
            );
          const factual =
            /\b(?:founded|established|incorporated|headquartered|we (?:operate|own|manufacture|employ)|our (?:team|company|factory)|since \d{4}|\d+ (?:years|employees|offices|stores|clinics))\b/i.test(
              text,
            );
          const external =
            /\b(?:proven|award|ranked|independent(?:ly)?|verified|patented|\d+%|\d+x)\b/i.test(
              text,
            );
          if (
            !clinical &&
            !credential &&
            !assertion &&
            !factual &&
            !external &&
            unit.authorship !== "TESTIMONIAL"
          )
            return [];
          const testimonial =
            unit.authorship === "TESTIMONIAL" ||
            source.resource.pageRole === "TESTIMONIAL";
          if (testimonial) sensitivity.push("TESTIMONIAL");
          if (credential)
            sensitivity.push(
              /clinical|medical|doctor|physician/i.test(text)
                ? "CLINICAL_CREDENTIAL"
                : "REGULATORY_STATEMENT",
            );
          let proofStrength: ReturnType<
            typeof proofEvidenceSchema.parse
          >["proof_strength"];
          let proofClass: ReturnType<
            typeof proofEvidenceSchema.parse
          >["proof_class"];
          if (testimonial) {
            proofStrength = "TESTIMONIAL_OR_SOCIAL_PROOF";
            proofClass = "OTHER_BOUNDED_PROOF_CONTEXT";
          } else if (clinical || external) {
            proofStrength = "FIRST_PARTY_CLAIM";
            proofClass = "CLAIM_REQUIRING_EXTERNAL_VERIFICATION";
          } else if (credential) {
            proofStrength = "EXPLICIT_CERTIFICATION_OR_CREDENTIAL";
            proofClass = "REGULATORY_OR_CREDENTIAL_STATEMENT";
          } else if (assertion) {
            proofStrength = "GENERIC_MARKETING_ASSERTION";
            proofClass = "BRAND_AUTHORED_ASSERTION";
          } else if (factual && unit.authorship === "BRAND_AUTHORED") {
            proofStrength = "DIRECT_FIRST_PARTY_FACT";
            proofClass = "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT";
          } else {
            proofStrength = "FIRST_PARTY_CLAIM";
            proofClass = "CLAIM_REQUIRING_EXTERNAL_VERIFICATION";
          }
          if (proofStrength === "FIRST_PARTY_CLAIM" || assertion)
            sensitivity.push("BRAND_AUTHORED_CLAIM");
          const common = commonPayload(source, unit);
          const canonicalOfferingRef = canonicalOfferingRefForSource(
            input,
            source,
          );
          const payload = proofEvidenceSchema.parse({
            ...common,
            authorship: testimonial ? "TESTIMONIAL" : common.authorship,
            evidence_semantic: "proof_or_claim_observation",
            statement: text,
            proof_strength: proofStrength,
            proof_class: proofClass,
            scope: common.subject_scope,
            factual_referent_ref: canonicalOfferingRef,
            offering_refs: canonicalOfferingRef ? [canonicalOfferingRef] : [],
            claim_sensitivity: [...new Set(sensitivity)],
            verification_status: "NOT_EXTERNALLY_VERIFIED",
          });
          // Date/value differences remain conflict candidates, never a winning fact.
          const family = /\b(?:founded|established|incorporated)\b/i.test(text)
            ? `${common.subject_scope}:foundation:${text.toLowerCase().replace(/\d{4}/g, "YEAR")}`
            : undefined;
          return [
            draftFor(source, this.capabilityId, text, payload, {
              polarity: polarity(text),
              conflictFamily: family,
            }),
          ];
        })
        .slice(0, 24),
    );
    return {
      drafts: repeated(drafts),
      reasonCodes: drafts.length ? [] : ["NO_MATCHING_PROOF_OR_CLAIM_OBSERVED"],
    };
  }
}

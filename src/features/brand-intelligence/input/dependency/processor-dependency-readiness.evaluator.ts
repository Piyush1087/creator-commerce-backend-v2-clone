import { Injectable } from "@nestjs/common";
import { hasRepresentativeVisualEvidence } from "../evidence/visual-evidence-admission";
import { hasDefensibleServiceabilityEvidence } from "../evidence/serviceability-evidence-admission";

import type { CanonicalBrandStateSnapshot } from "../canonical-state/canonical-brand-state.port";
import type { NormalizedEvidenceSet } from "../evidence/intelligence-evidence.port";
import type { ProcessorDependencyProfile } from "./processor-dependency-profile.registry";

export type ProcessorDependencyReadiness =
  | "READY_TO_RUN"
  | "WAITING_FOR_CANONICAL_INPUT"
  | "WAITING_FOR_EVIDENCE"
  | "BLOCKED_BY_CONFLICT";

export interface ProcessorDependencyReadinessAssessment {
  readonly readiness: ProcessorDependencyReadiness;
  readonly reasonCodes: readonly string[];
}

const REPRESENTATIVE = new Set([
  "PERSISTENT_BRAND_LEVEL",
  "REPEATED_REPRESENTATIVE",
]);

@Injectable()
export class ProcessorDependencyReadinessEvaluator {
  evaluate(
    profile: ProcessorDependencyProfile,
    canonical: CanonicalBrandStateSnapshot,
    evidence: NormalizedEvidenceSet,
  ): ProcessorDependencyReadinessAssessment {
    const entries = new Map(
      canonical.entries.map((entry) => [entry.semantic, entry]),
    );
    const missingEntries = profile.requiredCanonicalSemantics.filter(
      (semantic) => !entries.has(semantic),
    );
    const missingAnchors = profile.nonNullableCanonicalAnchors.filter(
      (semantic) => entries.get(semantic)?.value == null,
    );
    if (missingEntries.length || missingAnchors.length) {
      return {
        readiness: "WAITING_FOR_CANONICAL_INPUT",
        reasonCodes: [
          ...missingEntries.map((semantic) => `MISSING_ENTRY:${semantic}`),
          ...missingAnchors.map((semantic) => `NULL_ANCHOR:${semantic}`),
        ].sort(),
      };
    }

    const blockingConflicts = profile.blockingConflictSemantics.filter(
      (semantic) => entries.get(semantic)?.conflictDetected,
    );
    if (blockingConflicts.length) {
      return {
        readiness: "BLOCKED_BY_CONFLICT",
        reasonCodes: blockingConflicts
          .map((semantic) => `BLOCKING_CONFLICT:${semantic}`)
          .sort(),
      };
    }

    if (
      profile.processorId === "offering_factual_synthesis" ||
      profile.processorId === "offering_creator_communication" ||
      profile.processorId === "offering_actionability_synthesis"
    ) {
      const offering = canonical.offeringFacts;
      const exactRef = evidence.canonicalOfferingRef;
      if (
        !exactRef ||
        offering?.length !== 1 ||
        offering[0].offeringId !== exactRef ||
        offering[0].brandId !== canonical.brandId
      ) {
        return {
          readiness: "WAITING_FOR_CANONICAL_INPUT",
          reasonCodes: ["EXACT_CANONICAL_OFFERING_NOT_AVAILABLE"],
        };
      }
      if (profile.processorId !== "offering_factual_synthesis") {
        return { readiness: "READY_TO_RUN", reasonCodes: [] };
      }
      const context = evidence.capabilityResults.find(
        (item) => item.capabilityId === "owned_website.offering_context",
      );
      const usable = context?.evidence.some((item) => {
        const payload =
          item.boundedNormalizedPayload &&
          typeof item.boundedNormalizedPayload === "object" &&
          !Array.isArray(item.boundedNormalizedPayload)
            ? (item.boundedNormalizedPayload as Readonly<
                Record<string, unknown>
              >)
            : undefined;
        return (
          item.brandId === canonical.brandId &&
          item.representativeness === "OFFERING_SPECIFIC" &&
          item.acquisitionQuality.state !== "UNAVAILABLE" &&
          item.freshness.state !== "UNKNOWN" &&
          payload?.generalization_scope === "SINGLE_OFFERING" &&
          payload.canonical_offering_ref === exactRef &&
          Object.keys(payload).length > 2
        );
      });
      return usable
        ? { readiness: "READY_TO_RUN", reasonCodes: [] }
        : {
            readiness: "WAITING_FOR_EVIDENCE",
            reasonCodes: ["EXACT_OFFERING_CONTEXT_NOT_AVAILABLE"],
          };
    }

    if (profile.processorId === "visual_style_synthesis") {
      return hasRepresentativeVisualEvidence(evidence)
        ? { readiness: "READY_TO_RUN", reasonCodes: [] }
        : {
            readiness: "WAITING_FOR_EVIDENCE",
            reasonCodes: ["REPRESENTATIVE_VISUAL_DECLARATIONS_NOT_AVAILABLE"],
          };
    }
    if (profile.requiredCapabilityLineages) {
      const missing = profile.requiredCapabilityLineages.filter(
        (id) =>
          !evidence.capabilityResults.some(
            (cap) =>
              cap.capabilityId === id &&
              ["AVAILABLE", "PARTIAL", "DEGRADED"].includes(cap.status) &&
              cap.acquisitionQuality.state !== "UNAVAILABLE" &&
              !!cap.capabilityExecutionRef,
          ),
      );
      if (missing.length)
        return {
          readiness: "WAITING_FOR_EVIDENCE",
          reasonCodes: missing
            .map((id) => `MISSING_CAPABILITY_LINEAGE:${id}`)
            .sort(),
        };
      if (
        profile.processorId === "serviceability_synthesis" &&
        !hasDefensibleServiceabilityEvidence(evidence)
      )
        return {
          readiness: "WAITING_FOR_EVIDENCE",
          reasonCodes: ["DEFENSIBLE_SERVICEABILITY_EVIDENCE_NOT_AVAILABLE"],
        };
      return { readiness: "READY_TO_RUN", reasonCodes: [] };
    }
    const representative = evidence.capabilityResults.some(
      (capability) =>
        profile.representativeEvidenceAnyOf.includes(capability.capabilityId) &&
        capability.status !== "UNAVAILABLE" &&
        capability.status !== "NOT_REQUESTED" &&
        capability.evidence.some(
          (item) =>
            item.acquisitionQuality.state !== "UNAVAILABLE" &&
            REPRESENTATIVE.has(item.representativeness),
        ),
    );
    if (!representative) {
      return {
        readiness: "WAITING_FOR_EVIDENCE",
        reasonCodes: ["REPRESENTATIVE_EVIDENCE_NOT_AVAILABLE"],
      };
    }
    return { readiness: "READY_TO_RUN", reasonCodes: [] };
  }
}

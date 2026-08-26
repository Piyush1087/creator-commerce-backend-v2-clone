import { Injectable } from "@nestjs/common";

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
      return missing.length
        ? {
            readiness: "WAITING_FOR_EVIDENCE",
            reasonCodes: missing
              .map((id) => `MISSING_CAPABILITY_LINEAGE:${id}`)
              .sort(),
          }
        : { readiness: "READY_TO_RUN", reasonCodes: [] };
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

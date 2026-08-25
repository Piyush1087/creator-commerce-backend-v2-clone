import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  asCapabilityExecutionRef,
  type BrandId,
  type SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionSemanticObservationRecord,
} from "../domain/evidence-records";
import {
  WAVE1_EVIDENCE_CAPABILITIES,
  type EvidenceCapabilityId,
} from "../domain/evidence-vocabulary";
import { persistenceError } from "../persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import type {
  DataExtractionCapabilityReadResultV1,
  DataExtractionEvidenceQueryPortV1,
  DataExtractionEvidenceQueryRequestV1,
  DataExtractionEvidenceQueryResultV1,
} from "../ports/evidence-runtime.ports";

const MISSING_RESULT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

@Injectable()
export class DataExtractionEvidenceQueryService implements DataExtractionEvidenceQueryPortV1 {
  constructor(private readonly persistence: DataExtractionPersistenceService) {}

  async readExisting(
    request: DataExtractionEvidenceQueryRequestV1,
  ): Promise<DataExtractionEvidenceQueryResultV1> {
    this.assertRequest(request);
    const capabilityIds = [...new Set(request.capabilityIds)];
    const capabilityResults: DataExtractionCapabilityReadResultV1[] = [];
    for (const capabilityId of capabilityIds) {
      capabilityResults.push(
        await this.readCapability(request.brandId, capabilityId),
      );
    }
    return { brandId: request.brandId, capabilityResults };
  }

  private async readCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
  ): Promise<DataExtractionCapabilityReadResultV1> {
    const repositories = this.persistence.repositories();
    const execution =
      await repositories.capabilityExecutions.findLatestCompleted(
        brandId,
        capabilityId,
      );
    if (!execution) {
      return {
        capabilityExecution: missingCapabilityExecution(brandId, capabilityId),
        evidence: [],
      };
    }

    const evidence = await Promise.all(
      execution.evidenceRefs.map((evidenceRef) =>
        repositories.evidenceItems.findByRef(brandId, evidenceRef),
      ),
    );
    if (
      evidence.some(
        (item) =>
          !item ||
          item.brandId !== brandId ||
          item.capabilityId !== capabilityId,
      )
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }

    const conflictGroups = conflictGroupRefs(
      brandId,
      capabilityId,
      await repositories.semanticObservations.findByCapability(
        brandId,
        capabilityId,
      ),
    );
    return {
      capabilityExecution: execution,
      evidence: (evidence as DataExtractionEvidenceItemRecord[])
        .map((item) => {
          const conflictGroupRef = item.semanticObservationKey
            ? conflictGroups.get(item.semanticObservationKey)
            : undefined;
          return conflictGroupRef ? { ...item, conflictGroupRef } : item;
        })
        .sort(compareEvidence),
    };
  }

  private assertRequest(request: DataExtractionEvidenceQueryRequestV1): void {
    if (!request.brandId || request.capabilityIds.length === 0) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
    if (
      request.capabilityIds.some(
        (capabilityId) => !WAVE1_EVIDENCE_CAPABILITIES.includes(capabilityId),
      )
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  }
}

function missingCapabilityExecution(
  brandId: BrandId,
  capabilityId: EvidenceCapabilityId,
): DataExtractionCapabilityExecutionRecord {
  const refHash = hash(`${brandId}|${capabilityId}`).slice(0, 32);
  return {
    brandId,
    capabilityExecutionRef: asCapabilityExecutionRef(
      `capability-execution:not-requested:${refHash}`,
    ),
    capabilityId,
    resourceScope: [],
    freshnessIntent: "REUSE_ALLOWED",
    normalizationContractVersion: "1.0",
    availability: "NOT_REQUESTED",
    retryability: "NOT_APPLICABLE",
    reasonCodes: ["NO_COMPLETED_SEMANTIC_EXECUTION"],
    coverage: "SINGLE_RESOURCE",
    acquisitionQuality: {
      state: "UNAVAILABLE",
      failureCategories: [],
      detailCodes: ["NOT_REQUESTED"],
    },
    evidenceRefs: [],
    createdAt: MISSING_RESULT_TIMESTAMP,
  };
}

function conflictGroupRefs(
  brandId: BrandId,
  capabilityId: EvidenceCapabilityId,
  observations: readonly DataExtractionSemanticObservationRecord[],
): ReadonlyMap<SemanticObservationKey, string> {
  const graph = new Map<SemanticObservationKey, Set<SemanticObservationKey>>();
  for (const observation of observations) {
    if (observation.conflictingObservationKeys.length === 0) continue;
    const adjacent = graph.get(observation.semanticObservationKey) ?? new Set();
    graph.set(observation.semanticObservationKey, adjacent);
    for (const conflict of observation.conflictingObservationKeys) {
      adjacent.add(conflict);
      const reverse = graph.get(conflict) ?? new Set();
      reverse.add(observation.semanticObservationKey);
      graph.set(conflict, reverse);
    }
  }

  const groups = new Map<SemanticObservationKey, string>();
  const visited = new Set<SemanticObservationKey>();
  for (const start of [...graph.keys()].sort()) {
    if (visited.has(start)) continue;
    const stack = [start];
    const component: SemanticObservationKey[] = [];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const adjacent of graph.get(current) ?? []) {
        if (!visited.has(adjacent)) stack.push(adjacent);
      }
    }
    component.sort();
    const groupRef = `conflict-group:${hash(
      `${brandId}|${capabilityId}|${component.join("|")}`,
    )}`;
    for (const key of component) groups.set(key, groupRef);
  }
  return groups;
}

function compareEvidence(
  left: DataExtractionEvidenceItemRecord,
  right: DataExtractionEvidenceItemRecord,
): number {
  return (
    (left.semanticObservationKey ?? "").localeCompare(
      right.semanticObservationKey ?? "",
    ) ||
    left.resourceRef.localeCompare(right.resourceRef) ||
    left.captureRef.localeCompare(right.captureRef) ||
    left.evidenceRef.localeCompare(right.evidenceRef)
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

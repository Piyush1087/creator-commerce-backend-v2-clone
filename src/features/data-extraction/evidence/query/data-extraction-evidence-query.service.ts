import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  type BrandId,
  type SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionEvidenceItemRecord,
  DataExtractionSemanticObservationRecord,
} from "../domain/evidence-records";
import {
  DATA_EXTRACTION_EVIDENCE_CAPABILITIES,
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
        state: "NOT_REQUESTED",
        capabilityId,
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
      state: "COMPLETED",
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
        (capabilityId) =>
          !DATA_EXTRACTION_EVIDENCE_CAPABILITIES.includes(capabilityId),
      )
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  }
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

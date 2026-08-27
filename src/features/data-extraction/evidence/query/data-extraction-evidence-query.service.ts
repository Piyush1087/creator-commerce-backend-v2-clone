import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  type BrandId,
  type CapabilityExecutionRef,
  type EvidenceRef,
  type SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
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
        request.exactOfferingScope
          ? await this.readExactOfferingCapability(
              request.brandId,
              capabilityId,
              request.exactOfferingScope.canonicalOfferingRef,
            )
          : await this.readCapability(request.brandId, capabilityId),
      );
    }
    return { brandId: request.brandId, capabilityResults };
  }

  private async readExactOfferingCapability(
    brandId: BrandId,
    capabilityId: EvidenceCapabilityId,
    canonicalOfferingRef: string,
  ): Promise<DataExtractionCapabilityReadResultV1> {
    const repositories = this.persistence.repositories();
    await repositories.canonicalOfferings.assertOwnedByBrand(
      brandId,
      canonicalOfferingRef,
    );
    const executions = await repositories.capabilityExecutions.findCompleted(
      brandId,
      capabilityId,
    );
    const executionRefsByEvidence = new Map<string, Set<string>>();
    const evidenceByRef = new Map<string, DataExtractionEvidenceItemRecord>();
    const qualifyingExecutions: DataExtractionCapabilityExecutionRecord[] = [];

    for (const execution of executions) {
      const qualifyingRefs: EvidenceRef[] = [];
      for (const evidenceRef of execution.evidenceRefs) {
        const item = await repositories.evidenceItems.findByRef(
          brandId,
          evidenceRef,
        );
        if (
          !item ||
          item.brandId !== brandId ||
          item.capabilityId !== capabilityId
        ) {
          throw persistenceError("PERSISTENCE_INVARIANT");
        }
        if (!isExactOfferingEvidence(item, canonicalOfferingRef)) continue;
        evidenceByRef.set(item.evidenceRef, item);
        qualifyingRefs.push(item.evidenceRef);
        const refs = executionRefsByEvidence.get(item.evidenceRef) ?? new Set();
        refs.add(execution.capabilityExecutionRef);
        executionRefsByEvidence.set(item.evidenceRef, refs);
      }
      if (qualifyingRefs.length > 0) {
        qualifyingExecutions.push({
          ...execution,
          evidenceRefs: qualifyingRefs,
        });
      }
    }

    if (qualifyingExecutions.length === 0) {
      return { state: "NOT_REQUESTED", capabilityId, evidence: [] };
    }
    const conflictGroups = conflictGroupRefs(
      brandId,
      capabilityId,
      await repositories.semanticObservations.findByCapability(
        brandId,
        capabilityId,
      ),
    );
    const evidence = [...evidenceByRef.values()]
      .map((item) => {
        const conflictGroupRef = item.semanticObservationKey
          ? conflictGroups.get(item.semanticObservationKey)
          : undefined;
        return {
          ...item,
          ...(conflictGroupRef ? { conflictGroupRef } : {}),
          capabilityExecutionRefs: [
            ...(executionRefsByEvidence.get(item.evidenceRef) ?? []),
          ].sort() as CapabilityExecutionRef[],
        };
      })
      .sort(compareEvidence);
    return {
      state: "COMPLETED",
      capabilityExecution: qualifyingExecutions[0]!,
      capabilityExecutions: qualifyingExecutions,
      evidence,
    };
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
    if (
      request.exactOfferingScope &&
      (!request.exactOfferingScope.canonicalOfferingRef?.trim() ||
        request.capabilityIds.some(
          (capabilityId) => !EXACT_OFFERING_CAPABILITIES.has(capabilityId),
        ))
    ) {
      throw persistenceError("PERSISTENCE_INVARIANT");
    }
  }
}

const EXACT_OFFERING_CAPABILITIES = new Set<EvidenceCapabilityId>([
  "owned_website.offering_context",
  "explicit_factual_proof_or_claim_evidence",
  "derived_communication_constraint_evidence",
  "owned_website.serviceability_evidence",
  "owned_website.location_evidence",
]);

function isExactOfferingEvidence(
  item: DataExtractionEvidenceItemRecord,
  canonicalOfferingRef: string,
): boolean {
  if (
    item.pageRole !== "OFFERING_DETAIL" ||
    !["OFFERING_SPECIFIC", "REPEATED_REPRESENTATIVE"].includes(
      item.representativeness,
    )
  ) {
    return false;
  }
  const payload = asRecord(item.boundedNormalizedPayload);
  switch (item.capabilityId) {
    case "owned_website.offering_context":
      return (
        payload.generalization_scope === "SINGLE_OFFERING" &&
        payload.canonical_offering_ref === canonicalOfferingRef
      );
    case "explicit_factual_proof_or_claim_evidence":
      return (
        payload.scope === "OFFERING_SPECIFIC" &&
        payload.subject_scope === "OFFERING_SPECIFIC" &&
        payload.factual_referent_ref === canonicalOfferingRef &&
        Array.isArray(payload.offering_refs) &&
        payload.offering_refs.length === 1 &&
        payload.offering_refs[0] === canonicalOfferingRef
      );
    case "derived_communication_constraint_evidence":
      return (
        payload.source_instruction_scope === "OFFERING_SPECIFIC" &&
        payload.canonical_offering_ref === canonicalOfferingRef
      );
    case "owned_website.serviceability_evidence":
    case "owned_website.location_evidence":
      return (
        payload.subject_scope === "OFFERING_SPECIFIC" &&
        payload.offering_ref === canonicalOfferingRef
      );
    default:
      return false;
  }
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
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

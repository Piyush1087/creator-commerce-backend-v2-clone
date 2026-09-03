import { Injectable } from "@nestjs/common";

import { IntelligenceCurrentContractScopeService } from "./intelligence-current-contract-scope.service";
import { IntelligenceCurrentProjectionError } from "./intelligence-current-projection.error";
import {
  IntelligenceCurrentProjectionRepository,
  type ProjectionBusinessStateReferenceRecord,
  type ProjectionComponentRecord,
  type ProjectionEvidenceReferenceRecord,
  type ProjectionRepositorySnapshot,
} from "./intelligence-current-projection.repository";
import type {
  CurrentIntelligenceComponentProjection,
  CurrentIntelligenceObjectProjection,
  IntelligenceBusinessStateReferenceSummary,
  IntelligenceCandidateSummary,
  IntelligenceComponentProjection,
  IntelligenceContractProjection,
  IntelligenceCurrentProjectionReader,
  IntelligenceEvidenceReferenceSummary,
  IntelligenceProjectionAuthority,
  IntelligenceProjectionFreshness,
  IntelligenceProjectionProtection,
  IntelligenceProjectionReadiness,
  ReadCurrentIntelligenceComponentRequest,
  ReadCurrentIntelligenceObjectRequest,
} from "./intelligence-current-projection.types";
import { IntelligenceObjectAssembler } from "./intelligence-object-assembler";

@Injectable()
export class IntelligenceCurrentProjectionService implements IntelligenceCurrentProjectionReader {
  constructor(
    private readonly repository: IntelligenceCurrentProjectionRepository,
    private readonly contracts: IntelligenceCurrentContractScopeService,
    private readonly assembler: IntelligenceObjectAssembler,
  ) {}

  async readObject(
    request: ReadCurrentIntelligenceObjectRequest,
  ): Promise<CurrentIntelligenceObjectProjection> {
    const scope = this.contracts.resolveObject(request.objectSemanticId);
    const snapshot = await this.repository.readObjectSnapshot(
      request.brandId,
      request.objectSemanticId,
      request.subject,
    );
    this.assertSnapshot(snapshot, request.brandId, request.objectSemanticId);
    for (const component of snapshot.components) {
      if (
        !this.contracts.ownsPath(
          request.brandId,
          request.objectSemanticId,
          component.componentSemanticPath,
        )
      ) {
        throw new IntelligenceCurrentProjectionError(
          "CONTRACT_CONFIGURATION_DRIFT",
          "Current state contains a path outside the verified contract scope",
          { componentSemanticPath: component.componentSemanticPath },
        );
      }
    }
    const components = snapshot.components.map((component) =>
      this.projectComponent(snapshot, component, Boolean(request.subject)),
    );
    const currentPaths = new Set(
      components.map((component) => component.componentSemanticPath),
    );
    const scopeComplete = scope.requiredMaterializedPaths.every((path) =>
      currentPaths.has(path),
    );
    const resultReadiness = aggregateReadiness(
      components.map((component) => component.readiness),
    );
    const objectState =
      components.length === 0
        ? ("NO_CURRENT" as const)
        : scopeComplete
          ? ("CURRENT" as const)
          : ("PARTIAL_CURRENT" as const);
    const consumerReadiness = deriveConsumerReadiness(
      objectState,
      resultReadiness,
    );
    const objectContracts = uniqueContracts(
      snapshot.components.map((component) => ({
        id: component.generation.objectGeneration.objectContractId,
        version: component.generation.objectGeneration.objectContractVersion,
      })),
    );
    const outputContracts = uniqueContracts(
      snapshot.components.flatMap((component) => {
        const generation = component.generation.objectGeneration;
        return generation.outputContractId && generation.outputContractVersion
          ? [
              {
                id: generation.outputContractId,
                version: generation.outputContractVersion,
              },
            ]
          : [];
      }),
    );
    const currentContractVersions = new Set(
      components.map(
        (component) =>
          `${component.currentContractId}\u0000${component.currentContractVersion}`,
      ),
    );
    return {
      brandId: request.brandId,
      ...(request.subject && snapshot.subjectId
        ? { subjectId: snapshot.subjectId }
        : {}),
      objectSemanticId: request.objectSemanticId,
      objectContract: objectContracts.length === 1 ? objectContracts[0] : null,
      objectContractVersions: objectContracts,
      outputContract: outputContracts.length === 1 ? outputContracts[0] : null,
      objectState,
      assembledValue: this.assembler.assemble(snapshot.components),
      consumerReadiness,
      resultReadiness,
      freshness: aggregateFreshness(
        components.map((component) => component.freshness),
      ),
      changedAt: latestGenerationTimestamp(components),
      authority: aggregateString(
        components.map((component) => component.authority),
      ),
      sourceClass: aggregateString(
        components.map((component) => component.sourceClass),
      ),
      mixedGeneration:
        new Set(
          snapshot.components.map(
            (component) => component.generation.objectGeneration.id,
          ),
        ).size > 1,
      mixedContractVersion:
        objectContracts.length > 1 ||
        outputContracts.length > 1 ||
        currentContractVersions.size > 1,
      components,
      candidateSummary: aggregateCandidateSummary(components),
    };
  }

  async readComponent(
    request: ReadCurrentIntelligenceComponentRequest,
  ): Promise<IntelligenceComponentProjection> {
    this.contracts.resolveObject(request.objectSemanticId);
    if (
      !this.contracts.ownsPath(
        request.brandId,
        request.objectSemanticId,
        request.componentSemanticPath,
      )
    ) {
      return {
        projectionState: "NOT_OWNED",
        brandId: request.brandId,
        objectSemanticId: request.objectSemanticId,
        componentSemanticPath: request.componentSemanticPath,
        pathSchemeVersion: 1,
        valueState: "NOT_OWNED",
      };
    }
    const snapshot = await this.repository.readComponentSnapshot(
      request.brandId,
      request.objectSemanticId,
      request.componentSemanticPath,
      request.subject,
    );
    this.assertSnapshot(snapshot, request.brandId, request.objectSemanticId);
    if (snapshot.components.length === 0) {
      return {
        projectionState: "NO_CURRENT",
        brandId: request.brandId,
        ...(request.subject && snapshot.subjectId
          ? { subjectId: snapshot.subjectId }
          : {}),
        objectSemanticId: request.objectSemanticId,
        componentSemanticPath: request.componentSemanticPath,
        pathSchemeVersion: 1,
        valueState: "NO_CURRENT",
      };
    }
    if (snapshot.components.length !== 1) {
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "A semantic component address resolved more than one current row",
      );
    }
    return this.projectComponent(
      snapshot,
      snapshot.components[0],
      Boolean(request.subject),
    );
  }

  private projectComponent(
    snapshot: ProjectionRepositorySnapshot,
    component: ProjectionComponentRecord,
    exposeSubject = false,
  ): CurrentIntelligenceComponentProjection {
    this.assertCurrentGeneration(component);
    const lineageKey = keyOf(
      component.generation.objectGeneration.id,
      component.componentSemanticPath,
    );
    const evidence = snapshot.evidenceReferences
      .filter(
        (reference) =>
          keyOf(
            reference.objectGenerationId,
            reference.componentSemanticPath,
          ) === lineageKey,
      )
      .map(projectEvidenceReference);
    const business = snapshot.businessStateReferences
      .filter(
        (reference) =>
          keyOf(
            reference.objectGenerationId,
            reference.componentSemanticPath,
          ) === lineageKey,
      )
      .map(projectBusinessStateReference);
    return {
      projectionState: "CURRENT",
      brandId: component.brandId,
      ...(exposeSubject ? { subjectId: component.subjectId } : {}),
      objectSemanticId: component.objectSemanticId,
      componentSemanticPath: component.componentSemanticPath,
      pathSchemeVersion: 1,
      valueState: component.generation.valueState as
        | "VALUE"
        | "EXPLICIT_NULL"
        | "INTENTIONALLY_ABSENT",
      ...(component.generation.valueState === "VALUE"
        ? { value: component.generation.valuePayload }
        : component.generation.valueState === "EXPLICIT_NULL"
          ? { value: null }
          : {}),
      authority: component.currentAuthority as IntelligenceProjectionAuthority,
      sourceClass: component.currentSourceClass,
      readiness: component.currentReadiness as IntelligenceProjectionReadiness,
      freshness: component.currentFreshness as IntelligenceProjectionFreshness,
      protectionState:
        component.protectionState as IntelligenceProjectionProtection,
      currentContractId: component.currentContractId,
      currentContractVersion: component.currentContractVersion,
      revision: component.revision.toString(),
      generationCreatedAt: component.generation.createdAt.toISOString(),
      staleReasonCode: component.staleReasonCode,
      businessStateReferenceSummary: business,
      evidenceReferenceSummary: evidence,
      candidateSummary: componentCandidateSummary(component),
    };
  }

  private assertSnapshot(
    snapshot: ProjectionRepositorySnapshot,
    brandId: string,
    objectSemanticId: string,
  ): void {
    if (
      snapshot.brandId !== brandId ||
      snapshot.objectSemanticId !== objectSemanticId ||
      snapshot.components.some(
        (component) =>
          component.brandId !== brandId ||
          component.subjectId !== snapshot.subjectId ||
          component.objectSemanticId !== objectSemanticId,
      ) ||
      snapshot.evidenceReferences.some(
        (reference) => reference.brandId !== brandId,
      ) ||
      snapshot.businessStateReferences.some(
        (reference) => reference.brandId !== brandId,
      )
    ) {
      throw new IntelligenceCurrentProjectionError(
        "TENANCY_VIOLATION",
        "Projection snapshot contains state from another Brand or Object",
      );
    }
  }

  private assertCurrentGeneration(component: ProjectionComponentRecord): void {
    const generation = component.generation;
    if (
      component.pathSchemeVersion !== 1 ||
      generation.id !== component.currentComponentGenerationId ||
      generation.brandId !== component.brandId ||
      generation.subjectId !== component.subjectId ||
      generation.objectGeneration.subjectId !== component.subjectId ||
      generation.objectSemanticId !== component.objectSemanticId ||
      generation.pathSchemeVersion !== component.pathSchemeVersion ||
      generation.componentSemanticPath !== component.componentSemanticPath ||
      generation.componentContractId !== component.currentContractId ||
      generation.componentContractVersion !==
        component.currentContractVersion ||
      generation.authority !== component.currentAuthority ||
      generation.sourceClass !== component.currentSourceClass
    ) {
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "Current component metadata does not match its immutable generation",
        { componentSemanticPath: component.componentSemanticPath },
      );
    }
    if (
      (component.currentAuthority === "BRAND_CONFIRMED" &&
        component.protectionState !== "BRAND_CONFIRMED") ||
      (component.currentAuthority === "SUPPORT_CONTROLLED" &&
        component.protectionState !== "SUPPORT_CONTROLLED") ||
      (!["BRAND_CONFIRMED", "SUPPORT_CONTROLLED"].includes(
        component.currentAuthority,
      ) &&
        component.protectionState !== "UNPROTECTED")
    ) {
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "Current authority and protection state disagree",
        { componentSemanticPath: component.componentSemanticPath },
      );
    }
    if (
      component.pendingCandidates.some(
        (candidate) =>
          candidate.basisCurrentComponentGenerationId !==
          component.currentComponentGenerationId,
      )
    ) {
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "A pending candidate no longer targets the preserved current generation",
        { componentSemanticPath: component.componentSemanticPath },
      );
    }
  }
}

function componentCandidateSummary(
  component: ProjectionComponentRecord,
): IntelligenceCandidateSummary {
  const pendingCount = component.pendingCandidates.length;
  return {
    // W1.0B candidates are created only for material protected-state
    // discrepancies. AVAILABLE remains a stable read vocabulary for a future
    // non-material suggestion record, but is not inferred today.
    status: pendingCount ? "CONFLICT" : "NONE",
    pendingCount,
    currentPreserved: true,
    summaryAvailable: pendingCount > 0,
    rawCandidateVisible: false,
  };
}

function aggregateCandidateSummary(
  components: readonly CurrentIntelligenceComponentProjection[],
): IntelligenceCandidateSummary {
  const pendingCount = components.reduce(
    (sum, component) => sum + component.candidateSummary.pendingCount,
    0,
  );
  return {
    status: pendingCount ? "CONFLICT" : "NONE",
    pendingCount,
    currentPreserved: components.length > 0,
    summaryAvailable: pendingCount > 0,
    rawCandidateVisible: false,
  };
}

function aggregateReadiness(
  values: readonly IntelligenceProjectionReadiness[],
): IntelligenceProjectionReadiness {
  if (!values.length || values.every((value) => value === "NOT_READY")) {
    return "NOT_READY";
  }
  if (values.every((value) => value === "READY")) return "READY";
  return "PARTIAL";
}

function deriveConsumerReadiness(
  objectState: CurrentIntelligenceObjectProjection["objectState"],
  resultReadiness: IntelligenceProjectionReadiness,
): IntelligenceProjectionReadiness {
  if (objectState === "NO_CURRENT" || resultReadiness === "NOT_READY") {
    return "NOT_READY";
  }
  return objectState === "CURRENT" && resultReadiness === "READY"
    ? "READY"
    : "PARTIAL";
}

function aggregateFreshness(
  values: readonly IntelligenceProjectionFreshness[],
): IntelligenceProjectionFreshness {
  if (values.some((value) => value === "STALE")) return "STALE";
  if (!values.length || values.some((value) => value === "UNKNOWN")) {
    return "UNKNOWN";
  }
  return "CURRENT";
}

function aggregateString<T extends string>(
  values: readonly T[],
): T | "MIXED" | null {
  const distinct = [...new Set(values)];
  if (!distinct.length) return null;
  return distinct.length === 1 ? distinct[0] : "MIXED";
}

function latestGenerationTimestamp(
  components: readonly CurrentIntelligenceComponentProjection[],
): string | null {
  if (components.length === 0) return null;
  return components.reduce(
    (latest, component) =>
      component.generationCreatedAt > latest
        ? component.generationCreatedAt
        : latest,
    components[0].generationCreatedAt,
  );
}

function uniqueContracts(
  values: readonly IntelligenceContractProjection[],
): readonly IntelligenceContractProjection[] {
  return [
    ...new Map(
      values.map((contract) => [
        `${contract.id}\u0000${contract.version}`,
        contract,
      ]),
    ).values(),
  ].sort(
    (left, right) =>
      left.id.localeCompare(right.id) ||
      left.version.localeCompare(right.version),
  );
}

function projectEvidenceReference(
  reference: ProjectionEvidenceReferenceRecord,
): IntelligenceEvidenceReferenceSummary {
  return {
    evidenceRef: reference.evidenceRef,
    capabilityId: reference.capabilityId,
    resourceCapture: {
      captureRef: reference.captureId,
      captureVersion: reference.captureVersion,
    },
    sourceClass: reference.sourceClass,
    capturedAt: reference.capturedAt.toISOString(),
    observedFreshness: reference.observedFreshness,
  };
}

function projectBusinessStateReference(
  reference: ProjectionBusinessStateReferenceRecord,
): IntelligenceBusinessStateReferenceSummary {
  return {
    entityType: reference.entityType,
    entityId: reference.entityId,
    semanticFieldPath: reference.semanticFieldPath,
    revisionKind: reference.revisionKind,
    revisionToken: reference.revisionToken,
    canonicalSnapshotRef: reference.canonicalSnapshotRef,
  };
}

function keyOf(objectGenerationId: string, path: string): string {
  return `${objectGenerationId}\u0000${path}`;
}

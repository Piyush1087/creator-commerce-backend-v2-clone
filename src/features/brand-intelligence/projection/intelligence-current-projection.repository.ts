import { Injectable } from "@nestjs/common";
import {
  IntelligenceComponentCandidateStatus,
  IntelligenceCurrentComponentLifecycle,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { IntelligenceCurrentProjectionError } from "./intelligence-current-projection.error";
import {
  findExistingIntelligenceSubject,
  type IntelligenceSubjectSelector,
} from "../subject/intelligence-subject.resolver";

const currentProjectionInclude =
  Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
    currentComponentGeneration: {
      include: {
        objectGeneration: {
          select: {
            id: true,
            brandId: true,
            subjectId: true,
            objectSemanticId: true,
            objectContractId: true,
            objectContractVersion: true,
            outputContractId: true,
            outputContractVersion: true,
            bundleId: true,
            bundleVersion: true,
            bundleHash: true,
          },
        },
      },
    },
    candidates: {
      where: { status: IntelligenceComponentCandidateStatus.PENDING },
      select: {
        id: true,
        brandId: true,
        subjectId: true,
        objectSemanticId: true,
        pathSchemeVersion: true,
        componentSemanticPath: true,
        basisCurrentComponentGenerationId: true,
        basisCurrentRevision: true,
        discrepancyCode: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
  });

type CurrentProjectionRow = Prisma.IntelligenceCurrentComponentGetPayload<{
  include: typeof currentProjectionInclude;
}>;

export interface ProjectionCandidateRecord {
  readonly id: string;
  readonly brandId: string;
  readonly subjectId: string;
  readonly objectSemanticId: string;
  readonly componentSemanticPath: string;
  readonly pathSchemeVersion: number;
  readonly basisCurrentComponentGenerationId: string;
  readonly basisCurrentRevision: bigint;
  readonly discrepancyCode: string;
}

export interface ProjectionEvidenceReferenceRecord {
  readonly brandId: string;
  readonly objectGenerationId: string;
  readonly componentSemanticPath: string;
  readonly evidenceRef: string;
  readonly capabilityId: string;
  readonly captureId: string;
  readonly captureVersion: string;
  readonly sourceClass: string;
  readonly capturedAt: Date;
  readonly observedFreshness: "CURRENT" | "POSSIBLY_STALE" | "UNKNOWN" | null;
}

export interface ProjectionBusinessStateReferenceRecord {
  readonly brandId: string;
  readonly objectGenerationId: string;
  readonly componentSemanticPath: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly semanticFieldPath: string;
  readonly revisionKind:
    | "EXPLICIT_VERSION"
    | "UPDATED_AT"
    | "SNAPSHOT_FINGERPRINT";
  readonly revisionToken: string;
  readonly canonicalSnapshotRef: string;
}

export interface ProjectionComponentRecord {
  readonly id: string;
  readonly brandId: string;
  readonly subjectId: string;
  readonly objectSemanticId: string;
  readonly pathSchemeVersion: number;
  readonly componentSemanticPath: string;
  readonly nodeKind: string;
  readonly currentComponentGenerationId: string;
  readonly currentContractId: string;
  readonly currentContractVersion: string;
  readonly currentAuthority: string;
  readonly currentSourceClass: string;
  readonly currentReadiness: string;
  readonly currentFreshness: string;
  readonly protectionState: string;
  readonly revision: bigint;
  readonly staleReasonCode: string | null;
  readonly generation: Readonly<{
    id: string;
    brandId: string;
    subjectId: string;
    objectGenerationId: string;
    objectSemanticId: string;
    componentSemanticPath: string;
    pathSchemeVersion: number;
    nodeKind: string;
    componentContractId: string;
    componentContractVersion: string;
    valueState: string;
    valuePayload: unknown;
    authority: string;
    sourceClass: string;
    readiness: string;
    freshnessAtGeneration: string;
    presentationOrder: number | null;
    createdAt: Date;
    objectGeneration: Readonly<{
      id: string;
      brandId: string;
      subjectId: string;
      objectSemanticId: string;
      objectContractId: string;
      objectContractVersion: string;
      outputContractId: string | null;
      outputContractVersion: string | null;
      bundleId: string;
      bundleVersion: string;
      bundleHash: string;
    }>;
  }>;
  readonly pendingCandidates: readonly ProjectionCandidateRecord[];
}

export interface ProjectionRepositorySnapshot {
  readonly brandId: string;
  readonly subjectId?: string;
  readonly objectSemanticId: string;
  readonly components: readonly ProjectionComponentRecord[];
  readonly evidenceReferences: readonly ProjectionEvidenceReferenceRecord[];
  readonly businessStateReferences: readonly ProjectionBusinessStateReferenceRecord[];
}

@Injectable()
export class IntelligenceCurrentProjectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  readObjectSnapshot(
    brandId: string,
    objectSemanticId: string,
    subject?: IntelligenceSubjectSelector,
  ): Promise<ProjectionRepositorySnapshot> {
    return this.readSnapshot(brandId, objectSemanticId, undefined, subject);
  }

  readComponentSnapshot(
    brandId: string,
    objectSemanticId: string,
    componentSemanticPath: string,
    subject?: IntelligenceSubjectSelector,
  ): Promise<ProjectionRepositorySnapshot> {
    return this.readSnapshot(
      brandId,
      objectSemanticId,
      componentSemanticPath,
      subject,
    );
  }

  private async readSnapshot(
    brandId: string,
    objectSemanticId: string,
    componentSemanticPath?: string,
    subjectSelector?: IntelligenceSubjectSelector,
  ): Promise<ProjectionRepositorySnapshot> {
    try {
      const subject = await findExistingIntelligenceSubject(
        this.prisma,
        brandId,
        subjectSelector,
      );
      if (!subject) {
        return {
          brandId,
          objectSemanticId,
          components: [],
          evidenceReferences: [],
          businessStateReferences: [],
        };
      }
      return await this.prisma.$transaction(
        async (transaction) => {
          const rows = await transaction.intelligenceCurrentComponent.findMany({
            where: {
              brandId,
              subjectId: subject.id,
              objectSemanticId,
              lifecycle: IntelligenceCurrentComponentLifecycle.ACTIVE,
              ...(componentSemanticPath ? { componentSemanticPath } : {}),
            },
            include: currentProjectionInclude,
            orderBy: [{ componentSemanticPath: "asc" }, { id: "asc" }],
          });
          const components = rows.map((row) => this.mapComponent(row));
          if (components.length === 0) {
            return {
              brandId,
              subjectId: subject.id,
              objectSemanticId,
              components: [],
              evidenceReferences: [],
              businessStateReferences: [],
            };
          }
          const objectGenerationIds = [
            ...new Set(
              components.map(
                (component) => component.generation.objectGeneration.id,
              ),
            ),
          ];
          const [evidenceReferences, businessStateReferences] =
            await Promise.all([
              transaction.intelligenceEvidenceReference.findMany({
                where: {
                  brandId,
                  objectGenerationId: { in: objectGenerationIds },
                },
                orderBy: [
                  { componentSemanticPath: "asc" },
                  { evidenceRef: "asc" },
                  { capabilityId: "asc" },
                ],
              }),
              transaction.intelligenceBusinessStateReference.findMany({
                where: {
                  brandId,
                  objectGenerationId: { in: objectGenerationIds },
                },
                orderBy: [
                  { componentSemanticPath: "asc" },
                  { entityType: "asc" },
                  { entityId: "asc" },
                  { semanticFieldPath: "asc" },
                ],
              }),
            ]);
          return {
            brandId,
            subjectId: subject.id,
            objectSemanticId,
            components,
            evidenceReferences: evidenceReferences.map((reference) => ({
              brandId: reference.brandId,
              objectGenerationId: reference.objectGenerationId,
              componentSemanticPath: reference.componentSemanticPath,
              evidenceRef: reference.evidenceRef,
              capabilityId: reference.capabilityId,
              captureId: reference.captureId,
              captureVersion: reference.captureVersion,
              sourceClass: reference.sourceClass,
              capturedAt: reference.capturedAt,
              observedFreshness: reference.observedFreshness,
            })),
            businessStateReferences: businessStateReferences.map(
              (reference) => ({
                brandId: reference.brandId,
                objectGenerationId: reference.objectGenerationId,
                componentSemanticPath: reference.componentSemanticPath,
                entityType: reference.entityType,
                entityId: reference.entityId,
                semanticFieldPath: reference.semanticFieldPath,
                revisionKind: reference.revisionKind,
                revisionToken: reference.revisionToken,
                canonicalSnapshotRef: reference.canonicalSnapshotRef,
              }),
            ),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    } catch (error) {
      if (error instanceof IntelligenceCurrentProjectionError) throw error;
      throw new IntelligenceCurrentProjectionError(
        "PROJECTION_INVARIANT",
        "Current Intelligence projection could not be read",
      );
    }
  }

  private mapComponent(row: CurrentProjectionRow): ProjectionComponentRecord {
    const generation = row.currentComponentGeneration;
    const objectGeneration = generation.objectGeneration;
    this.assertSameAddress(row, generation, objectGeneration);
    const pendingCandidates = row.candidates.map((candidate) => {
      if (
        candidate.brandId !== row.brandId ||
        candidate.objectSemanticId !== row.objectSemanticId ||
        candidate.pathSchemeVersion !== row.pathSchemeVersion ||
        candidate.componentSemanticPath !== row.componentSemanticPath
      ) {
        throw new IntelligenceCurrentProjectionError(
          "TENANCY_VIOLATION",
          "A candidate does not share the current component address",
        );
      }
      return {
        id: candidate.id,
        brandId: candidate.brandId,
        subjectId: candidate.subjectId,
        objectSemanticId: candidate.objectSemanticId,
        componentSemanticPath: candidate.componentSemanticPath,
        pathSchemeVersion: candidate.pathSchemeVersion,
        basisCurrentComponentGenerationId:
          candidate.basisCurrentComponentGenerationId,
        basisCurrentRevision: candidate.basisCurrentRevision,
        discrepancyCode: candidate.discrepancyCode,
      };
    });
    return {
      id: row.id,
      brandId: row.brandId,
      subjectId: row.subjectId,
      objectSemanticId: row.objectSemanticId,
      pathSchemeVersion: row.pathSchemeVersion,
      componentSemanticPath: row.componentSemanticPath,
      nodeKind: row.nodeKind,
      currentComponentGenerationId: row.currentComponentGenerationId,
      currentContractId: row.currentContractId,
      currentContractVersion: row.currentContractVersion,
      currentAuthority: row.currentAuthority,
      currentSourceClass: row.currentSourceClass,
      currentReadiness: row.currentReadiness,
      currentFreshness: row.currentFreshness,
      protectionState: row.protectionState,
      revision: row.revision,
      staleReasonCode: row.staleReasonCode,
      generation: {
        id: generation.id,
        brandId: generation.brandId,
        subjectId: generation.subjectId,
        objectGenerationId: generation.objectGenerationId,
        objectSemanticId: generation.objectSemanticId,
        componentSemanticPath: generation.componentSemanticPath,
        pathSchemeVersion: generation.pathSchemeVersion,
        nodeKind: generation.nodeKind,
        componentContractId: generation.componentContractId,
        componentContractVersion: generation.componentContractVersion,
        valueState: generation.valueState,
        valuePayload: generation.valuePayload,
        authority: generation.authority,
        sourceClass: generation.sourceClass,
        readiness: generation.readiness,
        freshnessAtGeneration: generation.freshnessAtGeneration,
        presentationOrder: generation.presentationOrder,
        createdAt: generation.createdAt,
        objectGeneration: {
          id: objectGeneration.id,
          brandId: objectGeneration.brandId,
          subjectId: objectGeneration.subjectId,
          objectSemanticId: objectGeneration.objectSemanticId,
          objectContractId: objectGeneration.objectContractId,
          objectContractVersion: objectGeneration.objectContractVersion,
          outputContractId: objectGeneration.outputContractId,
          outputContractVersion: objectGeneration.outputContractVersion,
          bundleId: objectGeneration.bundleId,
          bundleVersion: objectGeneration.bundleVersion,
          bundleHash: objectGeneration.bundleHash,
        },
      },
      pendingCandidates,
    };
  }

  private assertSameAddress(
    current: CurrentProjectionRow,
    generation: CurrentProjectionRow["currentComponentGeneration"],
    objectGeneration: CurrentProjectionRow["currentComponentGeneration"]["objectGeneration"],
  ): void {
    if (
      generation.brandId !== current.brandId ||
      generation.subjectId !== current.subjectId ||
      objectGeneration.brandId !== current.brandId ||
      objectGeneration.subjectId !== current.subjectId ||
      generation.objectSemanticId !== current.objectSemanticId ||
      objectGeneration.objectSemanticId !== current.objectSemanticId ||
      generation.pathSchemeVersion !== current.pathSchemeVersion ||
      generation.componentSemanticPath !== current.componentSemanticPath
    ) {
      throw new IntelligenceCurrentProjectionError(
        "TENANCY_VIOLATION",
        "Current component lineage crossed a Brand or semantic address",
      );
    }
  }
}

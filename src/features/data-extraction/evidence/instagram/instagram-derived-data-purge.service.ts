import { Injectable } from "@nestjs/common";
import { DataExtractionSourceClass, Prisma } from "@prisma/client";

import { InstagramImageTemporaryStore } from "../../../instagram/media/instagram-image-temporary-store";

export type InstagramDerivedPurgeCounts = Readonly<{
  resources: number;
  captures: number;
  capabilityExecutions: number;
  contentArtifacts: number;
  evidenceItems: number;
  semanticObservations: number;
}>;

@Injectable()
export class InstagramDerivedDataPurgeService {
  constructor(private readonly temporaryStore: InstagramImageTemporaryStore) {}

  purgeTemporaryScope(brandProfileId: string): Promise<number> {
    return this.temporaryStore.purgeScope(brandProfileId);
  }

  async purgePersistentInTransaction(
    tx: Prisma.TransactionClient,
    brandProfileId: string,
  ): Promise<InstagramDerivedPurgeCounts> {
    const resources = await tx.dataExtractionResource.findMany({
      where: {
        brandId: brandProfileId,
        sourceClass: DataExtractionSourceClass.INSTAGRAM_OWNED,
      },
      select: { resourceRef: true },
    });
    const resourceRefs = resources.map((row) => row.resourceRef);
    const captures = resourceRefs.length
      ? await tx.dataExtractionCapture.findMany({
          where: { brandId: brandProfileId, resourceRef: { in: resourceRefs } },
          select: { captureRef: true },
        })
      : [];
    const captureRefs = captures.map((row) => row.captureRef);
    const executions = await tx.dataExtractionCapabilityExecution.findMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
      select: { capabilityExecutionRef: true },
    });
    const executionRefs = executions.map((row) => row.capabilityExecutionRef);
    const evidence = await tx.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
      select: { evidenceRef: true },
    });
    const evidenceRefs = evidence.map((row) => row.evidenceRef);
    const artifactCount = captureRefs.length
      ? await tx.dataExtractionContentArtifact.count({
          where: { brandId: brandProfileId, captureRef: { in: captureRefs } },
        })
      : 0;
    const observationCount = await tx.dataExtractionSemanticObservation.count({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });

    await tx.dataExtractionObservationRelation.deleteMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });
    await tx.dataExtractionObservationSupport.deleteMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });
    await tx.dataExtractionCapabilityEvidence.deleteMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });
    await tx.dataExtractionProviderExecutionLink.deleteMany({
      where: {
        brandId: brandProfileId,
        OR: [
          ...(captureRefs.length ? [{ captureRef: { in: captureRefs } }] : []),
          ...(executionRefs.length
            ? [{ capabilityExecutionRef: { in: executionRefs } }]
            : []),
        ],
      },
    });
    await tx.dataExtractionFreshnessAssessment.deleteMany({
      where: {
        brandId: brandProfileId,
        OR: [
          ...(resourceRefs.length ? [{ targetRef: { in: resourceRefs } }] : []),
          ...(captureRefs.length
            ? [
                { targetRef: { in: captureRefs } },
                { priorCaptureRef: { in: captureRefs } },
              ]
            : []),
          ...(evidenceRefs.length ? [{ targetRef: { in: evidenceRefs } }] : []),
        ],
      },
    });
    const deletedEvidence = await tx.dataExtractionEvidenceItem.deleteMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });
    if (captureRefs.length) {
      await tx.dataExtractionContentArtifact.deleteMany({
        where: { brandId: brandProfileId, captureRef: { in: captureRefs } },
      });
    }
    await tx.dataExtractionCapabilityResource.deleteMany({
      where: {
        brandId: brandProfileId,
        capabilityId: { startsWith: "instagram." },
      },
    });
    const deletedCaptures = captureRefs.length
      ? await tx.dataExtractionCapture.deleteMany({
          where: { brandId: brandProfileId, captureRef: { in: captureRefs } },
        })
      : { count: 0 };
    const deletedExecutions =
      await tx.dataExtractionCapabilityExecution.deleteMany({
        where: {
          brandId: brandProfileId,
          capabilityId: { startsWith: "instagram." },
        },
      });
    const deletedObservations =
      await tx.dataExtractionSemanticObservation.deleteMany({
        where: {
          brandId: brandProfileId,
          capabilityId: { startsWith: "instagram." },
        },
      });
    const deletedResources = await tx.dataExtractionResource.deleteMany({
      where: {
        brandId: brandProfileId,
        sourceClass: DataExtractionSourceClass.INSTAGRAM_OWNED,
      },
    });

    return {
      resources: deletedResources.count,
      captures: deletedCaptures.count,
      capabilityExecutions: deletedExecutions.count,
      contentArtifacts: artifactCount,
      evidenceItems: deletedEvidence.count,
      semanticObservations: deletedObservations.count || observationCount,
    };
  }
}

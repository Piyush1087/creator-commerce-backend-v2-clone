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
  intelligenceObjectGenerations: number;
  intelligenceComponentGenerations: number;
  intelligenceProcessorExecutions: number;
}>;

const C4_OBJECT_IDS = [
  "instagram_content_behavior",
  "instagram_audience_profile",
  "instagram_organic_performance_profile",
] as const;

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
    // Intelligence references normalized DE Evidence with restrictive FKs, so
    // Settings removes the target Brand's derived current/history first.
    const c4Generations = await tx.intelligenceObjectGeneration.findMany({
      where: {
        brandId: brandProfileId,
        objectSemanticId: { in: [...C4_OBJECT_IDS] },
      },
      select: { id: true },
    });
    const c4GenerationIds = c4Generations.map((row) => row.id);
    const c4Executions = await tx.intelligenceProcessorExecution.findMany({
      where: {
        brandId: brandProfileId,
        processorId: { in: [...C4_OBJECT_IDS] },
      },
      select: { id: true },
    });
    const c4ExecutionIds = c4Executions.map((row) => row.id);
    const c4ComponentCount = c4GenerationIds.length
      ? await tx.intelligenceComponentGeneration.count({
          where: {
            brandId: brandProfileId,
            objectGenerationId: { in: c4GenerationIds },
          },
        })
      : 0;
    await tx.intelligenceComponentTransition.deleteMany({
      where: {
        brandId: brandProfileId,
        objectSemanticId: { in: [...C4_OBJECT_IDS] },
      },
    });
    await tx.intelligenceComponentCandidate.deleteMany({
      where: {
        brandId: brandProfileId,
        objectSemanticId: { in: [...C4_OBJECT_IDS] },
      },
    });
    await tx.intelligenceCurrentComponent.deleteMany({
      where: {
        brandId: brandProfileId,
        objectSemanticId: { in: [...C4_OBJECT_IDS] },
      },
    });
    if (c4GenerationIds.length) {
      await tx.intelligenceEvidenceReference.deleteMany({
        where: {
          brandId: brandProfileId,
          objectGenerationId: { in: c4GenerationIds },
        },
      });
      await tx.intelligenceBusinessStateReference.deleteMany({
        where: {
          brandId: brandProfileId,
          objectGenerationId: { in: c4GenerationIds },
        },
      });
      await tx.intelligenceComponentGeneration.deleteMany({
        where: {
          brandId: brandProfileId,
          objectGenerationId: { in: c4GenerationIds },
        },
      });
      await tx.intelligenceObjectGeneration.deleteMany({
        where: { brandId: brandProfileId, id: { in: c4GenerationIds } },
      });
    }
    if (c4ExecutionIds.length) {
      await tx.intelligenceAction.deleteMany({
        where: {
          brandId: brandProfileId,
          processorExecutionId: { in: c4ExecutionIds },
        },
      });
      await tx.intelligenceProcessorAttempt.deleteMany({
        where: {
          brandId: brandProfileId,
          processorExecutionId: { in: c4ExecutionIds },
        },
      });
      await tx.intelligenceProcessorExecution.deleteMany({
        where: { brandId: brandProfileId, id: { in: c4ExecutionIds } },
      });
    }
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
      intelligenceObjectGenerations: c4GenerationIds.length,
      intelligenceComponentGenerations: c4ComponentCount,
      intelligenceProcessorExecutions: c4ExecutionIds.length,
    };
  }
}

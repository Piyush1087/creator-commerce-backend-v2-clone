import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class InstagramHiddenBrandReader {
  constructor(private readonly prisma: PrismaService) {}

  async latestSuccessful(brandId: string) {
    if (!brandId.trim())
      throw new Error("INSTAGRAM_HIDDEN_BRAND_SCOPE_REQUIRED");
    const rows = await this.prisma.intelligenceObjectGeneration.findMany({
      where: {
        brandId,
        processorExecution: { status: "COMPLETED" },
        objectMetadataPayload: {
          path: ["sourceScope"],
          equals: "INSTAGRAM_OWNED",
        },
      },
      include: {
        processorExecution: {
          select: { completedAt: true, processorId: true },
        },
        evidenceReferences: {
          select: { evidenceRef: true, capabilityId: true, sourceClass: true },
          orderBy: [{ capabilityId: "asc" }, { evidenceRef: "asc" }],
        },
      },
    });
    const sorted = rows.sort((left, right) => {
      const leftMeta = left.objectMetadataPayload as Record<string, unknown>;
      const rightMeta = right.objectMetadataPayload as Record<string, unknown>;
      return (
        String(rightMeta.windowEnd).localeCompare(String(leftMeta.windowEnd)) ||
        (right.processorExecution?.completedAt?.getTime() ?? 0) -
          (left.processorExecution?.completedAt?.getTime() ?? 0) ||
        right.id.localeCompare(left.id)
      );
    });
    const latestByObject = new Map<string, (typeof sorted)[number]>();
    for (const generation of sorted) {
      const processorId =
        generation.processorExecution?.processorId ?? generation.producerId;
      const key = `${processorId}:${generation.objectSemanticId}`;
      if (!latestByObject.has(key)) latestByObject.set(key, generation);
    }
    return [...latestByObject.values()].map((generation) => {
      const metadata = generation.objectMetadataPayload as Record<
        string,
        unknown
      >;
      return {
        generationId: generation.id,
        processorId:
          generation.processorExecution?.processorId ?? generation.producerId,
        sourceScope: "INSTAGRAM_OWNED" as const,
        sourceProfileVersion: String(metadata.sourceProfileVersion),
        objectSemanticId: generation.objectSemanticId,
        objectContractVersion: generation.objectContractVersion,
        outputContractVersion: generation.outputContractVersion,
        readiness: generation.readiness,
        freshness: generation.freshnessAtGeneration,
        windowStart: String(metadata.windowStart),
        windowEnd: String(metadata.windowEnd),
        finalizedAt:
          generation.processorExecution?.completedAt?.toISOString() ?? null,
        evidence: generation.evidenceReferences.map((reference) => ({
          evidenceRef: reference.evidenceRef,
          capabilityId: reference.capabilityId,
          sourceScope: reference.sourceClass,
        })),
      };
    });
  }
}

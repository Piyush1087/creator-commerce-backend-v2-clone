import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AUDIENCE_OBJECT } from "./audience-persona.types";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type AudienceCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Comparison/protection/lineage catalogue only; no other BI Objects or Preview store. */
@Injectable()
export class AudiencePersonaStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(
    brandId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AudienceCurrentState[]> {
    return (tx ?? this.prisma).intelligenceCurrentComponent.findMany({
      where: { brandId, objectSemanticId: AUDIENCE_OBJECT },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

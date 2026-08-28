import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { DIFFERENTIATION_OBJECT } from "./brand-differentiation.types";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type DifferentiationCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Comparison/protection/lineage catalogue only; no other BI Objects or Preview store. */
@Injectable()
export class BrandDifferentiationStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(
    brandId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DifferentiationCurrentState[]> {
    return (tx ?? this.prisma).intelligenceCurrentComponent.findMany({
      where: { brandId, objectSemanticId: DIFFERENTIATION_OBJECT },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

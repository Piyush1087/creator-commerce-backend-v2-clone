import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { VISUAL_STYLE_OBJECT } from "./visual-style.types";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type VisualStyleCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Comparison/protection/lineage catalogue only; no other BI Objects or Preview store. */
@Injectable()
export class VisualStyleStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(
    brandId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<VisualStyleCurrentState[]> {
    return (tx ?? this.prisma).intelligenceCurrentComponent.findMany({
      where: { brandId, objectSemanticId: VISUAL_STYLE_OBJECT },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

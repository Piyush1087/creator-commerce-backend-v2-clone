import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { DIFFERENTIATION_OBJECT } from "./brand-differentiation.types";
import { resolveIntelligenceSubject } from "../../subject/intelligence-subject";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type DifferentiationCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Comparison/protection/lineage catalogue only; no other BI Objects or Preview store. */
@Injectable()
export class BrandDifferentiationStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  async read(
    brandId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<DifferentiationCurrentState[]> {
    const client = tx ?? this.prisma;
    const subject = await resolveIntelligenceSubject(client, brandId);
    return client.intelligenceCurrentComponent.findMany({
      where: {
        brandId,
        subjectId: subject.id,
        objectSemanticId: DIFFERENTIATION_OBJECT,
      },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

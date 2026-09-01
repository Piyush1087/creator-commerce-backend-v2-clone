import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SERVICEABILITY_OBJECT } from "./serviceability.types";
import { resolveIntelligenceSubject } from "../../subject/intelligence-subject";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type ServiceabilityCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

@Injectable()
export class ServiceabilityStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  async read(brandId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const subject = await resolveIntelligenceSubject(client, brandId);
    return client.intelligenceCurrentComponent.findMany({
      where: {
        brandId,
        subjectId: subject.id,
        objectSemanticId: SERVICEABILITY_OBJECT,
      },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

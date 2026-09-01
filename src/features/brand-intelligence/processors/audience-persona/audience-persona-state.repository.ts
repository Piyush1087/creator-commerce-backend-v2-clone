import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AUDIENCE_OBJECT } from "./audience-persona.types";
import { resolveIntelligenceSubject } from "../../subject/intelligence-subject";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type AudienceCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Comparison/protection/lineage catalogue only; no other BI Objects or Preview store. */
@Injectable()
export class AudiencePersonaStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  async read(
    brandId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<AudienceCurrentState[]> {
    const client = tx ?? this.prisma;
    const subject = await resolveIntelligenceSubject(client, brandId);
    return client.intelligenceCurrentComponent.findMany({
      where: {
        brandId,
        subjectId: subject.id,
        objectSemanticId: AUDIENCE_OBJECT,
      },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import {
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterObject,
} from "./brand-character.types";
import { resolveIntelligenceSubject } from "../../subject/intelligence-subject";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type CharacterCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

/** Read-only, processor-owned identity/protection catalogue. No other BI Object is readable here. */
@Injectable()
export class BrandCharacterStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    brandId: string,
    objects: readonly BrandCharacterObject[],
    tx?: Prisma.TransactionClient,
  ): Promise<CharacterCurrentState[]> {
    if (objects.some((id) => !BRAND_CHARACTER_OBJECTS.includes(id)))
      throw new Error("CHARACTER_UNOWNED_OBJECT");
    const client = tx ?? this.prisma;
    const subject = await resolveIntelligenceSubject(client, brandId);
    return client.intelligenceCurrentComponent.findMany({
      where: {
        brandId,
        subjectId: subject.id,
        objectSemanticId: { in: [...objects] },
      },
      include,
      orderBy: [{ objectSemanticId: "asc" }, { componentSemanticPath: "asc" }],
    });
  }
}

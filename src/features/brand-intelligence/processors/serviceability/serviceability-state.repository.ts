import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { SERVICEABILITY_OBJECT } from "./serviceability.types";

const include = Prisma.validator<Prisma.IntelligenceCurrentComponentInclude>()({
  currentComponentGeneration: true,
});
export type ServiceabilityCurrentState =
  Prisma.IntelligenceCurrentComponentGetPayload<{ include: typeof include }>;

@Injectable()
export class ServiceabilityStateRepository {
  constructor(private readonly prisma: PrismaService) {}
  read(brandId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).intelligenceCurrentComponent.findMany({
      where: { brandId, objectSemanticId: SERVICEABILITY_OBJECT },
      include,
      orderBy: { componentSemanticPath: "asc" },
    });
  }
}

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class BrandCampaignConsumerService {
  constructor(private readonly prisma: PrismaService) {}

  async listForHome(brandProfileId: string, limit: number) {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.uceCampaign.findMany({
      where: { brandProfileId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: boundedLimit + 1,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
    return {
      campaigns: rows.slice(0, boundedLimit).map((row) => ({
        campaignId: row.id,
        name: row.name,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      })),
      truncated: rows.length > boundedLimit,
    };
  }
}

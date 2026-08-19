import { BadRequestException, Injectable } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class CanonicalCampaignDraftReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getDraft(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { id: true, status: true },
    });
    if (!campaign) throw new BadRequestException("Campaign draft not found.");
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Campaign is no longer a DRAFT.");
    }

    const rows = await this.prisma.$queryRaw<Array<{ canonical_definition: unknown }>>`
      SELECT "canonical_definition"
      FROM "uce_campaigns"
      WHERE "id" = ${campaignId}
      LIMIT 1
    `;

    const definition = rows[0]?.canonical_definition;
    const draft =
      definition &&
      typeof definition === "object" &&
      !Array.isArray(definition) &&
      "draft" in definition
        ? (definition as { draft: unknown }).draft
        : { strategy: {}, targeting: {}, commercials: {} };

    return {
      campaignId: campaign.id,
      status: campaign.status,
      creationSource: "MANUAL" as const,
      draft,
    };
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class CanonicalCampaignDraftReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getDraft(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: {
        id: true,
        status: true,
        creationSource: true,
        canonicalDefinition: true,
      },
    });
    if (!campaign) throw new BadRequestException("Campaign draft not found.");
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Campaign is no longer a DRAFT.");
    }

    const definition = campaign.canonicalDefinition;
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
      creationSource: campaign.creationSource,
      draft,
    };
  }
}

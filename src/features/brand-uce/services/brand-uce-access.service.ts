import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class BrandUceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCampaignOwned(
    brandProfileId: string,
    campaignId: string,
  ) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  async assertCollaborationOwned(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
  ) {
    await this.assertCampaignOwned(brandProfileId, campaignId);
    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: { id: collaborationId, campaignId },
      include: {
        brief: { select: { internalTitle: true } },
        product: { select: { skuCode: true, productName: true } },
      },
    });
    if (!collab) {
      throw new NotFoundException("Collaboration not found");
    }
    return collab;
  }
}

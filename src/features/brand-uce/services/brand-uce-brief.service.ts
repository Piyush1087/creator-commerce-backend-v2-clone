import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreateCampaignBriefDto,
  UpdateCampaignBriefDto,
} from "../dto/brand-uce-brief.dto";
import { BrandUceAccessService } from "./brand-uce-access.service";

@Injectable()
export class BrandUceBriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async list(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const briefs = await this.prisma.uceCampaignBrief.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });
    return briefs.map((b) => this.mapBrief(b));
  }

  async create(
    brandProfileId: string,
    campaignId: string,
    dto: CreateCampaignBriefDto,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const brief = await this.prisma.uceCampaignBrief.create({
      data: {
        campaignId,
        internalTitle: dto.internal_title,
        creativeGuidelines: dto.creative_guidelines,
        requiredPlatforms: dto.required_platforms,
        deliverableFormatTags: dto.deliverable_format_tags,
      },
    });
    return this.mapBrief(brief);
  }

  async update(
    brandProfileId: string,
    campaignId: string,
    briefId: string,
    dto: UpdateCampaignBriefDto,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: briefId, campaignId },
    });
    if (!brief) {
      throw new NotFoundException("Brief not found");
    }
    const updated = await this.prisma.uceCampaignBrief.update({
      where: { id: briefId },
      data: {
        internalTitle: dto.internal_title,
        creativeGuidelines: dto.creative_guidelines,
        requiredPlatforms: dto.required_platforms,
        deliverableFormatTags: dto.deliverable_format_tags,
      },
    });
    return this.mapBrief(updated);
  }

  async remove(brandProfileId: string, campaignId: string, briefId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: briefId, campaignId },
    });
    if (!brief) {
      throw new NotFoundException("Brief not found");
    }
    await this.prisma.uceCampaignBrief.delete({ where: { id: briefId } });
  }

  private mapBrief(b: {
    id: string;
    campaignId: string;
    internalTitle: string;
    creativeGuidelines: string;
    requiredPlatforms: string[];
    deliverableFormatTags: string[];
    createdAt: Date;
  }) {
    return {
      brief_id: b.id,
      campaign_id: b.campaignId,
      internal_title: b.internalTitle,
      creative_guidelines: b.creativeGuidelines,
      required_platforms: b.requiredPlatforms,
      deliverable_format_tags: b.deliverableFormatTags,
      created_at: b.createdAt.toISOString(),
    };
  }
}

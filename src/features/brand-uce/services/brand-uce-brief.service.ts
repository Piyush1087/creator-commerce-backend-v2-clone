import { ConflictException, Injectable } from "@nestjs/common";
import { type UceCampaignBrief } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { UpdateCampaignBriefDto } from "../dto/brand-uce-brief.dto";
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

  async create(_brandProfileId: string, _campaignId: string, _body: unknown) {
    throw new ConflictException(
      "Create this Brief under a Campaign Asset from the Campaign Page.",
    );
  }

  async update(
    _brandProfileId: string,
    _campaignId: string,
    _briefId: string,
    _dto: UpdateCampaignBriefDto,
  ) {
    throw new ConflictException("This Brief is read-only.");
  }

  async remove(_brandProfileId: string, _campaignId: string, _briefId: string) {
    throw new ConflictException("This Brief is read-only.");
  }

  mapBrief(b: UceCampaignBrief) {
    return {
      brief_id: b.id,
      campaign_id: b.campaignId,
      product_id: b.productId,
      internal_title: b.internalTitle,
      creative_guidelines: b.creativeGuidelines,
      required_platforms: b.requiredPlatforms,
      deliverable_format_tags: b.deliverableFormatTags,
      brief_type: b.briefType,
      purpose: b.purpose,
      objective: b.objective,
      target_influencer_archetype: b.targetInfluencerArchetype,
      mandatory_creator_requirements: b.mandatoryCreatorRequirements,
      deliverables_inventory: b.deliverablesInventory,
      content_guidance_matrix: b.contentGuidanceMatrix,
      parent_planner_logistics_snapshot: b.parentPlannerLogisticsSnapshot,
      created_at: b.createdAt.toISOString(),
    };
  }
}

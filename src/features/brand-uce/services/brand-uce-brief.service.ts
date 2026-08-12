import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  UceBriefStrategyMode,
  UceBriefStatus,
  UceBriefCreationSource,
  UceBriefType,
  UceDeliverableFormat,
  UceMediaPlatform,
  type UceCampaignBrief,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { UpdateCampaignBriefDto } from "../dto/brand-uce-brief.dto";
import {
  MasterAddBriefWizardSchema,
  type MasterAddBriefWizardRequest,
} from "../schemas/uce-add-brief.schema";
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

  async create(brandProfileId: string, campaignId: string, body: unknown) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const parsed = MasterAddBriefWizardSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: "Add Brief wizard payload validation failed",
        issues: parsed.error.flatten(),
      });
    }

    if (parsed.data.campaign_id !== campaignId) {
      throw new BadRequestException(
        "campaign_id in body must match the campaign route parameter.",
      );
    }

    const product = await this.prisma.uceCampaignProduct.findFirst({
      where: { id: parsed.data.product_id, campaignId },
    });
    if (!product) {
      throw new NotFoundException(
        "Linked product/asset was not found on this campaign.",
      );
    }

    const data = parsed.data;
    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.uceCampaignAsset.findFirst({
        where: {
          id: data.canonical_campaign_asset_id,
          campaignId,
          status: "ACTIVE",
        },
      });
      if (!asset)
        throw new BadRequestException(
          "Canonical Campaign Asset is required and must belong to this Campaign.",
        );
      const existingCanonical = await tx.uceBrief.findFirst({
        where: { campaignAssetId: asset.id, briefName: data.brief_name },
      });
      const canonicalData = {
        status: UceBriefStatus.PUBLISHED,
        creationSource: UceBriefCreationSource.MANUAL,
        briefName: data.brief_name,
        creativeIntent: data.objective,
        creatorBrief: this.summarizeGuidelines(data),
        briefType:
          data.brief_type === "CREATOR_LED"
            ? UceBriefType.CREATOR_LED
            : UceBriefType.BRAND_LED,
        platform: UceMediaPlatform.INSTAGRAM,
        briefLevelGuidance:
          data.content_guidance_matrix as unknown as Prisma.InputJsonValue,
        creatorRequirements: data.mandatory_creator_requirements,
      };
      const deliverables = data.deliverables_inventory.map((d, index) => ({
        format: this.canonicalFormat(d.format_type),
        displayOrder: index,
        configuration: d as unknown as Prisma.InputJsonValue,
      }));
      const canonical = existingCanonical
        ? await tx.uceBrief.update({
            where: { id: existingCanonical.id },
            data: {
              ...canonicalData,
              deliverables: { deleteMany: {}, create: deliverables },
            },
          })
        : await tx.uceBrief.create({
            data: {
              campaignAssetId: asset.id,
              ...canonicalData,
              deliverables: { create: deliverables },
            },
          });
      const existingProjection = await tx.uceCampaignBrief.findFirst({
        where: {
          campaignId,
          productId: data.product_id,
          internalTitle: data.brief_name,
        },
      });
      const legacyData = {
        campaignId,
        productId: data.product_id,
        internalTitle: data.brief_name,
        creativeGuidelines: this.summarizeGuidelines(data),
        requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
        deliverableFormatTags: data.deliverables_inventory.map(
          (d) => d.format_type,
        ),
        briefType: data.brief_type as UceBriefStrategyMode,
        purpose: data.purpose,
        objective: data.objective,
        targetInfluencerArchetype: data.target_influencer_archetype,
        mandatoryCreatorRequirements: data.mandatory_creator_requirements,
        deliverablesInventory:
          data.deliverables_inventory as unknown as Prisma.InputJsonValue,
        contentGuidanceMatrix:
          data.content_guidance_matrix as unknown as Prisma.InputJsonValue,
        parentPlannerLogisticsSnapshot:
          data.parent_planner_logistics_snapshot as unknown as Prisma.InputJsonValue,
      };
      const brief = existingProjection
        ? await tx.uceCampaignBrief.update({
            where: { id: existingProjection.id },
            data: legacyData,
          })
        : await tx.uceCampaignBrief.create({ data: legacyData });
      return { brief, canonical };
    });
    return {
      ...this.mapBrief(result.brief),
      canonical_brief_id: result.canonical.id,
      canonical_campaign_asset_id: result.canonical.campaignAssetId,
    };
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

  private summarizeGuidelines(data: MasterAddBriefWizardRequest): string {
    return [
      `Purpose: ${data.purpose}`,
      `Objective: ${data.objective}`,
      `Strategy: ${data.brief_type}`,
      `Mandatory: ${data.mandatory_creator_requirements}`,
    ].join("\n");
  }

  private canonicalFormat(
    value: MasterAddBriefWizardRequest["deliverables_inventory"][number]["format_type"],
  ): UceDeliverableFormat {
    if (value === "CAROUSEL_BANNER")
      return UceDeliverableFormat.BANNER_CAROUSEL;
    return value;
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

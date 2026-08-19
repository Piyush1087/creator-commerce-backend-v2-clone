import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UceCampaignAssetStatus, UceCampaignStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreateCanonicalCampaignBriefDto,
  UpdateCanonicalCampaignBriefDto,
} from "../dto/canonical-campaign-brief.dto";
import { BrandUceAccessService } from "./brand-uce-access.service";

const TERMINAL = new Set<UceCampaignStatus>([
  UceCampaignStatus.COMPLETED,
  UceCampaignStatus.ARCHIVED,
]);

@Injectable()
export class CanonicalCampaignBriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async list(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const rows = await this.prisma.canonicalCampaignBrief.findMany({
      where: { campaignAsset: { campaignId } },
      include: { deliverables: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapCanonicalBrief);
  }

  async create(
    brandProfileId: string,
    campaignId: string,
    dto: CreateCanonicalCampaignBriefDto,
  ) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    await this.assertActiveAsset(campaignId, dto.campaign_asset_id);

    const row = await this.prisma.canonicalCampaignBrief.create({
      data: {
        campaignAssetId: dto.campaign_asset_id,
        title: dto.title.trim(),
        creativeRequirements: dto.creative_requirements.trim(),
        deliverables: {
          create: dto.deliverables.map((item) => ({
            format: item.format.trim(),
            quantity: item.quantity,
            creativeRequirements: item.creative_requirements.trim(),
            publishingRequired: item.publishing_required,
          })),
        },
      },
      include: { deliverables: { orderBy: { createdAt: "asc" } } },
    });
    return mapCanonicalBrief(row);
  }

  async update(
    brandProfileId: string,
    campaignId: string,
    briefId: string,
    dto: UpdateCanonicalCampaignBriefDto,
  ) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    this.assertWritable(campaign.status);
    const existing = await this.prisma.canonicalCampaignBrief.findFirst({
      where: { id: briefId, campaignAsset: { campaignId } },
    });
    if (!existing) throw new NotFoundException("Brief not found");

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.deliverables) {
        await tx.canonicalBriefDeliverable.deleteMany({ where: { briefId } });
      }
      return tx.canonicalCampaignBrief.update({
        where: { id: briefId },
        data: {
          title: dto.title?.trim(),
          creativeRequirements: dto.creative_requirements?.trim(),
          deliverables: dto.deliverables
            ? {
                create: dto.deliverables.map((item) => ({
                  format: item.format.trim(),
                  quantity: item.quantity,
                  creativeRequirements: item.creative_requirements.trim(),
                  publishingRequired: item.publishing_required,
                })),
              }
            : undefined,
        },
        include: { deliverables: { orderBy: { createdAt: "asc" } } },
      });
    });
    return mapCanonicalBrief(row);
  }

  private async assertActiveAsset(campaignId: string, assetId: string) {
    const asset = await this.prisma.uceCampaignAsset.findFirst({
      where: {
        id: assetId,
        campaignId,
        status: UceCampaignAssetStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!asset) {
      throw new NotFoundException(
        "Select an active Campaign Asset from this Campaign before creating a Brief.",
      );
    }
  }

  private assertWritable(status: UceCampaignStatus) {
    if (TERMINAL.has(status)) {
      throw new ConflictException("This Campaign is read-only.");
    }
  }
}

export function mapCanonicalBrief(row: {
  id: string;
  campaignAssetId: string;
  title: string;
  creativeRequirements: string;
  isActive: boolean;
  createdAt: Date;
  deliverables: Array<{
    id: string;
    format: string;
    quantity: number;
    creativeRequirements: string;
    publishingRequired: boolean;
  }>;
}) {
  const deliverables = row.deliverables.map((item) => ({
    deliverable_id: item.id,
    format: item.format,
    quantity: item.quantity,
    creative_requirements: item.creativeRequirements,
    publishing_required: item.publishingRequired,
  }));
  const missingRequirements = [
    ...(row.title.trim().length >= 5 ? [] : ["title"]),
    ...(row.creativeRequirements.trim().length >= 10
      ? []
      : ["creative_requirements"]),
    ...(deliverables.length > 0 ? [] : ["deliverables"]),
    ...(deliverables.every(
      (item) =>
        item.quantity > 0 && item.creative_requirements.trim().length >= 5,
    )
      ? []
      : ["deliverable_requirements"]),
  ];

  return {
    brief_id: row.id,
    campaign_asset_id: row.campaignAssetId,
    title: row.title,
    creative_requirements: row.creativeRequirements,
    is_active: row.isActive,
    deliverables,
    readiness: {
      ready: row.isActive && missingRequirements.length === 0,
      missing_requirements: missingRequirements,
    },
    created_at: row.createdAt.toISOString(),
  };
}

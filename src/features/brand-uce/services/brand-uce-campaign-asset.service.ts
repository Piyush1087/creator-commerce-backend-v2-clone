import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceCampaignAssetKind,
  UceCampaignAssetStatus,
  UceCampaignStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  CampaignAssetSelectionKind,
  type CreateCampaignAssetDto,
} from "../dto/brand-uce-campaign-asset.dto";
import { BrandUceAccessService } from "./brand-uce-access.service";

const TERMINAL = new Set<UceCampaignStatus>([
  UceCampaignStatus.COMPLETED,
  UceCampaignStatus.ARCHIVED,
]);

@Injectable()
export class BrandUceCampaignAssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async listSelectable(brandProfileId: string) {
    const [brand, offerings, offers] = await Promise.all([
      this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { id: true, name: true, logoUrl: true },
      }),
      this.prisma.offering.findMany({
        where: { brandProfileId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, type: true, imageUrl: true },
      }),
      this.prisma.brandOffer.findMany({
        where: { brandProfileId, isActive: true },
        orderBy: { offerName: "asc" },
        select: { id: true, offerName: true },
      }),
    ]);

    return [
      ...(brand
        ? [
            {
              kind: CampaignAssetSelectionKind.BRAND,
              entity_id: brand.id,
              label: brand.name,
              subtype: null,
              image_url: brand.logoUrl,
            },
          ]
        : []),
      ...offerings.map((offering) => ({
        kind: CampaignAssetSelectionKind.OFFERING,
        entity_id: offering.id,
        label: offering.name,
        subtype: offering.type,
        image_url: offering.imageUrl,
      })),
      ...offers.map((offer) => ({
        kind: CampaignAssetSelectionKind.OFFER,
        entity_id: offer.id,
        label: offer.offerName,
        subtype: null,
        image_url: null,
      })),
    ];
  }

  async select(
    brandProfileId: string,
    campaignId: string,
    input: CreateCampaignAssetDto,
  ) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );
    if (TERMINAL.has(campaign.status)) {
      throw new ConflictException("This Campaign is read-only.");
    }

    const data = await this.resolveSelection(brandProfileId, input);
    try {
      const asset = await this.prisma.uceCampaignAsset.create({
        data: {
          campaignId,
          kind: input.kind as UceCampaignAssetKind,
          status: UceCampaignAssetStatus.ACTIVE,
          ...data,
        },
        include: this.assetInclude,
      });
      return this.toProjection(asset);
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This Brand Centre Asset is already linked to the Campaign.",
        );
      }
      throw error;
    }
  }

  async listForCampaign(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const assets = await this.prisma.uceCampaignAsset.findMany({
      where: {
        campaignId,
        OR: [
          { brandProfileId },
          { offering: { brandProfileId } },
          { brandOffer: { brandProfileId } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: this.assetInclude,
    });
    return assets.map((asset) => this.toProjection(asset));
  }

  private async resolveSelection(
    brandProfileId: string,
    input: CreateCampaignAssetDto,
  ) {
    if (input.kind === CampaignAssetSelectionKind.BRAND) {
      if (input.entity_id !== brandProfileId) {
        throw new NotFoundException("Brand Centre Asset not found.");
      }
      return { brandProfileId: input.entity_id };
    }
    if (input.kind === CampaignAssetSelectionKind.OFFERING) {
      const offering = await this.prisma.offering.findFirst({
        where: { id: input.entity_id, brandProfileId, isActive: true },
        select: { id: true },
      });
      if (!offering) {
        throw new NotFoundException(
          "Brand Centre Asset not found or unavailable.",
        );
      }
      return { offeringId: offering.id };
    }
    if (input.kind === CampaignAssetSelectionKind.OFFER) {
      const offer = await this.prisma.brandOffer.findFirst({
        where: { id: input.entity_id, brandProfileId, isActive: true },
        select: { id: true },
      });
      if (!offer) {
        throw new NotFoundException(
          "Brand Centre Asset not found or unavailable.",
        );
      }
      return { brandOfferId: offer.id };
    }
    throw new BadRequestException("Select a valid Brand Centre Asset.");
  }

  private readonly assetInclude = {
    brandProfile: { select: { name: true, logoUrl: true } },
    offering: { select: { name: true, type: true, imageUrl: true } },
    brandOffer: { select: { offerName: true } },
  } as const;

  private toProjection(asset: {
    id: string;
    kind: UceCampaignAssetKind;
    status: UceCampaignAssetStatus;
    brandProfileId: string | null;
    offeringId: string | null;
    brandOfferId: string | null;
    brandProfile: { name: string; logoUrl: string | null } | null;
    offering: { name: string; type: string; imageUrl: string | null } | null;
    brandOffer: { offerName: string } | null;
  }) {
    return {
      campaign_asset_id: asset.id,
      kind: asset.kind,
      status: asset.status,
      entity_id: asset.brandProfileId ?? asset.offeringId ?? asset.brandOfferId,
      label:
        asset.brandProfile?.name ??
        asset.offering?.name ??
        asset.brandOffer?.offerName ??
        "Brand Centre Asset",
      subtype: asset.offering?.type ?? null,
      image_url:
        asset.brandProfile?.logoUrl ?? asset.offering?.imageUrl ?? null,
    };
  }
}

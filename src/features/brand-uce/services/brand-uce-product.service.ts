import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  UceCampaignAssetType,
  type UceCampaignProduct,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { UpdateCampaignProductDto } from "../dto/brand-uce-product.dto";
import {
  MasterAddAssetDrawerSchema,
  type MasterAddAssetDrawerRequest,
} from "../schemas/uce-add-product.schema";
import { decimalToNumber } from "../utils/uce-decimal.util";
import { BrandUceAccessService } from "./brand-uce-access.service";

type AssetCreateFields = {
  assetType: UceCampaignAssetType;
  productName: string;
  costPerUnit: number;
  imageUrl: string | null;
  skuCode: string | null;
  assetPayload: Prisma.InputJsonValue;
};

@Injectable()
export class BrandUceProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async list(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const products = await this.prisma.uceCampaignProduct.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
    });
    return products.map((p) => this.mapProduct(p));
  }

  async create(
    brandProfileId: string,
    campaignId: string,
    body: unknown,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const parsed = MasterAddAssetDrawerSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: "Add Asset payload validation failed",
        issues: parsed.error.flatten(),
      });
    }

    if (parsed.data.campaign_id !== campaignId) {
      throw new BadRequestException(
        "campaign_id in body must match the campaign route parameter.",
      );
    }

    const fields = this.mapAssetToCreateFields(parsed.data);

    if (fields.skuCode) {
      const existing = await this.prisma.uceCampaignProduct.findUnique({
        where: {
          campaignId_skuCode: {
            campaignId,
            skuCode: fields.skuCode,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          "This SKU is already tied to an active product structure. Please enter a unique identifier.",
        );
      }
    }

    const product = await this.prisma.uceCampaignProduct.create({
      data: {
        campaignId,
        assetType: fields.assetType,
        skuCode: fields.skuCode,
        productName: fields.productName,
        inventoryCount: 0,
        costPerUnit: fields.costPerUnit,
        imageUrl: fields.imageUrl,
        assetPayload: fields.assetPayload,
      },
    });
    return this.mapProduct(product);
  }

  async update(
    brandProfileId: string,
    campaignId: string,
    productId: string,
    dto: UpdateCampaignProductDto,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const product = await this.prisma.uceCampaignProduct.findFirst({
      where: { id: productId, campaignId },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (dto.sku_code && dto.sku_code !== product.skuCode) {
      const conflict = await this.prisma.uceCampaignProduct.findUnique({
        where: {
          campaignId_skuCode: { campaignId, skuCode: dto.sku_code },
        },
      });
      if (conflict) {
        throw new ConflictException(
          "This SKU is already tied to an active product structure. Please enter a unique identifier.",
        );
      }
    }

    const updated = await this.prisma.uceCampaignProduct.update({
      where: { id: productId },
      data: {
        skuCode: dto.sku_code,
        productName: dto.product_name,
        inventoryCount: dto.inventory_count,
        costPerUnit: dto.cost_per_unit,
        imageUrl: dto.image_url,
      },
    });
    return this.mapProduct(updated);
  }

  async remove(brandProfileId: string, campaignId: string, productId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const product = await this.prisma.uceCampaignProduct.findFirst({
      where: { id: productId, campaignId },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    await this.prisma.uceCampaignProduct.delete({ where: { id: productId } });
  }

  private mapAssetToCreateFields(
    data: MasterAddAssetDrawerRequest,
  ): AssetCreateFields {
    const { campaign_id: _campaignId, ...payload } = data;

    switch (data.asset_type) {
      case "INDIVIDUAL_PRODUCT_SKU":
        return {
          assetType: UceCampaignAssetType.INDIVIDUAL_PRODUCT_SKU,
          productName: data.product_name,
          costPerUnit: data.price,
          imageUrl: data.thumbnail_asset_url,
          skuCode: null,
          assetPayload: payload as Prisma.InputJsonValue,
        };
      case "CURATED_COLLECTION_LINE":
        return {
          assetType: UceCampaignAssetType.CURATED_COLLECTION_LINE,
          productName: data.collection_name,
          costPerUnit: 0,
          imageUrl: data.collection_thumbnail_url,
          skuCode: null,
          assetPayload: payload as Prisma.InputJsonValue,
        };
      case "CORE_BRAND_IDENTITY":
        return {
          assetType: UceCampaignAssetType.CORE_BRAND_IDENTITY,
          productName: data.corporate_legal_name,
          costPerUnit: 0,
          imageUrl: null,
          skuCode: null,
          assetPayload: payload as Prisma.InputJsonValue,
        };
      case "ACTIVE_SALE_PROMOTION":
        return {
          assetType: UceCampaignAssetType.ACTIVE_SALE_PROMOTION,
          productName: data.offer_name,
          costPerUnit: 0,
          imageUrl: null,
          skuCode: data.offer_code.slice(0, 150),
          assetPayload: payload as Prisma.InputJsonValue,
        };
      default: {
        const _exhaustive: never = data;
        return _exhaustive;
      }
    }
  }

  mapProduct(p: UceCampaignProduct) {
    return {
      product_id: p.id,
      campaign_id: p.campaignId,
      asset_type: p.assetType,
      sku_code: p.skuCode,
      product_name: p.productName,
      inventory_count: p.inventoryCount,
      out_of_stock: p.inventoryCount <= 0,
      cost_per_unit: decimalToNumber(p.costPerUnit),
      image_url: p.imageUrl,
      asset_payload: p.assetPayload,
      created_at: p.createdAt.toISOString(),
    };
  }
}

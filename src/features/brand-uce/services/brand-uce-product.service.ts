import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type {
  CreateCampaignProductDto,
  UpdateCampaignProductDto,
} from "../dto/brand-uce-product.dto";
import { decimalToNumber } from "../utils/uce-decimal.util";
import { BrandUceAccessService } from "./brand-uce-access.service";

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
    dto: CreateCampaignProductDto,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const existing = await this.prisma.uceCampaignProduct.findUnique({
      where: {
        campaignId_skuCode: {
          campaignId,
          skuCode: dto.sku_code,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        "This SKU is already tied to an active product structure. Please enter a unique identifier.",
      );
    }

    const product = await this.prisma.uceCampaignProduct.create({
      data: {
        campaignId,
        skuCode: dto.sku_code,
        productName: dto.product_name,
        inventoryCount: dto.inventory_count,
        costPerUnit: dto.cost_per_unit,
        imageUrl: dto.image_url ?? null,
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

  private mapProduct(p: {
    id: string;
    campaignId: string;
    skuCode: string;
    productName: string;
    inventoryCount: number;
    costPerUnit: { toString(): string };
    imageUrl: string | null;
    createdAt: Date;
  }) {
    return {
      product_id: p.id,
      campaign_id: p.campaignId,
      sku_code: p.skuCode,
      product_name: p.productName,
      inventory_count: p.inventoryCount,
      out_of_stock: p.inventoryCount <= 0,
      cost_per_unit: decimalToNumber(p.costPerUnit as never),
      image_url: p.imageUrl,
      created_at: p.createdAt.toISOString(),
    };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { PatchBrandProfileDto } from "./dto/brand-profile.dto";

function serializeDecimal(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toString();
}

@Injectable()
export class BrandProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(brandProfileId: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        offerings: true,
        competitors: true,
        locations: true,
      },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    return {
      id: profile.id,
      domain: profile.domain,
      name: profile.name,
      industry: profile.industry,
      subIndustry: profile.subIndustry,
      industryNiche: profile.industryNiche,
      logoUrl: profile.logoUrl,
      tagline: profile.tagline,
      description: profile.description,
      visualIdentity: profile.visualIdentity,
      brandValues: profile.brandValues,
      policyFlags: profile.policyFlags,
      targetAudience: profile.targetAudience,
      isUserEdited: profile.isUserEdited,
      scanStatus: profile.scanStatus,
      offerings: profile.offerings.map((o) => ({
        id: o.id,
        type: o.type,
        name: o.name,
        description: o.description,
        imageUrl: o.imageUrl,
        url: o.url,
        priceAmount: serializeDecimal(o.priceAmount),
        currency: o.currency,
        locationIds: o.locationIds,
        isActive: o.isActive,
      })),
      competitors: profile.competitors.map((c) => ({
        id: c.id,
        name: c.name,
        websiteUrl: c.websiteUrl,
        logoUrl: c.logoUrl,
        socialHandles: c.socialHandles,
        whyCompetitor: c.whyCompetitor,
        isActive: c.isActive,
      })),
      locations: profile.locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        city: l.city,
        zip: l.zip,
        lat: l.lat,
        lng: l.lng,
        contactDetails: l.contactDetails,
      })),
    };
  }

  async patch(brandProfileId: string, dto: PatchBrandProfileDto) {
    const existing = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, isUserEdited: true },
    });
    if (!existing) {
      throw new NotFoundException("Brand profile not found");
    }

    const prevEdited =
      (existing.isUserEdited as Record<string, unknown> | null) ?? {};
    const touched: Record<string, true> = {};

    const data: Prisma.BrandProfileUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
      touched.name = true;
    }
    if (dto.tagline !== undefined) {
      data.tagline = dto.tagline;
      touched.tagline = true;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
      touched.description = true;
    }
    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl;
      touched.logoUrl = true;
    }
    if (dto.industry !== undefined) {
      data.industry = dto.industry;
      touched.industry = true;
    }
    if (dto.subIndustry !== undefined) {
      data.subIndustry = dto.subIndustry;
      touched.subIndustry = true;
    }
    if (dto.industryNiche !== undefined) {
      data.industryNiche = dto.industryNiche;
      touched.industryNiche = true;
    }
    if (dto.visualIdentity !== undefined) {
      data.visualIdentity = dto.visualIdentity as Prisma.InputJsonValue;
      touched.visualIdentity = true;
    }
    if (dto.brandValues !== undefined) {
      data.brandValues = dto.brandValues;
      touched.brandValues = true;
    }
    if (dto.policyFlags !== undefined) {
      data.policyFlags = dto.policyFlags;
      touched.policyFlags = true;
    }
    if (dto.targetAudience !== undefined) {
      data.targetAudience = dto.targetAudience as Prisma.InputJsonValue;
      touched.targetAudience = true;
    }

    if (Object.keys(data).length === 0) {
      return this.getById(brandProfileId);
    }

    const mergedEdited: Record<string, unknown> = { ...prevEdited, ...touched };

    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        ...data,
        isUserEdited: mergedEdited as Prisma.InputJsonValue,
      },
    });

    return this.getById(brandProfileId);
  }
}

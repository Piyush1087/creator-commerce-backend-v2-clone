import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../shared/s3/s3.service";
import { parseUploadImageBase64 } from "../../shared/s3/image-upload.util";
import type { PatchBrandProfileDto } from "./dto/brand-profile.dto";
import type { UploadBrandImageDto } from "./dto/brand-image-upload.dto";

function domainSlug(domain: string): string {
  const slug = domain
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return slug.length > 0 ? slug : "brand";
}

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
  private readonly logger = new Logger(BrandProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getById(brandProfileId: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        offerings: {
          include: {
            guidanceItems: {
              where: { lifecycle: "ACTIVE" },
              orderBy: { presentationOrder: "asc" },
            },
            priceState: { include: { currentRevision: true } },
            mediaState: { include: { primaryMediaAsset: true } },
            locationAvailability: {
              where: { lifecycle: "ACTIVE" },
              orderBy: { locationId: "asc" },
            },
          },
        },
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
      socialLinks: profile.socialLinks,
      surfaceOffers: profile.surfaceOffers,
      visualIdentity: profile.visualIdentity,
      brandValues: profile.brandValues,
      policyFlags: profile.policyFlags,
      targetAudience: profile.targetAudience,
      isUserEdited: profile.isUserEdited,
      scanStatus: profile.scanStatus,
      offerings: profile.offerings.map((o) => ({
        id: o.id,
        type: o.type,
        canonicalKind: o.canonicalKind,
        canonicalSubtype: o.canonicalSubtype,
        canonicalLifecycle: o.canonicalLifecycle,
        name: o.name,
        description: o.description,
        imageUrl: o.mediaState?.primaryMediaAsset?.url ?? o.imageUrl,
        url: o.url,
        categoryTag: o.categoryTag,
        startingPriceLabel: o.startingPriceLabel,
        priceAmount: serializeDecimal(
          o.priceState?.currentRevision?.mode === "EXACT"
            ? o.priceState.currentRevision.currentMinAmount
            : o.priceAmount,
        ),
        currency: o.priceState?.currentRevision?.currency ?? o.currency,
        locationIds: o.locationAvailability.length
          ? o.locationAvailability.map((edge) => edge.locationId)
          : o.locationIds,
        isActive: o.isActive,
        sellingPoints: o.guidanceItems.some(
          (item) => item.kind === "SELLING_POINT",
        )
          ? o.guidanceItems
              .filter((item) => item.kind === "SELLING_POINT")
              .map((item) => item.text)
          : o.sellingPoints,
        doNotSay: o.guidanceItems.some((item) => item.kind === "DO_NOT_SAY")
          ? o.guidanceItems
              .filter((item) => item.kind === "DO_NOT_SAY")
              .map((item) => item.text)
          : o.doNotSay,
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

  async uploadLogo(brandProfileId: string, dto: UploadBrandImageDto) {
    if (!this.s3.isConfigured()) {
      throw new BadRequestException(
        "S3 is not configured for image uploads in this environment.",
      );
    }
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const { buffer, contentType } = parseUploadImageBase64(dto);
    const slug = domainSlug(profile.domain);
    const directory = `brand-onboarding/v2/${slug}/${brandProfileId}/logo`;
    const uploaded = await this.s3.uploadImageFromBuffer(
      buffer,
      directory,
      this.s3.mirrorFilename(`upload-logo-${brandProfileId}`, contentType),
      contentType,
    );
    const publicUrl = this.s3.getPublicUrl(uploaded.key);

    const prevEdited =
      ((
        await this.prisma.brandProfile.findUnique({
          where: { id: brandProfileId },
          select: { isUserEdited: true },
        })
      )?.isUserEdited as Record<string, unknown> | null) ?? {};

    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        logoUrl: publicUrl,
        isUserEdited: { ...prevEdited, logoUrl: true } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `brand-logo.upload_ok brandProfileId=${brandProfileId} bytes=${buffer.length} contentType=${contentType} key=${uploaded.key} publicUrl=${publicUrl}`,
    );

    return { imageUrl: publicUrl };
  }
}

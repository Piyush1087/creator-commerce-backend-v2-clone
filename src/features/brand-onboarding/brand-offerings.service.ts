import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../shared/s3/s3.service";
import { parseUploadImageBase64 } from "../../shared/s3/image-upload.util";
import type {
  SyncOfferingsDto,
  UploadOfferingImageDto,
} from "./dto/brand-offerings.dto";
import { BrandProfileService } from "./brand-profile.service";
import { gateAndNormalizeBrandUrl } from "./discovery-url.util";

function domainSlug(domain: string): string {
  const slug = domain
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  return slug.length > 0 ? slug : "brand";
}

@Injectable()
export class BrandOfferingsService {
  private readonly logger = new Logger(BrandOfferingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
    private readonly s3: S3Service,
  ) {}

  async sync(brandProfileId: string, dto: SyncOfferingsDto) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    for (const item of dto.offerings) {
      const gated = gateAndNormalizeBrandUrl(item.url, { keepPath: true });
      if (!gated.ok) {
        throw new BadRequestException(
          `Offering URL is not allowed: ${item.url}`,
        );
      }
      if (gated.hostname !== profile.domain) {
        throw new BadRequestException(
          `Offering must belong to your domain (${profile.domain}).`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.offering.findMany({
        where: { brandProfileId },
        select: { id: true },
      });
      const keepIds = new Set(
        dto.offerings
          .map((item) => item.id)
          .filter((id): id is string => typeof id === "string"),
      );

      const toDeactivate = existing
        .map((row) => row.id)
        .filter((id) => !keepIds.has(id));
      if (toDeactivate.length > 0) {
        await tx.offering.updateMany({
          where: { id: { in: toDeactivate }, brandProfileId },
          data: { isActive: false, isUserEdited: true },
        });
      }

      for (const item of dto.offerings) {
        const data = {
          type: item.type,
          name: item.name,
          description: item.description ?? null,
          imageUrl: item.imageUrl ?? null,
          url: item.url,
          categoryTag: item.categoryTag ?? null,
          startingPriceLabel: item.startingPriceLabel ?? null,
          isActive: item.isActive !== false,
          isUserEdited: true,
        };
        if (item.id) {
          await tx.offering.updateMany({
            where: { id: item.id, brandProfileId },
            data,
          });
        } else {
          await tx.offering.create({
            data: {
              brandProfileId,
              ...data,
            },
          });
        }
      }
    });

    return this.profiles.getById(brandProfileId);
  }

  async uploadOfferingImage(
    brandProfileId: string,
    offeringId: string,
    dto: UploadOfferingImageDto,
  ) {
    if (!this.s3.isConfigured()) {
      throw new BadRequestException(
        "S3 is not configured for image uploads in this environment.",
      );
    }
    const offering = await this.prisma.offering.findFirst({
      where: { id: offeringId, brandProfileId },
      include: { brandProfile: { select: { domain: true } } },
    });
    if (!offering) {
      throw new NotFoundException("Offering not found");
    }

    const { buffer, contentType } = parseUploadImageBase64(dto);

    const slug = domainSlug(offering.brandProfile.domain);
    const directory = `brand-onboarding/v2/${slug}/${brandProfileId}/offerings/${offeringId}`;
    const uploaded = await this.s3.uploadImageFromBuffer(
      buffer,
      directory,
      this.s3.mirrorFilename(`upload-${offeringId}`, contentType),
      contentType,
    );
    const publicUrl = this.s3.getPublicUrl(uploaded.key);

    await this.prisma.offering.update({
      where: { id: offeringId },
      data: { imageUrl: publicUrl, isUserEdited: true },
    });

    this.logger.log(
      `offering-image.upload_ok brandProfileId=${brandProfileId} offeringId=${offeringId} bytes=${buffer.length} contentType=${contentType} key=${uploaded.key} publicUrl=${publicUrl}`,
    );

    return { imageUrl: publicUrl };
  }
}

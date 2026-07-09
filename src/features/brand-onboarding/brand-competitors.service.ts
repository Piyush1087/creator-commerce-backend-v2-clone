import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../shared/s3/s3.service";
import { parseUploadImageBase64 } from "../../shared/s3/image-upload.util";
import type { SyncCompetitorsDto } from "./dto/brand-competitors.dto";
import type { UploadBrandImageDto } from "./dto/brand-image-upload.dto";
import { BrandProfileService } from "./brand-profile.service";
import { gateAndNormalizeBrandUrl } from "./discovery-url.util";

/** Apex hosts blocked as competitor websites (exact or subdomain). */
const COMPETITOR_APEX_BLOCKLIST = [
  "google.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
] as const;

const COMPETITOR_MARKETPLACE_LABELS = [
  "amazon",
  "flipkart",
  "myntra",
  "meesho",
  "ajio",
  "snapdeal",
  "nykaa",
  "ebay",
  "walmart",
  "aliexpress",
  "alibaba",
  "shopee",
] as const;

function isBlockedCompetitorHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (
    COMPETITOR_APEX_BLOCKLIST.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`),
    )
  ) {
    return true;
  }
  const labels = host.split(".");
  return COMPETITOR_MARKETPLACE_LABELS.some((label) => labels.includes(label));
}

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
export class BrandCompetitorsService {
  private readonly logger = new Logger(BrandCompetitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: BrandProfileService,
    private readonly s3: S3Service,
  ) {}

  async sync(brandProfileId: string, dto: SyncCompetitorsDto) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    for (const item of dto.competitors) {
      const gated = gateAndNormalizeBrandUrl(item.websiteUrl);
      if (!gated.ok) {
        throw new BadRequestException(
          `Competitor URL is not allowed: ${item.websiteUrl}`,
        );
      }
      if (isBlockedCompetitorHost(gated.hostname)) {
        throw new BadRequestException(
          "Please provide a direct brand website rather than a marketplace or social platform.",
        );
      }
      if (gated.hostname === profile.domain) {
        throw new BadRequestException(
          "A competitor cannot use your own brand domain.",
        );
      }
      if (
        item.whyCompetitor &&
        item.whyCompetitor.trim().length > 0 &&
        item.whyCompetitor.trim().length < 40
      ) {
        throw new BadRequestException(
          "Why narrative must be at least 40 characters for strategic value.",
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.competitor.findMany({
        where: { brandProfileId },
        select: { id: true },
      });
      const keepIds = new Set(
        dto.competitors
          .map((item) => item.id)
          .filter((id): id is string => typeof id === "string"),
      );
      const toDeactivate = existing
        .map((row) => row.id)
        .filter((id) => !keepIds.has(id));
      if (toDeactivate.length > 0) {
        await tx.competitor.updateMany({
          where: { id: { in: toDeactivate }, brandProfileId },
          data: { isActive: false },
        });
      }

      for (const item of dto.competitors) {
        let logoUrl = item.logoUrl ?? null;
        if (
          logoUrl &&
          this.s3.isConfigured() &&
          /^https?:\/\//i.test(logoUrl)
        ) {
          try {
            const slug = domainSlug(profile.domain);
            const mirrored = await this.s3.mirrorRemoteAssetToS3({
              url: logoUrl,
              directory: `brand-onboarding/v2/${slug}/${brandProfileId}/competitors/manual`,
            });
            logoUrl = mirrored.publicUrl;
          } catch {
            // Keep original URL when mirror fails.
          }
        }

        const data = {
          name: item.name,
          websiteUrl: item.websiteUrl,
          logoUrl,
          socialHandles: item.socialHandles ?? [],
          whyCompetitor: item.whyCompetitor ?? null,
          isActive: item.isActive !== false,
        };

        if (item.id) {
          await tx.competitor.updateMany({
            where: { id: item.id, brandProfileId },
            data,
          });
        } else {
          await tx.competitor.create({
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

  async uploadCompetitorLogo(
    brandProfileId: string,
    competitorId: string,
    dto: UploadBrandImageDto,
  ) {
    if (!this.s3.isConfigured()) {
      throw new BadRequestException(
        "S3 is not configured for image uploads in this environment.",
      );
    }
    const competitor = await this.prisma.competitor.findFirst({
      where: { id: competitorId, brandProfileId },
      include: { brandProfile: { select: { domain: true } } },
    });
    if (!competitor) {
      throw new NotFoundException("Competitor not found");
    }

    const { buffer, contentType } = parseUploadImageBase64(dto);
    const slug = domainSlug(competitor.brandProfile.domain);
    const directory = `brand-onboarding/v2/${slug}/${brandProfileId}/competitors/${competitorId}`;
    const uploaded = await this.s3.uploadImageFromBuffer(
      buffer,
      directory,
      this.s3.mirrorFilename(`upload-${competitorId}`, contentType),
      contentType,
    );
    const publicUrl = this.s3.getPublicUrl(uploaded.key);

    await this.prisma.competitor.update({
      where: { id: competitorId },
      data: { logoUrl: publicUrl },
    });

    this.logger.log(
      `competitor-logo.upload_ok brandProfileId=${brandProfileId} competitorId=${competitorId} bytes=${buffer.length} contentType=${contentType} key=${uploaded.key} publicUrl=${publicUrl}`,
    );

    return { imageUrl: publicUrl };
  }
}

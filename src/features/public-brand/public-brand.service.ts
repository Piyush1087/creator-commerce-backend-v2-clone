import { Injectable, NotFoundException } from "@nestjs/common";
import {
  OfferingType,
  UceCampaignStatus,
  UceVisibilityScope,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  domainToPublicSlug,
  isUuid,
  publicSlugToDomain,
} from "./utils/brand-slug.util";

const PRIMARY_OFFERING_TYPES: OfferingType[] = [
  OfferingType.PRODUCT,
  OfferingType.MODULE,
  OfferingType.TREATMENT,
  OfferingType.EXPERIENCE,
  OfferingType.SERVICE,
];

type StrategicDna = {
  narrative?: { brandUsps?: string[]; toneOfVoice?: string[] };
  visuals?: { palette?: string[]; fonts?: string[]; aesthetics?: string[] };
};

@Injectable()
export class PublicBrandService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicBrandLanding(slug: string) {
    const profile = await this.resolveBrandProfile(slug);
    if (!profile) {
      throw new NotFoundException("Brand collaboration page not found");
    }

    const strategicDna = (profile.strategicDna ?? {}) as StrategicDna;
    const narrative = strategicDna.narrative ?? {};
    const visuals = strategicDna.visuals ?? {};
    const visualIdentity = (profile.visualIdentity ?? {}) as Record<
      string,
      unknown
    >;

    const usps = Array.isArray(narrative.brandUsps)
      ? narrative.brandUsps.filter((u): u is string => typeof u === "string")
      : [];

    const palette = Array.isArray(visuals.palette)
      ? visuals.palette.filter((c): c is string => typeof c === "string")
      : [];
    const fonts = Array.isArray(visuals.fonts)
      ? visuals.fonts.filter((f): f is string => typeof f === "string")
      : [];

    const primaryColor =
      palette[0] ??
      (typeof visualIdentity.primaryColor === "string"
        ? visualIdentity.primaryColor
        : null);

    const flagshipProducts = profile.offerings
      .filter((o) => PRIMARY_OFFERING_TYPES.includes(o.type))
      .slice(0, 8)
      .map((o) => ({
        offering_id: o.id,
        name: o.name,
        description: o.description,
        image_url: o.imageUrl,
        external_url: o.url,
        selling_points: o.sellingPoints,
      }));

    const collections = profile.offerings
      .filter((o) => o.type === OfferingType.COLLECTION)
      .slice(0, 6)
      .map((o) => ({
        offering_id: o.id,
        name: o.name,
        description: o.description,
        image_url: o.imageUrl,
        external_url: o.url,
      }));

    const openCampaigns = await this.prisma.uceCampaign.findMany({
      where: {
        brandProfileId: profile.id,
        status: UceCampaignStatus.LIVE,
        targeting: {
          visibilityScopes: { has: UceVisibilityScope.EVERYONE },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    const heroFromOffering = flagshipProducts.find((p) => p.image_url)?.image_url;
    const heroFromCampaign = openCampaigns[0]?.products[0]?.imageUrl ?? null;

    const briefDescription = profile.description
      ? profile.description.slice(0, 320)
      : null;

    const publicSlug = domainToPublicSlug(profile.domain);

    return {
      brand_id: profile.id,
      slug: publicSlug,
      domain: profile.domain,
      company_name: profile.name,
      tagline: profile.tagline,
      logo_url: profile.logoUrl,
      brief_description: briefDescription,
      hero_image_url: heroFromOffering ?? heroFromCampaign ?? profile.logoUrl,
      theme: {
        primary_color: primaryColor,
        heading_font: fonts[0] ?? null,
        body_font: fonts[1] ?? fonts[0] ?? null,
      },
      usps,
      flagship_products: flagshipProducts,
      collections,
      open_campaign_count: openCampaigns.length,
      featured_campaign: openCampaigns[0]
        ? {
            campaign_id: openCampaigns[0].id,
            campaign_name: openCampaigns[0].name,
          }
        : null,
      trust_mode: "platform_shield" as const,
      testimonials: [] as Array<{
        creator_handle: string;
        tier_label: string;
        quote: string;
      }>,
      marketplace_path: "/marketplace",
      registration_cta: {
        label: "Secure Portal Entry & View Active Briefs",
        login_path: "/login",
      },
    };
  }

  async resolveBrandProfile(slug: string) {
    const normalized = decodeURIComponent(slug).trim();
    if (!normalized) {
      return null;
    }

    if (isUuid(normalized)) {
      return this.loadProfile({ id: normalized });
    }

    const domainCandidate = publicSlugToDomain(normalized);
    const byDomain = await this.loadProfile({ domain: domainCandidate });
    if (byDomain) {
      return byDomain;
    }

    return this.loadProfile({ domain: normalized });
  }

  private async loadProfile(where: { id: string } | { domain: string }) {
    return this.prisma.brandProfile.findUnique({
      where,
      include: {
        offerings: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }
}

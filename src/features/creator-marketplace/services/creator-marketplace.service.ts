import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  UceApplicationScope,
  UceCampaignStatus,
  UceCollabStatus,
  UceVisibilityScope,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeInstagramHandle } from "../../brand-uce/utils/instagram-handle.util";
import { domainToPublicSlug, publicSlugToDomain } from "../../public-brand/utils/brand-slug.util";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import type { MarketplaceQueryDto } from "../dto/marketplace-query.dto";
import { MarketplaceFilterSchema } from "../schemas/marketplace-filter.schema";
import { CreatorAffinityService } from "./creator-affinity.service";
import { CreatorEligibilityService } from "./creator-eligibility.service";
import { CreatorInvitationService } from "./creator-invitation.service";
import type {
  CreatorAccessTier,
  CreatorAudienceDemographicsMatrix,
} from "../types/creator-audience.types";
import { isCampaignVisibleToCreator, isInvitedCollaboration } from "../utils/visibility-scope.util";

type AuthUser = { id: string; email: string; role: UserRole };

type PlatformDeliverable = {
  platform: string;
  formats: string[];
};

const DELIVERABLE_TAG_TO_FILTER: Record<string, string> = {
  reel: "INSTAGRAM_REEL",
  reels: "INSTAGRAM_REEL",
  story: "INSTAGRAM_STORY",
  stories: "INSTAGRAM_STORY",
  tiktok: "TIKTOK_VIDEO",
  shorts: "YOUTUBE_SHORTS",
  youtube: "YOUTUBE_SHORTS",
};

@Injectable()
export class CreatorMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: CreatorEligibilityService,
    private readonly affinity: CreatorAffinityService,
    private readonly invitations: CreatorInvitationService,
  ) {}

  async listMarketplaceCampaigns(user: AuthUser, query: MarketplaceQueryDto) {
    this.assertCreator(user);

    const parsed = MarketplaceFilterSchema.safeParse({
      search_query: query.search_query,
      brand_slug: query.brand_slug,
      niche: query.niche,
      deliverable_type: query.deliverable_type,
      show_match_eligible_only: query.show_match_eligible_only ?? false,
      creator_tier: query.creator_tier,
      target_geography: query.target_geography,
      production_timeline: query.production_timeline,
    });

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: "Marketplace filter validation failed",
        issues: parsed.error.flatten(),
      });
    }

    const filters = parsed.data;
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    const accessTier = this.resolveAccessTier(profile?.instagramHandle ?? null);
    const handle = profile?.instagramHandle
      ? normalizeInstagramHandle(profile.instagramHandle)
      : null;

    const creatorContext = {
      primaryRegion: profile?.primaryRegion ?? "US",
      followerCount: profile?.followerCount ?? 0,
      audienceDemographicsMatrix: (profile?.audienceDemographicsMatrix ??
        {}) as CreatorAudienceDemographicsMatrix,
      instagramHandle: profile?.instagramHandle ?? null,
    };

    const pipelineRows = handle
      ? await this.prisma.uceCampaignCollaboration.findMany({
          where: { instagramHandle: handle },
          select: { campaignId: true, collabStatus: true },
        })
      : [];

    const appliedCampaignIds = new Set(
      pipelineRows
        .filter(
          (r) => r.collabStatus !== UceCollabStatus.APPLICANT_REJECTED,
        )
        .map((r) => r.campaignId),
    );

    const invitedCampaignIds = new Set(
      pipelineRows
        .filter((r) => isInvitedCollaboration(r.collabStatus))
        .map((r) => r.campaignId),
    );

    const campaigns = await this.prisma.uceCampaign.findMany({
      where: {
        status: UceCampaignStatus.LIVE,
        ...this.brandSlugWhere(filters.brand_slug),
        ...(filters.search_query
          ? {
              name: {
                contains: filters.search_query,
                mode: "insensitive" as Prisma.QueryMode,
              },
            }
          : {}),
        ...(filters.niche
          ? {
              targeting: {
                industryVertical: {
                  contains: filters.niche,
                  mode: "insensitive" as Prisma.QueryMode,
                },
              },
            }
          : {}),
        ...(filters.target_geography
          ? {
              targeting: {
                targetLocations: { has: filters.target_geography.toUpperCase() },
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        brandProfile: { select: { name: true, domain: true, logoUrl: true } },
        strategy: {
          select: {
            coreObjective: true,
            platformDeliverables: true,
            dynamicDaysLimit: true,
            fixedEndDate: true,
          },
        },
        targeting: true,
        commercials: {
          select: {
            compensationType: true,
            fixedFeeAmount: true,
            negotiableMinFee: true,
            negotiableMaxFee: true,
          },
        },
        briefs: {
          where: { isActive: true },
          select: { deliverableFormatTags: true, requiredPlatforms: true },
        },
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    const rows = campaigns
      .map((campaign) => {
        const targeting = campaign.targeting;
        if (!targeting) {
          return null;
        }

        const eligibility = this.eligibility.evaluateTargeting(
          creatorContext,
          targeting,
          { creatorEmail: user.email },
        );

        const visible = isCampaignVisibleToCreator(
          targeting.visibilityScopes,
          {
            isEligible: eligibility.is_eligible,
            isInvited: invitedCampaignIds.has(campaign.id),
          },
        );

        if (!visible) {
          return null;
        }

        if (
          filters.show_match_eligible_only &&
          accessTier === "FULL" &&
          !eligibility.is_eligible
        ) {
          return null;
        }

        if (
          filters.creator_tier.length > 0 &&
          !this.eligibility.matchesCreatorTierFilter(
            creatorContext.followerCount,
            filters.creator_tier,
            { creatorEmail: user.email },
          )
        ) {
          return null;
        }

        if (
          filters.deliverable_type &&
          !this.campaignMatchesDeliverableFilter(
            campaign.briefs,
            campaign.strategy?.platformDeliverables,
            filters.deliverable_type,
          )
        ) {
          return null;
        }

        if (
          filters.production_timeline.length > 0 &&
          !this.campaignMatchesTimelineFilter(
            campaign.strategy,
            filters.production_timeline,
          )
        ) {
          return null;
        }

        const matchScore =
          accessTier === "FULL"
            ? this.affinity.computeMatchScorePercent(creatorContext, targeting)
            : null;

        const commercials = campaign.commercials;

        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          brand_name: campaign.brandProfile.name,
          brand_slug: domainToPublicSlug(campaign.brandProfile.domain),
          brand_logo_url: campaign.brandProfile.logoUrl,
          industry_vertical: targeting.industryVertical,
          core_objective: campaign.strategy?.coreObjective ?? null,
          hero_image_url: campaign.products[0]?.imageUrl ?? null,
          creator_archetypes: targeting.creatorArchetypes,
          platform_deliverables:
            (campaign.strategy?.platformDeliverables as PlatformDeliverable[]) ??
            [],
          compensation_teaser: commercials
            ? {
                compensation_type: commercials.compensationType,
                fixed_fee_amount: decimalToNumber(commercials.fixedFeeAmount),
                negotiable_min_fee: decimalToNumber(
                  commercials.negotiableMinFee,
                ),
                negotiable_max_fee: decimalToNumber(
                  commercials.negotiableMaxFee,
                ),
              }
            : null,
          match_score_percent: matchScore,
          is_eligible: accessTier === "FULL" ? eligibility.is_eligible : false,
          is_invited: invitedCampaignIds.has(campaign.id),
          already_applied: appliedCampaignIds.has(campaign.id),
          visibility_scopes: targeting.visibilityScopes,
          application_scope: targeting.applicationScope,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      access_tier: accessTier,
      is_social_connected: accessTier === "FULL",
      filters_applied: filters,
      total_count: rows.length,
      campaigns: rows,
    };
  }

  async getMarketplaceCampaignDetail(
    user: AuthUser,
    campaignId: string,
    inviteToken?: string,
  ) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    const accessTier = this.resolveAccessTier(profile?.instagramHandle ?? null);
    const handle = profile?.instagramHandle
      ? normalizeInstagramHandle(profile.instagramHandle)
      : null;

    const creatorContext = {
      primaryRegion: profile?.primaryRegion ?? "US",
      followerCount: profile?.followerCount ?? 0,
      audienceDemographicsMatrix: (profile?.audienceDemographicsMatrix ??
        {}) as CreatorAudienceDemographicsMatrix,
      instagramHandle: profile?.instagramHandle ?? null,
    };

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, status: UceCampaignStatus.LIVE },
      include: {
        brandProfile: { select: { name: true, logoUrl: true, tagline: true, domain: true } },
        strategy: true,
        targeting: true,
        commercials: true,
        products: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
        briefs: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!campaign || !campaign.targeting) {
      throw new NotFoundException("Campaign not found or not available");
    }

    const pipelineRow = handle
      ? await this.prisma.uceCampaignCollaboration.findUnique({
          where: {
            campaignId_instagramHandle: {
              campaignId,
              instagramHandle: handle,
            },
          },
        })
      : null;

    const inviteCollab = inviteToken
      ? await this.prisma.uceCampaignCollaboration.findFirst({
          where: { invitationToken: inviteToken, campaignId },
        })
      : null;

    const eligibility = this.eligibility.evaluateTargeting(
      creatorContext,
      campaign.targeting,
      { creatorEmail: user.email },
    );

    const isInvitedFromPipeline =
      pipelineRow !== null && isInvitedCollaboration(pipelineRow.collabStatus);
    const isInvitedFromToken =
      inviteCollab !== null &&
      inviteCollab.instagramHandle === handle &&
      isInvitedCollaboration(inviteCollab.collabStatus);
    const isInvited = isInvitedFromPipeline || isInvitedFromToken;

    const visible = isCampaignVisibleToCreator(campaign.targeting.visibilityScopes, {
      isEligible: eligibility.is_eligible,
      isInvited,
    });

    if (!visible && !inviteCollab) {
      throw new NotFoundException("Campaign not found or not available");
    }

    const applicationScope = campaign.targeting.applicationScope;
    const inviteBypass = this.invitations.bypassesEligibility(applicationScope);
    const isEligible =
      accessTier === "FULL" &&
      (eligibility.is_eligible || (isInvited && inviteBypass));

    let ui_access_state: "teaser" | "unlocked" | "locked" | "invite" = "teaser";
    if (isInvited && inviteBypass) {
      ui_access_state = "invite";
    } else if (accessTier === "FULL") {
      ui_access_state = isEligible ? "unlocked" : "locked";
    }

    const effectivePipelineRow = pipelineRow ?? inviteCollab;

    const commercials = campaign.commercials;
    const firstProduct = campaign.products[0] ?? null;

    const executionWindow = this.formatExecutionWindow(campaign.strategy);

    const channels = this.formatChannels(
      campaign.strategy?.platformDeliverables as PlatformDeliverable[] | null,
    );

    const matchScore =
      accessTier === "FULL"
        ? this.affinity.computeMatchScorePercent(creatorContext, campaign.targeting)
        : null;

    return {
      access_tier: accessTier,
      is_social_connected: accessTier === "FULL",
      is_eligible: isEligible,
      ui_access_state,
      match_score_percent: matchScore,
      already_applied:
        effectivePipelineRow !== null &&
        effectivePipelineRow.collabStatus !== UceCollabStatus.APPLICANT_REJECTED,
      is_invited: isInvited,
      invite_token: inviteCollab?.invitationToken ?? pipelineRow?.invitationToken ?? null,
      application_scope: applicationScope,
      campaign: {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        brand_name: campaign.brandProfile.name,
        brand_logo_url: campaign.brandProfile.logoUrl,
        brand_tagline: campaign.brandProfile.tagline,
        brand_slug: domainToPublicSlug(campaign.brandProfile.domain),
        core_objective: campaign.strategy?.coreObjective ?? null,
        execution_window: executionWindow,
        channels,
        industry_vertical: campaign.targeting.industryVertical,
        creator_archetypes: campaign.targeting.creatorArchetypes,
        compensation_teaser: commercials
          ? {
              compensation_type: commercials.compensationType,
              fixed_fee_amount: decimalToNumber(commercials.fixedFeeAmount),
              negotiable_min_fee: decimalToNumber(commercials.negotiableMinFee),
              negotiable_max_fee: decimalToNumber(commercials.negotiableMaxFee),
            }
          : null,
        product_name: firstProduct?.productName ?? null,
        product_image_url: firstProduct?.imageUrl ?? null,
        product_retail_value:
          firstProduct && decimalToNumber(firstProduct.costPerUnit) > 0
            ? decimalToNumber(firstProduct.costPerUnit)
            : null,
      },
      brief_sections:
        ui_access_state === "unlocked" || ui_access_state === "invite"
          ? campaign.briefs.map((b) => ({
              brief_id: b.id,
              title: b.internalTitle,
              body: b.creativeGuidelines,
            }))
          : null,
      products: campaign.products.map((p) => ({
        product_id: p.id,
        product_name: p.productName,
        image_url: p.imageUrl,
        inventory_count: p.inventoryCount,
        out_of_stock: p.inventoryCount <= 0,
      })),
      briefs: campaign.briefs.map((b) => ({
        brief_id: b.id,
        internal_title: b.internalTitle,
        product_id: null,
        deliverable_format_tags: b.deliverableFormatTags,
        required_platforms: b.requiredPlatforms,
      })),
    };
  }

  async listPublicMarketplaceCampaigns(query: MarketplaceQueryDto) {
    const parsed = MarketplaceFilterSchema.safeParse({
      search_query: query.search_query,
      brand_slug: query.brand_slug,
      niche: query.niche,
      deliverable_type: query.deliverable_type,
      show_match_eligible_only: false,
      creator_tier: query.creator_tier,
      target_geography: query.target_geography,
      production_timeline: query.production_timeline,
    });

    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: "Marketplace filter validation failed",
        issues: parsed.error.flatten(),
      });
    }

    const filters = parsed.data;
    const campaigns = await this.prisma.uceCampaign.findMany({
      where: {
        status: UceCampaignStatus.LIVE,
        targeting: {
          visibilityScopes: { has: UceVisibilityScope.EVERYONE },
        },
        ...this.brandSlugWhere(filters.brand_slug),
        ...(filters.search_query
          ? {
              name: {
                contains: filters.search_query,
                mode: "insensitive" as Prisma.QueryMode,
              },
            }
          : {}),
        ...(filters.niche
          ? {
              targeting: {
                industryVertical: {
                  contains: filters.niche,
                  mode: "insensitive" as Prisma.QueryMode,
                },
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        brandProfile: { select: { name: true, domain: true, logoUrl: true } },
        strategy: {
          select: {
            coreObjective: true,
            platformDeliverables: true,
            dynamicDaysLimit: true,
            fixedEndDate: true,
          },
        },
        targeting: true,
        briefs: {
          where: { isActive: true },
          select: { deliverableFormatTags: true, requiredPlatforms: true },
        },
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    const rows = campaigns
      .map((campaign) => {
        const targeting = campaign.targeting;
        if (!targeting) return null;

        if (
          filters.deliverable_type &&
          !this.campaignMatchesDeliverableFilter(
            campaign.briefs,
            campaign.strategy?.platformDeliverables,
            filters.deliverable_type,
          )
        ) {
          return null;
        }

        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          brand_name: campaign.brandProfile.name,
          brand_slug: domainToPublicSlug(campaign.brandProfile.domain),
          industry_vertical: targeting.industryVertical,
          core_objective: campaign.strategy?.coreObjective ?? null,
          hero_image_url: campaign.products[0]?.imageUrl ?? null,
          compensation_teaser: null,
          match_score_percent: null,
          is_eligible: false,
          is_invited: false,
          already_applied: false,
          application_scope: targeting.applicationScope,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      access_tier: "GUEST",
      is_social_connected: false,
      is_authenticated: false,
      total_count: rows.length,
      campaigns: rows,
    };
  }

  async getPublicMarketplaceCampaignDetail(
    campaignId: string,
    inviteToken?: string,
  ) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, status: UceCampaignStatus.LIVE },
      include: {
        brandProfile: { select: { name: true, logoUrl: true, tagline: true, domain: true } },
        strategy: true,
        targeting: true,
        commercials: true,
        products: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
        briefs: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!campaign || !campaign.targeting) {
      throw new NotFoundException("Campaign not found or not available");
    }

    const inviteCollab = inviteToken
      ? await this.prisma.uceCampaignCollaboration.findFirst({
          where: { invitationToken: inviteToken, campaignId },
        })
      : null;

    const isPublicEveryone = campaign.targeting.visibilityScopes.includes(
      UceVisibilityScope.EVERYONE,
    );
    const isInviteOnly =
      campaign.targeting.visibilityScopes.includes(UceVisibilityScope.INVITED_ONLY) &&
      inviteCollab !== null;

    if (!isPublicEveryone && !isInviteOnly) {
      throw new NotFoundException("Campaign not found or not available");
    }

    const firstProduct = campaign.products[0] ?? null;
    const executionWindow = this.formatExecutionWindow(campaign.strategy);
    const channels = this.formatChannels(
      campaign.strategy?.platformDeliverables as PlatformDeliverable[] | null,
    );

    const inviteBypass = this.invitations.bypassesEligibility(
      campaign.targeting.applicationScope,
    );

    let ui_access_state: "teaser" | "invite" = "teaser";
    if (inviteCollab && inviteBypass) {
      ui_access_state = "invite";
    }

    return {
      access_tier: "GUEST",
      is_social_connected: false,
      is_authenticated: false,
      is_eligible: false,
      ui_access_state,
      match_score_percent: null,
      already_applied: false,
      is_invited: inviteCollab !== null,
      invite_token: inviteCollab?.invitationToken ?? null,
      application_scope: campaign.targeting.applicationScope,
      campaign: {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        brand_name: campaign.brandProfile.name,
        brand_logo_url: campaign.brandProfile.logoUrl,
        brand_tagline: campaign.brandProfile.tagline,
        brand_slug: domainToPublicSlug(campaign.brandProfile.domain),
        core_objective: campaign.strategy?.coreObjective ?? null,
        execution_window: executionWindow,
        channels,
        industry_vertical: campaign.targeting.industryVertical,
        creator_archetypes: campaign.targeting.creatorArchetypes,
        compensation_teaser: null,
        product_name: firstProduct?.productName ?? null,
        product_image_url: firstProduct?.imageUrl ?? null,
        product_retail_value: null,
      },
      brief_sections: null,
      products: campaign.products.map((p) => ({
        product_id: p.id,
        product_name: p.productName,
        image_url: p.imageUrl,
        inventory_count: null,
        out_of_stock: p.inventoryCount <= 0,
      })),
      briefs: [],
      registration_cta: {
        label: "Sign up to view compensation and apply",
        login_path: "/login",
      },
    };
  }

  async getCrossSellAlternatives(user: AuthUser, campaignId: string) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    const accessTier = this.resolveAccessTier(profile?.instagramHandle ?? null);
    if (accessTier !== "FULL") {
      return { campaigns: [] };
    }

    const list = await this.listMarketplaceCampaigns(user, {});
    const alternatives = list.campaigns
      .filter(
        (c) =>
          c.campaign_id !== campaignId &&
          c.is_eligible &&
          !c.already_applied,
      )
      .sort(
        (a, b) => (b.match_score_percent ?? 0) - (a.match_score_percent ?? 0),
      )
      .slice(0, 3);

    return {
      source_campaign_id: campaignId,
      campaigns: alternatives,
    };
  }

  async buildShareLink(user: AuthUser, campaignId: string, origin: string) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    const handle = profile?.instagramHandle
      ? normalizeInstagramHandle(profile.instagramHandle)
      : null;

    const collab = handle
      ? await this.prisma.uceCampaignCollaboration.findUnique({
          where: {
            campaignId_instagramHandle: { campaignId, instagramHandle: handle },
          },
        })
      : null;

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId },
      select: {
        brandProfile: { select: { domain: true } },
      },
    });

    const basePath = `/marketplace/${campaignId}`;
    const token = collab?.invitationToken ?? null;
    const shareUrl = token
      ? `${origin}${basePath}?invite_token=${encodeURIComponent(token)}`
      : `${origin}${basePath}`;

    const brandSlug = campaign?.brandProfile?.domain
      ? domainToPublicSlug(campaign.brandProfile.domain)
      : null;
    const brandLandingUrl = brandSlug
      ? `${origin}/brand/${encodeURIComponent(brandSlug)}`
      : null;

    return {
      campaign_id: campaignId,
      share_url: shareUrl,
      brand_landing_url: brandLandingUrl,
      invite_token: token,
      uses_invitation_token: token !== null,
    };
  }

  private formatExecutionWindow(
    strategy: {
      timelineType: string;
      fixedStartDate: Date | null;
      fixedEndDate: Date | null;
      dynamicDaysLimit: number | null;
    } | null,
  ): string | null {
    if (!strategy) return null;
    if (strategy.fixedStartDate && strategy.fixedEndDate) {
      return `${strategy.fixedStartDate.toISOString().slice(0, 10)} – ${strategy.fixedEndDate.toISOString().slice(0, 10)}`;
    }
    if (strategy.dynamicDaysLimit) {
      return `${strategy.dynamicDaysLimit} day milestone window`;
    }
    return null;
  }

  private formatChannels(deliverables: PlatformDeliverable[] | null): string[] {
    if (!deliverables?.length) return [];
    const channels = new Set<string>();
    for (const block of deliverables) {
      if (block.platform) channels.add(block.platform);
    }
    return [...channels];
  }

  private resolveAccessTier(instagramHandle: string | null): CreatorAccessTier {
    return instagramHandle?.trim() ? "FULL" : "SOCIAL_PENDING";
  }

  private campaignMatchesDeliverableFilter(
    briefs: Array<{
      deliverableFormatTags: string[];
      requiredPlatforms: string[];
    }>,
    platformDeliverables: unknown,
    filter: string,
  ): boolean {
    const deliverables = (platformDeliverables as PlatformDeliverable[]) ?? [];
    for (const block of deliverables) {
      for (const format of block.formats) {
        const mapped = this.mapFormatToFilter(block.platform, format);
        if (mapped === filter) {
          return true;
        }
      }
    }

    for (const brief of briefs) {
      for (const tag of brief.deliverableFormatTags) {
        const mapped = DELIVERABLE_TAG_TO_FILTER[tag.toLowerCase()];
        if (mapped === filter) {
          return true;
        }
      }
      for (const platform of brief.requiredPlatforms) {
        const mapped = this.mapFormatToFilter(platform, tagFromPlatform(platform));
        if (mapped === filter) {
          return true;
        }
      }
    }

    return false;
  }

  private mapFormatToFilter(platform: string, format: string): string | null {
    const key = `${platform}_${format}`.toLowerCase();
    if (key.includes("instagram") && format.toLowerCase().includes("reel")) {
      return "INSTAGRAM_REEL";
    }
    if (key.includes("instagram") && format.toLowerCase().includes("story")) {
      return "INSTAGRAM_STORY";
    }
    if (key.includes("tiktok")) {
      return "TIKTOK_VIDEO";
    }
    if (key.includes("youtube") || format.toLowerCase().includes("short")) {
      return "YOUTUBE_SHORTS";
    }
    return DELIVERABLE_TAG_TO_FILTER[format.toLowerCase()] ?? null;
  }

  private campaignMatchesTimelineFilter(
    strategy: {
      dynamicDaysLimit: number | null;
      fixedEndDate: Date | null;
    } | null,
    timelines: string[],
  ): boolean {
    if (!strategy) {
      return true;
    }

    let daysRemaining: number | null = null;
    if (strategy.fixedEndDate) {
      const ms = strategy.fixedEndDate.getTime() - Date.now();
      daysRemaining = Math.ceil(ms / (24 * 60 * 60 * 1000));
    } else if (strategy.dynamicDaysLimit) {
      daysRemaining = strategy.dynamicDaysLimit;
    }

    if (daysRemaining === null) {
      return true;
    }

    const wantsUrgent = timelines.includes("URGENT_PIPELINE");
    const wantsStandard = timelines.includes("STANDARD_RUNWAY");

    if (wantsUrgent && daysRemaining < 7) {
      return true;
    }
    if (wantsStandard && daysRemaining >= 7 && daysRemaining <= 15) {
      return true;
    }

    return false;
  }

  private brandSlugWhere(brandSlug?: string): Prisma.UceCampaignWhereInput {
    if (!brandSlug?.trim()) {
      return {};
    }
    const domain = publicSlugToDomain(brandSlug.trim());
    return {
      brandProfile: {
        domain: {
          equals: domain,
          mode: "insensitive",
        },
      },
    };
  }

  private assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }
}

function tagFromPlatform(platform: string): string {
  switch (platform.toUpperCase()) {
    case "INSTAGRAM":
      return "reel";
    case "TIKTOK":
      return "tiktok";
    case "YOUTUBE":
      return "shorts";
    default:
      return platform.toLowerCase();
  }
}

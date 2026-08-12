import { Injectable, NotFoundException } from "@nestjs/common";
import { UceCampaignStatus, UceCollabStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CampaignApplicationService } from "./campaign-application.service";
import { resolveHydrationOutcome } from "./campaign-query.hydration";

export type SurfaceState = "READY" | "EMPTY" | "UNAVAILABLE" | "ERROR";
export type CapabilityPresentation = "ENABLED" | "DISABLED" | "HIDDEN";

const enabled = { available: true, presentation: "ENABLED" as const };
const disabled = {
  available: false,
  presentation: "DISABLED" as const,
  reasonCategory: "CAPABILITY_UNAVAILABLE",
};
const hidden = {
  available: false,
  presentation: "HIDDEN" as const,
  reasonCategory: "CAPABILITY_UNAVAILABLE",
};

/** Read-only Campaign Page composition. Never exposes raw Prisma records as the View DTO. */
@Injectable()
export class CampaignQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: CampaignApplicationService,
  ) {}

  async getCampaignPage(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      include: {
        products: {
          orderBy: { createdAt: "asc" },
          include: { briefs: { orderBy: { createdAt: "asc" } } },
        },
        strategy: true,
        targeting: true,
        commercials: true,
        performanceAggregate: true,
        collaborations: {
          select: { id: true, collabStatus: true },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    const [executionReady, applicationCounts, provenanceRows] = await Promise.all([
      this.resolveExecutionReady(campaignId),
      this.resolveApplicationCounts(campaignId),
      this.prisma.$queryRaw<Array<{ creation_source: string | null }>>`
        SELECT "creation_source"
        FROM "uce_campaigns"
        WHERE "id" = ${campaignId}
        LIMIT 1
      `,
    ]);
    const creationSource =
      provenanceRows[0]?.creation_source === "AI_RECOMMENDED"
        ? ("AI_RECOMMENDED" as const)
        : ("MANUAL" as const);

    const status = campaign.status;
    const isLive = status === UceCampaignStatus.LIVE;
    const operational = isLive && executionReady;
    const paused = status === UceCampaignStatus.PAUSED;
    const historical =
      status === UceCampaignStatus.COMPLETED ||
      status === UceCampaignStatus.ARCHIVED;
    const postLiveReadinessBlocked = isLive && !executionReady;
    const published = status === UceCampaignStatus.PUBLISHED;

    const products = campaign.products.map((product) => ({
      campaignAssetId: product.id,
      name: product.productName,
      status: product.isActive ? ("ACTIVE" as const) : ("PAUSED" as const),
      briefs: product.briefs.map((brief) => ({
        briefId: brief.id,
        name: brief.internalTitle,
        status: brief.isActive ? ("PUBLISHED" as const) : ("PAUSED" as const),
      })),
    }));
    const activeProducts = products.filter((p) => p.status === "ACTIVE");
    const activeBriefCount = activeProducts.reduce(
      (n, product) =>
        n + product.briefs.filter((brief) => brief.status === "PUBLISHED").length,
      0,
    );

    const hydration = resolveHydrationOutcome({
      status,
      executionReady,
      activeProductCount: activeProducts.length,
    });

    const share = operational ? enabled : disabled;
    const discoveryStatuses: UceCollabStatus[] = [
      UceCollabStatus.PROSPECT_CURATED,
      UceCollabStatus.PROSPECT_INVITED,
    ];
    const collaborationStatuses: UceCollabStatus[] = [
      UceCollabStatus.ACTIVE_WORKFLOW,
    ];
    const discoveryInstantiated = campaign.collaborations.some((c) =>
      discoveryStatuses.includes(c.collabStatus),
    );
    const collaborationsInstantiated = campaign.collaborations.some((c) =>
      collaborationStatuses.includes(c.collabStatus),
    );
    const applicantsInstantiated = applicationCounts.total > 0;
    const preserveOperationalWorkspaces = isLive || paused || historical;
    const discoveryVisible =
      preserveOperationalWorkspaces && (discoveryInstantiated || operational);
    const applicantsVisible =
      preserveOperationalWorkspaces && applicantsInstantiated;
    const collaborationsVisible =
      preserveOperationalWorkspaces && collaborationsInstantiated;
    const reportingAvailable = isLive || paused || historical;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        lifecycleStatus: status,
        creationSource,
        productCount: activeProducts.length,
        briefCount: activeBriefCount,
        capabilities: {
          view: enabled,
          edit: historical ? disabled : enabled,
          share,
          pause: status === UceCampaignStatus.LIVE ? enabled : disabled,
          resume: paused ? enabled : disabled,
          complete:
            status === UceCampaignStatus.LIVE || paused ? enabled : disabled,
          archive: status === UceCampaignStatus.COMPLETED ? enabled : disabled,
          publish: status === UceCampaignStatus.DRAFT ? enabled : disabled,
          goLive: status === UceCampaignStatus.PUBLISHED ? enabled : disabled,
        },
      },
      hydration: {
        outcome: hydration,
        executionReady,
        primaryFocus: postLiveReadinessBlocked
          ? "RESTORE_CAMPAIGN_READINESS"
          : operational
            ? "DISCOVERY"
            : historical
              ? "REVIEW_AND_REPORTING"
              : paused
                ? "RESUME_OR_EXISTING_EXECUTION"
                : published && activeProducts.length === 0
                  ? "PRODUCT"
                  : published
                    ? "BRIEF"
                    : "CAMPAIGN",
        postLiveReadinessBlocked,
      },
      productsBriefsSummary: {
        state: (products.length ? "READY" : "EMPTY") as SurfaceState,
        label: "Products & Briefs",
        capability: historical ? disabled : enabled,
        products,
      },
      copilotSummary: {
        state: (operational || paused
          ? "READY"
          : "UNAVAILABLE") as SurfaceState,
        label: "Campaign Copilot",
        summary:
          operational || paused
            ? creationSource === "AI_RECOMMENDED"
              ? "Continue the AI-recommended Campaign with current creator and applicant signals."
              : "Prioritize highest-match prospects and pending applicants."
            : undefined,
        actions: operational
          ? [
              {
                id: "new-creators",
                label: "Review",
                context: "Review Discovery prospects",
                action: "DISCOVERY",
              },
            ]
          : [],
      },
      performanceSummary: {
        state: (reportingAvailable ? "READY" : "UNAVAILABLE") as SurfaceState,
        label: "Performance",
        capability: reportingAvailable ? enabled : disabled,
        metrics: reportingAvailable
          ? [
              {
                metricId: "prospects",
                label: "Prospects",
                value: String(
                  campaign.performanceAggregate?.totalProspectsCount ?? 0,
                ),
                tone: "neutral" as const,
              },
              {
                metricId: "applicants",
                label: "Applicants",
                value: String(applicationCounts.total),
                tone: "attention" as const,
              },
            ]
          : [],
      },
      workspaces: [
        {
          workspace: "DISCOVERY" as const,
          state: (discoveryVisible ? "READY" : "UNAVAILABLE") as SurfaceState,
          instantiated: discoveryInstantiated || operational,
          visible: discoveryVisible,
          count: campaign.performanceAggregate?.totalProspectsCount ?? 0,
          expand: discoveryVisible ? enabled : disabled,
        },
        {
          workspace: "APPLICANTS" as const,
          state: (applicantsVisible ? "READY" : "UNAVAILABLE") as SurfaceState,
          instantiated: applicantsInstantiated,
          visible: applicantsVisible,
          count: applicationCounts.total,
          pendingCount: applicationCounts.pending,
          rejectedCount: applicationCounts.rejected,
          expand: applicantsVisible ? enabled : disabled,
        },
        {
          workspace: "COLLABORATIONS" as const,
          state: (collaborationsVisible ? "READY" : "UNAVAILABLE") as SurfaceState,
          instantiated: collaborationsInstantiated,
          visible: collaborationsVisible,
          expand: collaborationsVisible ? enabled : hidden,
        },
      ],
      share: {
        capability: share,
        supportedChannels: operational
          ? (["COPY_LINK", "WHATSAPP", "INSTAGRAM"] as const)
          : [],
      },
      details: {
        state: "READY" as SurfaceState,
        objective: campaign.strategy?.coreObjective ?? null,
        platforms: campaign.strategy?.platformDeliverables ?? null,
        visibilityScopes: campaign.targeting?.visibilityScopes ?? [],
        compensationType: campaign.commercials?.compensationType ?? null,
        budgetPool: campaign.commercials
          ? Number(campaign.commercials.totalCampaignBudgetPool)
          : null,
        timelineType: campaign.strategy?.timelineType ?? null,
      },
    };
  }

  async getDiscovery(brandProfileId: string, campaignId: string) {
    await this.requireOwned(brandProfileId, campaignId);
    const rows = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        campaignId,
        collabStatus: {
          in: [
            UceCollabStatus.PROSPECT_CURATED,
            UceCollabStatus.PROSPECT_INVITED,
          ],
        },
      },
      take: 50,
      orderBy: { updatedAt: "desc" },
    });

    const creators = [];
    for (const row of rows) {
      const normalized = row.instagramHandle
        .trim()
        .replace(/^@/, "")
        .toLowerCase();
      const creator = await this.prisma.uceCampaignCreator.upsert({
        where: {
          campaignId_platform_normalizedSocialHandle: {
            campaignId,
            platform: "INSTAGRAM",
            normalizedSocialHandle: normalized,
          },
        },
        create: {
          campaignId,
          creatorProfileId: row.creatorProfileId,
          platform: "INSTAGRAM",
          socialHandle: row.instagramHandle,
          normalizedSocialHandle: normalized,
          email: row.creatorEmail,
          source: "MANUAL",
          ingestionMethod: "MANUAL_SINGLE",
        },
        update: {
          creatorProfileId: row.creatorProfileId ?? undefined,
          email: row.creatorEmail,
        },
      });
      creators.push({
        campaignCreatorId: creator.id,
        collaborationId: row.id,
        name: row.instagramHandle,
        category: "Creator",
        followers: "—",
        engagement: "—",
        avatarInitials: row.instagramHandle.slice(0, 2).toUpperCase(),
        contextLabel:
          row.collabStatus === UceCollabStatus.PROSPECT_INVITED
            ? "Invited"
            : "New",
      });
    }

    return {
      state: (creators.length ? "READY" : "EMPTY") as SurfaceState,
      creators,
    };
  }

  async getApplicants(brandProfileId: string, campaignId: string) {
    return this.applications.listApplicants(brandProfileId, campaignId);
  }

  async getProductDetails(
    brandProfileId: string,
    campaignId: string,
    campaignAssetId: string,
  ) {
    await this.requireOwned(brandProfileId, campaignId);
    const product = await this.prisma.uceCampaignProduct.findFirst({
      where: { id: campaignAssetId, campaignId },
      include: { briefs: { orderBy: { createdAt: "asc" } } },
    });
    if (!product) throw new NotFoundException("Product not found");
    return {
      state: "READY" as SurfaceState,
      campaignAssetId: product.id,
      name: product.productName,
      status: product.isActive ? ("ACTIVE" as const) : ("PAUSED" as const),
      skuCode: product.skuCode,
      inventoryCount: product.inventoryCount,
      imageUrl: product.imageUrl,
      briefs: product.briefs.map((brief) => ({
        briefId: brief.id,
        name: brief.internalTitle,
        status: brief.isActive ? ("PUBLISHED" as const) : ("PAUSED" as const),
      })),
    };
  }

  async getBriefDetails(
    brandProfileId: string,
    campaignId: string,
    briefId: string,
  ) {
    await this.requireOwned(brandProfileId, campaignId);
    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: briefId, campaignId },
      include: { product: true },
    });
    if (!brief) throw new NotFoundException("Brief not found");
    return {
      state: "READY" as SurfaceState,
      briefId: brief.id,
      name: brief.internalTitle,
      status: brief.isActive ? ("PUBLISHED" as const) : ("PAUSED" as const),
      campaignAssetId: brief.productId,
      productName: brief.product?.productName ?? null,
      briefType: brief.briefType,
      creativeGuidelines: brief.creativeGuidelines,
      deliverableFormatTags: brief.deliverableFormatTags,
      requiredPlatforms: brief.requiredPlatforms,
    };
  }

  async getCreatorProfile(
    brandProfileId: string,
    campaignId: string,
    campaignCreatorId: string,
  ) {
    await this.requireOwned(brandProfileId, campaignId);
    const creator = await this.prisma.uceCampaignCreator.findFirst({
      where: { id: campaignCreatorId, campaignId },
      include: {
        applications: {
          orderBy: { appliedAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            source: true,
            appliedAt: true,
            briefId: true,
            campaignAssetId: true,
          },
        },
      },
    });
    if (!creator) throw new NotFoundException("Campaign creator not found");
    return {
      state: "READY" as SurfaceState,
      campaignCreatorId: creator.id,
      name: creator.socialHandle,
      email: creator.email,
      platform: creator.platform,
      source: creator.source,
      reviewState: creator.reviewState,
      applications: creator.applications.map((app) => ({
        applicationId: app.id,
        status: app.status,
        source: app.source,
        appliedAt: app.appliedAt.toISOString(),
        briefId: app.briefId,
        campaignAssetId: app.campaignAssetId,
      })),
    };
  }

  private async requireOwned(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
  }

  private async resolveExecutionReady(campaignId: string): Promise<boolean> {
    const activeAssetWithBrief = await this.prisma.uceCampaignProduct.findFirst({
      where: {
        campaignId,
        isActive: true,
        briefs: { some: { isActive: true } },
      },
      select: { id: true },
    });
    return activeAssetWithBrief != null;
  }

  private async resolveApplicationCounts(campaignId: string) {
    const [total, pending, rejected] = await Promise.all([
      this.prisma.uceApplication.count({ where: { campaignId } }),
      this.prisma.uceApplication.count({ where: { campaignId, status: "PENDING" } }),
      this.prisma.uceApplication.count({ where: { campaignId, status: "REJECTED" } }),
    ]);
    return { total, pending, rejected };
  }
}

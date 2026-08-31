import { Injectable, NotFoundException } from "@nestjs/common";
import {
  UceCampaignAssetStatus,
  UceCampaignStatus,
  UceCollabStatus,
} from "@prisma/client";

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

const readinessRemediation: Record<string, string> = {
  campaign_asset: "Link a canonical Campaign Asset from Brand Centre.",
  canonical_brief: "Create a canonical Brief beneath an active Campaign Asset.",
  campaign_budget: "Configure a positive Campaign budget.",
};

type CampaignPageReadinessInput = {
  status: UceCampaignStatus;
  budgetPool: number | null;
  assets: Array<{
    status: UceCampaignAssetStatus;
    briefs: Array<{
      isActive: boolean;
      title: string;
      creativeRequirements: string;
      deliverables: Array<{
        quantity: number;
        creativeRequirements: string;
      }>;
    }>;
  }>;
};

export function resolveCampaignPageReadiness(
  input: CampaignPageReadinessInput,
) {
  const activeAssets = input.assets.filter(
    (asset) => asset.status === UceCampaignAssetStatus.ACTIVE,
  );
  const readyBriefs = activeAssets.flatMap((asset) =>
    asset.briefs.filter(
      (brief) =>
        brief.isActive &&
        brief.title.trim().length >= 5 &&
        brief.creativeRequirements.trim().length >= 10 &&
        brief.deliverables.length > 0 &&
        brief.deliverables.every(
          (deliverable) =>
            deliverable.quantity > 0 &&
            deliverable.creativeRequirements.trim().length >= 5,
        ),
    ),
  );
  const missingRequirements = [
    ...(activeAssets.length > 0 ? [] : ["campaign_asset"]),
    ...(readyBriefs.length > 0 ? [] : ["canonical_brief"]),
    ...(input.budgetPool != null && input.budgetPool > 0
      ? []
      : ["campaign_budget"]),
  ];
  const ready = missingRequirements.length === 0;
  const terminal =
    input.status === UceCampaignStatus.COMPLETED ||
    input.status === UceCampaignStatus.ARCHIVED;

  return {
    ready,
    missingRequirements,
    activeAssetCount: activeAssets.length,
    readyBriefCount: readyBriefs.length,
    capabilities: {
      canEdit: !terminal,
      canCreateBrief: !terminal && activeAssets.length > 0,
      canPublish: input.status === UceCampaignStatus.DRAFT,
      canGoLive: input.status === UceCampaignStatus.PUBLISHED && ready,
      canPause: input.status === UceCampaignStatus.LIVE,
      canResume: input.status === UceCampaignStatus.PAUSED && ready,
      canUseOperationalWorkspaces:
        input.status === UceCampaignStatus.LIVE && ready,
    },
  };
}

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
        assets: {
          where: {
            OR: [
              { brandProfileId },
              { offering: { brandProfileId } },
              { brandOffer: { brandProfileId } },
            ],
          },
          orderBy: { createdAt: "asc" },
          include: {
            brandProfile: { select: { name: true, logoUrl: true } },
            offering: {
              select: {
                name: true,
                type: true,
                canonicalKind: true,
                imageUrl: true,
                mediaState: {
                  select: { primaryMediaAsset: { select: { url: true } } },
                },
              },
            },
            brandOffer: { select: { offerName: true } },
            canonicalBriefs: {
              orderBy: { createdAt: "asc" },
              include: { deliverables: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
        strategy: true,
        targeting: true,
        commercials: true,
        collaborations: {
          select: { id: true, collabStatus: true },
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    const [applicationCounts, provenanceRows] = await Promise.all([
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
    const paused = status === UceCampaignStatus.PAUSED;
    const historical =
      status === UceCampaignStatus.COMPLETED ||
      status === UceCampaignStatus.ARCHIVED;
    const canonicalAssets = campaign.assets.map((asset) => ({
      campaignAssetId: asset.id,
      kind: asset.kind,
      status: asset.status,
      entityId:
        asset.brandProfileId ?? asset.offeringId ?? asset.brandOfferId ?? null,
      name:
        asset.brandProfile?.name ??
        asset.offering?.name ??
        asset.brandOffer?.offerName ??
        "Brand Centre Asset",
      subtype: asset.offering?.canonicalKind ?? asset.offering?.type ?? null,
      imageUrl:
        asset.brandProfile?.logoUrl ??
        asset.offering?.mediaState?.primaryMediaAsset?.url ??
        asset.offering?.imageUrl ??
        null,
      briefs: asset.canonicalBriefs.map((brief) => ({
        briefId: brief.id,
        name: brief.title,
        status: brief.isActive ? ("PUBLISHED" as const) : ("PAUSED" as const),
        creativeRequirements: brief.creativeRequirements,
        deliverables: brief.deliverables.map((deliverable) => ({
          deliverableId: deliverable.id,
          format: deliverable.format,
          quantity: deliverable.quantity,
          creativeRequirements: deliverable.creativeRequirements,
          publishingRequired: deliverable.publishingRequired,
        })),
      })),
    }));
    const readiness = resolveCampaignPageReadiness({
      status,
      budgetPool: campaign.commercials
        ? Number(campaign.commercials.totalCampaignBudgetPool)
        : null,
      assets: campaign.assets.map((asset) => ({
        status: asset.status,
        briefs: asset.canonicalBriefs.map((brief) => ({
          isActive: brief.isActive,
          title: brief.title,
          creativeRequirements: brief.creativeRequirements,
          deliverables: brief.deliverables,
        })),
      })),
    });
    const executionReady = readiness.ready;
    const operational = readiness.capabilities.canUseOperationalWorkspaces;
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
    const activeLegacyProducts = products.filter((p) => p.status === "ACTIVE");
    const activeLegacyBriefCount = activeLegacyProducts.reduce(
      (n, product) =>
        n +
        product.briefs.filter((brief) => brief.status === "PUBLISHED").length,
      0,
    );

    const hydration = resolveHydrationOutcome({
      status,
      executionReady,
      activeProductCount: readiness.activeAssetCount,
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
    const workspaceCapability = operational ? enabled : disabled;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        lifecycleStatus: status,
        creationSource,
        assetCount: readiness.activeAssetCount,
        canonicalBriefCount: readiness.readyBriefCount,
        legacyProductCount: activeLegacyProducts.length,
        legacyBriefCount: activeLegacyBriefCount,
        capabilities: {
          view: enabled,
          edit: readiness.capabilities.canEdit ? enabled : disabled,
          createBrief: readiness.capabilities.canCreateBrief
            ? enabled
            : disabled,
          share,
          pause: readiness.capabilities.canPause ? enabled : disabled,
          resume: readiness.capabilities.canResume ? enabled : disabled,
          complete:
            status === UceCampaignStatus.LIVE || paused ? enabled : disabled,
          archive: status === UceCampaignStatus.COMPLETED ? enabled : disabled,
          publish: readiness.capabilities.canPublish ? enabled : disabled,
          goLive: readiness.capabilities.canGoLive ? enabled : disabled,
          useOperationalWorkspaces: workspaceCapability,
        },
      },
      readiness: {
        ready: readiness.ready,
        missingRequirements: readiness.missingRequirements,
        remediation: readiness.missingRequirements.map((requirement) => ({
          requirement,
          message: readinessRemediation[requirement],
        })),
        activeAssetCount: readiness.activeAssetCount,
        readyBriefCount: readiness.readyBriefCount,
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
                : published && readiness.activeAssetCount === 0
                  ? "CAMPAIGN_ASSET"
                  : published
                    ? "CANONICAL_BRIEF"
                    : "CAMPAIGN",
        postLiveReadinessBlocked,
      },
      assetsBriefsSummary: {
        state: (canonicalAssets.length ? "READY" : "EMPTY") as SurfaceState,
        label: "Campaign Assets & Briefs",
        capability: historical ? disabled : enabled,
        assets: canonicalAssets,
      },
      productsBriefsSummary: {
        authority: "LEGACY_COMPATIBILITY" as const,
        state: (products.length ? "READY" : "EMPTY") as SurfaceState,
        label: "Legacy Products & Briefs",
        capability: disabled,
        products,
      },
      copilotSummary: {
        state: "UNAVAILABLE" as SurfaceState,
        label: "Campaign Copilot",
        summary: undefined,
        actions: [],
      },
      performanceSummary: {
        state: "UNAVAILABLE" as SurfaceState,
        label: "Performance",
        capability: disabled,
        metrics: [],
        message: "Reporting is not available for this Campaign yet.",
      },
      workspaces: [
        {
          workspace: "discovery" as const,
          state: (operational
            ? discoveryInstantiated
              ? "READY"
              : "EMPTY"
            : "UNAVAILABLE") as SurfaceState,
          instantiated: discoveryInstantiated,
          visible: true,
          count: campaign.collaborations.filter((collaboration) =>
            discoveryStatuses.includes(collaboration.collabStatus),
          ).length,
          expand: workspaceCapability,
        },
        {
          workspace: "applicants" as const,
          state: (operational
            ? applicantsInstantiated
              ? "READY"
              : "EMPTY"
            : "UNAVAILABLE") as SurfaceState,
          instantiated: applicantsInstantiated,
          visible: true,
          count: applicationCounts.total,
          pendingCount: applicationCounts.pending,
          rejectedCount: applicationCounts.rejected,
          expand: workspaceCapability,
        },
        {
          workspace: "collaborations" as const,
          state: (operational
            ? collaborationsInstantiated
              ? "READY"
              : "EMPTY"
            : "UNAVAILABLE") as SurfaceState,
          instantiated: collaborationsInstantiated,
          visible: true,
          count: campaign.collaborations.filter((collaboration) =>
            collaborationStatuses.includes(collaboration.collabStatus),
          ).length,
          expand: operational
            ? workspaceCapability
            : collaborationsInstantiated
              ? disabled
              : hidden,
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
    const rows = await this.prisma.uceCampaignCreator.findMany({
      where: { campaignId, archivedAt: null },
      take: 50,
      orderBy: { updatedAt: "desc" },
    });

    const creators = rows.map((row) => ({
      campaignCreatorId: row.id,
      name: row.socialHandle,
      category: "Creator",
      followers: "-",
      engagement: "-",
      avatarInitials: row.socialHandle.slice(0, 2).toUpperCase(),
      contextLabel: "Saved",
      source: row.source,
      intelligenceStatus: "UNAVAILABLE" as const,
    }));

    return {
      state: (creators.length ? "READY" : "EMPTY") as SurfaceState,
      creators,
      provider: {
        availability: "UNAVAILABLE" as const,
        message:
          "Creator recommendations are not available for this Campaign yet.",
        results: [],
      },
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

  private async resolveApplicationCounts(campaignId: string) {
    const [total, pending, rejected] = await Promise.all([
      this.prisma.uceApplication.count({ where: { campaignId } }),
      this.prisma.uceApplication.count({
        where: { campaignId, status: "PENDING" },
      }),
      this.prisma.uceApplication.count({
        where: { campaignId, status: "REJECTED" },
      }),
    ]);
    return { total, pending, rejected };
  }
}

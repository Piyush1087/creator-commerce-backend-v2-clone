import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  UceCampaignObjective,
  UceCampaignStatus,
  UceCollabStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CreateCampaignWizardDto } from "../dto/brand-uce-campaign.dto";
import { IntegratedCampaignWizardPayloadSchema } from "../schemas/uce-wizard.schema";
import {
  campaignCurrencyForBrandCountry,
  campaignVisibilityToPersistence,
  compensationModelToPersistence,
  publishCampaignInputSchema,
  updateDraftCampaignInputSchema,
} from "../validation";
import { decimalToNumber } from "../utils/uce-decimal.util";
import { BrandUceAccessService } from "./brand-uce-access.service";

const PROSPECT_STATUSES = [
  "PROSPECT_CURATED",
  "PROSPECT_INVITED",
] as const;

const APPLICANT_STATUSES = [
  "APPLICANT_PENDING",
  "APPLICANT_SHORTLISTED",
  "APPLICANT_REJECTED",
] as const;

const ESSENTIALS_EDIT_BLOCKING_STATUSES: UceCollabStatus[] = [
  UceCollabStatus.APPLICANT_PENDING,
  UceCollabStatus.APPLICANT_SHORTLISTED,
  UceCollabStatus.ACTIVE_WORKFLOW,
  UceCollabStatus.ARCHIVED_COMPLETE,
];

@Injectable()
export class BrandUceCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async listAggregates(brandProfileId: string) {
    const campaigns = await this.prisma.uceCampaign.findMany({
      where: { brandProfileId, status: UceCampaignStatus.LIVE },
      include: { performanceAggregate: true },
    });

    let totalActiveSpend = 0;
    let totalImpressions = 0n;
    let pipelineBottlenecks = 0;

    for (const c of campaigns) {
      const agg = c.performanceAggregate;
      if (agg) {
        totalActiveSpend += decimalToNumber(agg.totalSpendToDate);
        totalImpressions += agg.totalImpressionsCount;
        pipelineBottlenecks +=
          agg.totalApplicantsCount + agg.totalActiveCollabsCount;
      }
    }

    return {
      total_active_spend: totalActiveSpend,
      total_impressions: totalImpressions.toString(),
      pipeline_bottlenecks: pipelineBottlenecks,
      active_campaign_count: campaigns.length,
    };
  }

  async listCampaigns(
    brandProfileId: string,
    filters: {
      status?: UceCampaignStatus;
      search?: string;
      objective?: UceCampaignObjective;
      product?: string;
      sortBy?: "updatedAt" | "name" | "budget" | "spend";
      sortDir?: "asc" | "desc";
    },
  ) {
    const where: Prisma.UceCampaignWhereInput = { brandProfileId };
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search?.trim()) {
      where.name = { contains: filters.search.trim(), mode: "insensitive" };
    }
    if (filters.objective) {
      where.strategy = { coreObjective: filters.objective };
    }
    if (filters.product?.trim()) {
      where.products = {
        some: {
          productName: {
            contains: filters.product.trim(),
            mode: "insensitive",
          },
        },
      };
    }

    const sortBy = filters.sortBy ?? "updatedAt";
    const sortDir = filters.sortDir ?? "desc";
    let orderBy: Prisma.UceCampaignOrderByWithRelationInput = {
      updatedAt: sortDir,
    };
    if (sortBy === "name") {
      orderBy = { name: sortDir };
    }

    const campaigns = await this.prisma.uceCampaign.findMany({
      where,
      orderBy,
      include: {
        performanceAggregate: true,
        strategy: true,
        commercials: true,
        _count: {
          select: {
            products: true,
            briefs: true,
            collaborations: true,
          },
        },
        collaborations: {
          select: { collabStatus: true },
        },
      },
    });

    const mapped = campaigns.map((c) => {
      const agg = c.performanceAggregate;
      const prospects = c.collaborations.filter((x) =>
        (PROSPECT_STATUSES as readonly string[]).includes(x.collabStatus),
      ).length;
      const applicants = c.collaborations.filter((x) =>
        (APPLICANT_STATUSES as readonly string[]).includes(x.collabStatus),
      ).length;
      const activeCollabs = c.collaborations.filter(
        (x) => x.collabStatus === "ACTIVE_WORKFLOW",
      ).length;

      const budgetPool = c.commercials
        ? decimalToNumber(c.commercials.totalCampaignBudgetPool)
        : 0;
      const spend = agg ? decimalToNumber(agg.totalSpendToDate) : 0;

      return {
        campaign_id: c.id,
        campaign_name: c.name,
        current_status: c.status,
        core_objective: c.strategy?.coreObjective ?? null,
        product_count: c._count.products,
        brief_count: c._count.briefs,
        prospects_count: prospects,
        applicants_count: applicants,
        active_collabs_count: activeCollabs,
        total_spend_to_date: spend,
        total_impressions: agg
          ? agg.totalImpressionsCount.toString()
          : "0",
        budget_pool: budgetPool,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
      };
    });

    if (sortBy === "budget") {
      mapped.sort((a, b) =>
        sortDir === "asc"
          ? a.budget_pool - b.budget_pool
          : b.budget_pool - a.budget_pool,
      );
    } else if (sortBy === "spend") {
      mapped.sort((a, b) =>
        sortDir === "asc"
          ? a.total_spend_to_date - b.total_spend_to_date
          : b.total_spend_to_date - a.total_spend_to_date,
      );
    }

    return mapped;
  }

  async createFromWizard(
    brandProfileId: string,
    body: CreateCampaignWizardDto,
  ) {
    const parsed = IntegratedCampaignWizardPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: "Wizard payload validation failed",
        issues: parsed.error.flatten(),
      });
    }

    const { strategy, targeting, commercials } = parsed.data;

    // Phase 1 adapters: product vocab → persistence enums.
    const visibilityScopes = targeting.campaign_visibility
      ? [
          campaignVisibilityToPersistence[
            targeting.campaign_visibility as keyof typeof campaignVisibilityToPersistence
          ],
        ]
      : targeting.visibility_scopes;
    const compensationType =
      commercials.compensation_type === "FIXED" ||
      commercials.compensation_type === "FIXED_FEE"
        ? compensationModelToPersistence.FIXED
        : compensationModelToPersistence.NEGOTIABLE;

    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { countryCode: true },
    });
    // Currency is Brand-derived (Phase 1); not Brand free-input on Campaign.
    // Resolved for Publish/readiness; not Brand-authored Campaign input.
    void campaignCurrencyForBrandCountry(brand?.countryCode ?? "US");

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.uceCampaign.create({
        data: {
          brandProfileId,
          name: strategy.campaign_name,
          status: UceCampaignStatus.DRAFT,
          performanceAggregate: { create: {} },
          strategy: {
            create: {
              timelineType: strategy.timeline_type,
              fixedStartDate: strategy.fixed_start_date
                ? new Date(strategy.fixed_start_date)
                : null,
              fixedEndDate: strategy.fixed_end_date
                ? new Date(strategy.fixed_end_date)
                : null,
              dynamicDaysLimit: strategy.dynamic_days_limit ?? null,
              coreObjective: strategy.core_objective,
              // Keep deliverables array shape for shell consumers; currency is service-derived.
              platformDeliverables:
                strategy.platform_deliverables as Prisma.InputJsonValue,
            },
          },
          targeting: {
            create: {
              industryVertical: targeting.industry_vertical,
              creatorArchetypes: targeting.creator_archetypes,
              followerTiers: targeting.follower_tiers,
              audienceAgeMin: targeting.audience_age_min,
              audienceAgeMax: targeting.audience_age_max,
              audienceGender: targeting.audience_gender,
              targetLocations: targeting.target_locations,
              disqualifyingKeywords: targeting.disqualifying_keywords,
              visibilityScopes,
              applicationScope: targeting.application_scope,
            },
          },
          commercials: {
            create: {
              compensationType,
              fixedFeeAmount: commercials.fixed_fee_amount,
              negotiableMinFee: commercials.negotiable_min_fee,
              negotiableMaxFee: commercials.negotiable_max_fee,
              totalCampaignBudgetPool: commercials.total_campaign_budget_pool,
              advancePaymentPercentage: commercials.advance_payment_percentage,
              finalBalanceTerms: commercials.final_balance_terms,
            },
          },
        },
        include: {
          strategy: true,
          targeting: true,
          commercials: true,
        },
      });

      await tx.uceCampaignReportingSnapshot.create({
        data: {
          campaignId: created.id,
          primaryObjective: strategy.core_objective,
          lastApiSyncTimestamp: new Date(),
        },
      });

      return created;
    });

    return this.getCampaignShell(brandProfileId, campaign.id);
  }

  async getCampaignShell(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      include: {
        strategy: true,
        targeting: true,
        commercials: true,
        performanceAggregate: true,
        products: { orderBy: { createdAt: "asc" } },
        briefs: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!campaign) {
      throw new BadRequestException("Campaign not found");
    }

    const activationChecklist = await this.buildActivationChecklist(campaign.id);
    const canEditEssentials = await this.canEditCampaignEssentials(campaign.id);
    const totalInventoryAllocated = campaign.products.reduce(
      (sum, product) => sum + product.inventoryCount,
      0,
    );

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      current_status: campaign.status,
      can_edit_essentials: canEditEssentials,
      total_inventory_allocated: totalInventoryAllocated,
      pause_warning:
        campaign.status === UceCampaignStatus.PAUSED
          ? "Campaign Paused. Inbound application links are offline. Active collaboration workflows remain accessible for processing."
          : null,
      zone_1_master: campaign.strategy
        ? {
            timeline_type: campaign.strategy.timelineType,
            fixed_start_date: campaign.strategy.fixedStartDate?.toISOString() ?? null,
            fixed_end_date: campaign.strategy.fixedEndDate?.toISOString() ?? null,
            dynamic_days_limit: campaign.strategy.dynamicDaysLimit,
            core_objective: campaign.strategy.coreObjective,
            platform_deliverables: campaign.strategy.platformDeliverables,
            budget_pool: campaign.commercials
              ? decimalToNumber(campaign.commercials.totalCampaignBudgetPool)
              : 0,
          }
        : null,
      zone_1_targeting: campaign.targeting
        ? {
            industry_vertical: campaign.targeting.industryVertical,
            creator_archetypes: campaign.targeting.creatorArchetypes,
            follower_tiers: campaign.targeting.followerTiers,
            audience_age_min: campaign.targeting.audienceAgeMin,
            audience_age_max: campaign.targeting.audienceAgeMax,
            audience_gender: campaign.targeting.audienceGender,
            target_locations: campaign.targeting.targetLocations,
            disqualifying_keywords: campaign.targeting.disqualifyingKeywords,
          }
        : null,
      zone_1_commercials: campaign.commercials
        ? {
            compensation_type: campaign.commercials.compensationType,
            fixed_fee_amount: decimalToNumber(campaign.commercials.fixedFeeAmount),
            negotiable_min_fee: decimalToNumber(campaign.commercials.negotiableMinFee),
            negotiable_max_fee: decimalToNumber(campaign.commercials.negotiableMaxFee),
            total_campaign_budget_pool: decimalToNumber(
              campaign.commercials.totalCampaignBudgetPool,
            ),
            advance_payment_percentage:
              campaign.commercials.advancePaymentPercentage,
            final_balance_terms: campaign.commercials.finalBalanceTerms,
          }
        : null,
      zone_2_tactics: {
        products: campaign.products.map((p) => ({
          product_id: p.id,
          asset_type: p.assetType,
          sku_code: p.skuCode,
          product_name: p.productName,
          inventory_count: p.inventoryCount,
          out_of_stock: p.inventoryCount <= 0,
          cost_per_unit: decimalToNumber(p.costPerUnit),
          image_url: p.imageUrl,
          asset_payload: p.assetPayload,
        })),
        briefs: campaign.briefs.map((b) => ({
          brief_id: b.id,
          product_id: b.productId,
          internal_title: b.internalTitle,
          creative_guidelines: b.creativeGuidelines,
          required_platforms: b.requiredPlatforms,
          deliverable_format_tags: b.deliverableFormatTags,
          brief_type: b.briefType,
          purpose: b.purpose,
          objective: b.objective,
          target_influencer_archetype: b.targetInfluencerArchetype,
          mandatory_creator_requirements: b.mandatoryCreatorRequirements,
          deliverables_inventory: b.deliverablesInventory,
          content_guidance_matrix: b.contentGuidanceMatrix,
          parent_planner_logistics_snapshot: b.parentPlannerLogisticsSnapshot,
          created_at: b.createdAt.toISOString(),
        })),
      },
      performance_aggregate: campaign.performanceAggregate
        ? {
            total_spend_to_date: decimalToNumber(
              campaign.performanceAggregate.totalSpendToDate,
            ),
            total_prospects_count:
              campaign.performanceAggregate.totalProspectsCount,
            total_applicants_count:
              campaign.performanceAggregate.totalApplicantsCount,
            total_active_collabs_count:
              campaign.performanceAggregate.totalActiveCollabsCount,
          }
        : null,
      activation_checklist: activationChecklist,
    };
  }

  async updateDraftWizard(
    brandProfileId: string,
    campaignId: string,
    body: {
      campaign_name?: string;
      budget_allocation?: number;
      marketing_objective?: UceCampaignObjective;
    },
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const draftPatch = updateDraftCampaignInputSchema.safeParse({
      name: body.campaign_name,
    });
    if (body.campaign_name !== undefined && !draftPatch.success) {
      throw new BadRequestException(draftPatch.error.flatten());
    }

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      include: { strategy: true, commercials: true },
    });
    if (!campaign) {
      throw new BadRequestException("Campaign not found");
    }
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException(
        "Only DRAFT campaigns can be edited from co-pilot.",
      );
    }

    if (body.campaign_name?.trim()) {
      await this.prisma.uceCampaign.update({
        where: { id: campaignId },
        data: { name: body.campaign_name.trim() },
      });
    }

    if (body.marketing_objective) {
      await this.prisma.uceCampaignStrategy.updateMany({
        where: { campaignId },
        data: { coreObjective: body.marketing_objective },
      });
    }

    if (
      body.budget_allocation !== undefined &&
      Number.isFinite(body.budget_allocation) &&
      body.budget_allocation > 0
    ) {
      await this.prisma.uceCampaignCommercials.updateMany({
        where: { campaignId },
        data: { totalCampaignBudgetPool: body.budget_allocation },
      });
    }

    return this.getCampaignShell(brandProfileId, campaignId);
  }

  async patchCampaignEssentials(
    brandProfileId: string,
    campaignId: string,
    body: {
      campaign_name?: string;
      budget_pool?: number;
      product_inventories?: Array<{
        product_id: string;
        inventory_count: number;
      }>;
    },
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
    });
    if (!campaign) {
      throw new BadRequestException("Campaign not found");
    }
    if (campaign.status === UceCampaignStatus.COMPLETED || campaign.status === UceCampaignStatus.ARCHIVED) {
      throw new BadRequestException("Completed or archived campaigns cannot be edited.");
    }

    const canEdit = await this.canEditCampaignEssentials(campaignId);
    if (!canEdit) {
      throw new ConflictException(
        "Campaign name, budget, and inventory can only be edited before any creator applications or active collaborations exist.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (body.campaign_name?.trim()) {
        await tx.uceCampaign.update({
          where: { id: campaignId },
          data: { name: body.campaign_name.trim() },
        });
      }

      if (
        body.budget_pool !== undefined &&
        Number.isFinite(body.budget_pool) &&
        body.budget_pool > 0
      ) {
        await tx.uceCampaignCommercials.updateMany({
          where: { campaignId },
          data: { totalCampaignBudgetPool: body.budget_pool },
        });
      }

      if (body.product_inventories?.length) {
        for (const row of body.product_inventories) {
          const product = await tx.uceCampaignProduct.findFirst({
            where: { id: row.product_id, campaignId },
          });
          if (!product) {
            throw new BadRequestException(
              `Product ${row.product_id} not found for campaign`,
            );
          }
          await tx.uceCampaignProduct.update({
            where: { id: row.product_id },
            data: { inventoryCount: row.inventory_count },
          });
        }
      }
    });

    return this.getCampaignShell(brandProfileId, campaignId);
  }

  async patchStatus(
    brandProfileId: string,
    campaignId: string,
    status: UceCampaignStatus,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const existing = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
    });
    if (!existing) {
      throw new BadRequestException("Campaign not found");
    }

    if (status === UceCampaignStatus.PUBLISHED) {
      if (existing.status !== UceCampaignStatus.DRAFT) {
        throw new BadRequestException(
          "Only DRAFT campaigns can be published.",
        );
      }
    }

    if (status === UceCampaignStatus.PAUSED) {
      if (existing.status !== UceCampaignStatus.LIVE) {
        throw new BadRequestException("Only LIVE campaigns can be paused.");
      }
    }

    if (status === UceCampaignStatus.LIVE) {
      if (
        existing.status !== UceCampaignStatus.PAUSED &&
        existing.status !== UceCampaignStatus.PUBLISHED
      ) {
        throw new BadRequestException(
          "Only PUBLISHED or PAUSED campaigns can become LIVE.",
        );
      }
      if (existing.status === UceCampaignStatus.PUBLISHED) {
        const checklist = await this.buildActivationChecklist(campaignId);
        const blockers = checklist.filter((c) => !c.satisfied);
        if (blockers.length > 0) {
          throw new BadRequestException({
            message:
              "Campaign cannot go LIVE until execution-readiness checklist criteria are met",
            checklist,
          });
        }
      }
    }

    if (status === UceCampaignStatus.COMPLETED) {
      if (
        existing.status !== UceCampaignStatus.LIVE &&
        existing.status !== UceCampaignStatus.PAUSED
      ) {
        throw new BadRequestException(
          "Only LIVE or PAUSED campaigns can be completed.",
        );
      }
    }

    if (status === UceCampaignStatus.ARCHIVED) {
      if (existing.status !== UceCampaignStatus.COMPLETED) {
        throw new BadRequestException(
          "Only COMPLETED campaigns can be archived.",
        );
      }
    }

    const updated = await this.prisma.uceCampaign.update({
      where: { id: campaignId },
      data: { status },
    });

    return {
      campaign_id: updated.id,
      campaign_name: updated.name,
      current_status: updated.status,
      pause_warning:
        updated.status === UceCampaignStatus.PAUSED
          ? "Campaign Paused. Inbound application links are offline. Active collaboration workflows remain accessible for processing."
          : null,
    };
  }

  async pauseCampaign(brandProfileId: string, campaignId: string) {
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.PAUSED,
    );
  }

  /** Publish a DRAFT campaign to PUBLISHED (setup may still be incomplete). */
  async publishCampaign(brandProfileId: string, campaignId: string) {
    const parsed = publishCampaignInputSchema.safeParse({ campaignId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.PUBLISHED,
    );
  }

  /** Move PUBLISHED → LIVE when execution-ready, or keep legacy alias for go-live. */
  async goLiveCampaign(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const existing = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
    });
    if (!existing) {
      throw new BadRequestException("Campaign not found");
    }
    if (existing.status === UceCampaignStatus.DRAFT) {
      await this.publishCampaign(brandProfileId, campaignId);
    }
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.LIVE,
    );
  }

  /** Resume a PAUSED campaign back to LIVE. */
  async resumeCampaign(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const existing = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
    });
    if (!existing) {
      throw new BadRequestException("Campaign not found");
    }
    if (existing.status !== UceCampaignStatus.PAUSED) {
      throw new BadRequestException(
        "Only PAUSED campaigns can be resumed. Use publish/go-live for DRAFT or PUBLISHED campaigns.",
      );
    }
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.LIVE,
    );
  }

  async completeCampaign(brandProfileId: string, campaignId: string) {
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.COMPLETED,
    );
  }

  async archiveCampaign(brandProfileId: string, campaignId: string) {
    return this.patchStatus(
      brandProfileId,
      campaignId,
      UceCampaignStatus.ARCHIVED,
    );
  }

  async getActivationChecklist(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    return this.buildActivationChecklist(campaignId);
  }

  async getCampaignSummary(brandProfileId: string, campaignId: string) {
    const shell = await this.getCampaignShell(brandProfileId, campaignId);
    const budget = shell.zone_1_commercials?.total_campaign_budget_pool ?? 0;
    const spend = shell.performance_aggregate?.total_spend_to_date ?? 0;
    const remaining = Math.max(0, budget - spend);
    return {
      campaign_id: shell.campaign_id,
      campaign_name: shell.campaign_name,
      current_status: shell.current_status,
      core_objective: shell.zone_1_master?.core_objective ?? null,
      budget_pool: budget,
      total_spend_to_date: spend,
      remaining_budget: remaining,
      utilization_pct:
        budget > 0 ? Math.round((spend / budget) * 1000) / 10 : 0,
      product_count: shell.zone_2_tactics.products.length,
      brief_count: shell.zone_2_tactics.briefs.length,
      total_prospects_count:
        shell.performance_aggregate?.total_prospects_count ?? 0,
      total_applicants_count:
        shell.performance_aggregate?.total_applicants_count ?? 0,
      total_active_collabs_count:
        shell.performance_aggregate?.total_active_collabs_count ?? 0,
    };
  }

  async getCampaignFinancials(brandProfileId: string, campaignId: string) {
    const summary = await this.getCampaignSummary(brandProfileId, campaignId);
    return {
      campaign_id: summary.campaign_id,
      campaign_name: summary.campaign_name,
      current_status: summary.current_status,
      budget_pool: summary.budget_pool,
      total_spend_to_date: summary.total_spend_to_date,
      remaining_budget: summary.remaining_budget,
      utilization_pct: summary.utilization_pct,
    };
  }

  async getCampaignPerformance(brandProfileId: string, campaignId: string) {
    const shell = await this.getCampaignShell(brandProfileId, campaignId);
    const listRow = (
      await this.listCampaigns(brandProfileId, {})
    ).find((c) => c.campaign_id === campaignId);

    return {
      campaign_id: shell.campaign_id,
      campaign_name: shell.campaign_name,
      current_status: shell.current_status,
      core_objective: shell.zone_1_master?.core_objective ?? null,
      total_impressions: listRow?.total_impressions ?? "0",
      total_spend_to_date:
        shell.performance_aggregate?.total_spend_to_date ?? 0,
      total_prospects_count:
        shell.performance_aggregate?.total_prospects_count ?? 0,
      total_applicants_count:
        shell.performance_aggregate?.total_applicants_count ?? 0,
      total_active_collabs_count:
        shell.performance_aggregate?.total_active_collabs_count ?? 0,
      budget_pool: shell.zone_1_commercials?.total_campaign_budget_pool ?? 0,
    };
  }

  async compareCampaigns(brandProfileId: string, campaignIds: string[]) {
    const uniqueIds = [...new Set(campaignIds.filter(Boolean))];
    if (uniqueIds.length < 2) {
      throw new BadRequestException(
        "At least two campaign ids are required to compare.",
      );
    }

    const rows = [];
    for (const id of uniqueIds) {
      rows.push(await this.getCampaignSummary(brandProfileId, id));
    }
    return rows;
  }

  async findCampaignByNameHint(
    brandProfileId: string,
    nameHint: string,
  ) {
    const hint = nameHint.trim();
    if (!hint) {
      return null;
    }
    const campaigns = await this.listCampaigns(brandProfileId, {
      search: hint,
    });
    if (campaigns.length === 0) {
      return null;
    }
    const exact = campaigns.find(
      (c) => c.campaign_name.toLowerCase() === hint.toLowerCase(),
    );
    return exact ?? (campaigns.length === 1 ? campaigns[0] : null);
  }

  async duplicateCampaign(
    brandProfileId: string,
    sourceCampaignId: string,
    newCampaignName: string,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, sourceCampaignId);

    const source = await this.prisma.uceCampaign.findFirst({
      where: { id: sourceCampaignId, brandProfileId },
      include: {
        strategy: true,
        targeting: true,
        commercials: true,
        products: { orderBy: { createdAt: "asc" } },
        briefs: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!source) {
      throw new BadRequestException("Source campaign not found");
    }
    if (!source.strategy || !source.targeting || !source.commercials) {
      throw new BadRequestException(
        "Source campaign is missing strategy, targeting, or commercials and cannot be duplicated.",
      );
    }

    const name = newCampaignName.trim();
    if (!name) {
      throw new BadRequestException("New campaign name is required.");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.uceCampaign.create({
        data: {
          brandProfileId,
          name,
          status: UceCampaignStatus.DRAFT,
          performanceAggregate: { create: {} },
          strategy: {
            create: {
              timelineType: source.strategy!.timelineType,
              fixedStartDate: source.strategy!.fixedStartDate,
              fixedEndDate: source.strategy!.fixedEndDate,
              dynamicDaysLimit: source.strategy!.dynamicDaysLimit,
              coreObjective: source.strategy!.coreObjective,
              platformDeliverables:
                source.strategy!.platformDeliverables as Prisma.InputJsonValue,
            },
          },
          targeting: {
            create: {
              industryVertical: source.targeting!.industryVertical,
              creatorArchetypes: source.targeting!.creatorArchetypes,
              followerTiers: source.targeting!.followerTiers,
              audienceAgeMin: source.targeting!.audienceAgeMin,
              audienceAgeMax: source.targeting!.audienceAgeMax,
              audienceGender: source.targeting!.audienceGender,
              targetLocations: source.targeting!.targetLocations,
              disqualifyingKeywords: source.targeting!.disqualifyingKeywords,
              visibilityScopes: source.targeting!.visibilityScopes,
              applicationScope: source.targeting!.applicationScope,
            },
          },
          commercials: {
            create: {
              compensationType: source.commercials!.compensationType,
              fixedFeeAmount: source.commercials!.fixedFeeAmount,
              negotiableMinFee: source.commercials!.negotiableMinFee,
              negotiableMaxFee: source.commercials!.negotiableMaxFee,
              totalCampaignBudgetPool:
                source.commercials!.totalCampaignBudgetPool,
              advancePaymentPercentage:
                source.commercials!.advancePaymentPercentage,
              finalBalanceTerms: source.commercials!.finalBalanceTerms,
            },
          },
        },
      });

      await tx.uceCampaignReportingSnapshot.create({
        data: {
          campaignId: campaign.id,
          primaryObjective: source.strategy!.coreObjective,
          lastApiSyncTimestamp: new Date(),
        },
      });

      const productIdMap = new Map<string, string>();
      for (const product of source.products) {
        const cloned = await tx.uceCampaignProduct.create({
          data: {
            campaignId: campaign.id,
            assetType: product.assetType,
            skuCode: product.skuCode
              ? `${product.skuCode}-COPY-${campaign.id.slice(0, 6)}`
              : null,
            productName: product.productName,
            isActive: product.isActive,
            inventoryCount: product.inventoryCount,
            costPerUnit: product.costPerUnit,
            imageUrl: product.imageUrl,
            assetPayload: product.assetPayload as Prisma.InputJsonValue,
          },
        });
        productIdMap.set(product.id, cloned.id);
      }

      for (const brief of source.briefs) {
        await tx.uceCampaignBrief.create({
          data: {
            campaignId: campaign.id,
            productId: brief.productId
              ? (productIdMap.get(brief.productId) ?? null)
              : null,
            internalTitle: brief.internalTitle,
            creativeGuidelines: brief.creativeGuidelines,
            isActive: brief.isActive,
            requiredPlatforms: brief.requiredPlatforms,
            deliverableFormatTags: brief.deliverableFormatTags,
            briefType: brief.briefType,
            purpose: brief.purpose,
            objective: brief.objective,
            targetInfluencerArchetype: brief.targetInfluencerArchetype,
            mandatoryCreatorRequirements: brief.mandatoryCreatorRequirements,
            deliverablesInventory:
              brief.deliverablesInventory as Prisma.InputJsonValue,
            contentGuidanceMatrix:
              brief.contentGuidanceMatrix as Prisma.InputJsonValue,
            parentPlannerLogisticsSnapshot:
              brief.parentPlannerLogisticsSnapshot as Prisma.InputJsonValue,
          },
        });
      }

      return campaign;
    });

    return this.getCampaignShell(brandProfileId, created.id);
  }

  async bulkLifecycleAction(
    brandProfileId: string,
    action: "PAUSE" | "RESUME" | "ARCHIVE",
    campaignIds: string[],
  ) {
    const results: Array<{
      campaign_id: string;
      ok: boolean;
      current_status?: UceCampaignStatus;
      error?: string;
    }> = [];

    for (const id of [...new Set(campaignIds.filter(Boolean))]) {
      try {
        const result =
          action === "PAUSE"
            ? await this.pauseCampaign(brandProfileId, id)
            : action === "RESUME"
              ? await this.resumeCampaign(brandProfileId, id)
              : await this.archiveCampaign(brandProfileId, id);
        results.push({
          campaign_id: result.campaign_id,
          ok: true,
          current_status: result.current_status,
        });
      } catch (err) {
        results.push({
          campaign_id: id,
          ok: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return {
      action,
      results,
      success_count: results.filter((r) => r.ok).length,
      failure_count: results.filter((r) => !r.ok).length,
    };
  }

  private async buildActivationChecklist(campaignId: string) {
    const [productCount, briefCount, commercials] = await Promise.all([
      this.prisma.uceCampaignProduct.count({ where: { campaignId } }),
      this.prisma.uceCampaignBrief.count({ where: { campaignId } }),
      this.prisma.uceCampaignCommercials.findUnique({ where: { campaignId } }),
    ]);

    const budgetOk =
      commercials != null &&
      decimalToNumber(commercials.totalCampaignBudgetPool) > 0;

    return [
      {
        key: "product_sku",
        label: "At least one product SKU",
        satisfied: productCount >= 1,
      },
      {
        key: "active_brief",
        label: "At least one brief configuration",
        satisfied: briefCount >= 1,
      },
      {
        key: "escrow_funding",
        label: "Sufficient campaign budget in escrow pool",
        satisfied: budgetOk,
      },
    ];
  }

  private async canEditCampaignEssentials(campaignId: string): Promise<boolean> {
    const blockingRows = await this.prisma.uceCampaignCollaboration.count({
      where: {
        campaignId,
        collabStatus: { in: ESSENTIALS_EDIT_BLOCKING_STATUSES },
      },
    });
    return blockingRows === 0;
  }
}

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
      where: { brandProfileId, status: UceCampaignStatus.ACTIVE },
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

    const campaigns = await this.prisma.uceCampaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
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

    return campaigns.map((c) => {
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
        total_spend_to_date: agg
          ? decimalToNumber(agg.totalSpendToDate)
          : 0,
        total_impressions: agg
          ? agg.totalImpressionsCount.toString()
          : "0",
        budget_pool: budgetPool,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
      };
    });
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
              visibilityScopes: targeting.visibility_scopes,
              applicationScope: targeting.application_scope,
            },
          },
          commercials: {
            create: {
              compensationType: commercials.compensation_type,
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
          sku_code: p.skuCode,
          product_name: p.productName,
          inventory_count: p.inventoryCount,
          out_of_stock: p.inventoryCount <= 0,
          cost_per_unit: decimalToNumber(p.costPerUnit),
          image_url: p.imageUrl,
        })),
        briefs: campaign.briefs.map((b) => ({
          brief_id: b.id,
          internal_title: b.internalTitle,
          creative_guidelines: b.creativeGuidelines,
          required_platforms: b.requiredPlatforms,
          deliverable_format_tags: b.deliverableFormatTags,
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
    if (campaign.status === UceCampaignStatus.COMPLETED) {
      throw new BadRequestException("Completed campaigns cannot be edited.");
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

    if (status === UceCampaignStatus.ACTIVE) {
      const checklist = await this.buildActivationChecklist(campaignId);
      const blockers = checklist.filter((c) => !c.satisfied);
      if (blockers.length > 0) {
        throw new BadRequestException({
          message: "Campaign cannot be activated until checklist criteria are met",
          checklist,
        });
      }
    }

    const updated = await this.prisma.uceCampaign.update({
      where: { id: campaignId },
      data: { status },
    });

    return {
      campaign_id: updated.id,
      current_status: updated.status,
      pause_warning:
        updated.status === UceCampaignStatus.PAUSED
          ? "Campaign Paused. Inbound application links are offline. Active collaboration workflows remain accessible for processing."
          : null,
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

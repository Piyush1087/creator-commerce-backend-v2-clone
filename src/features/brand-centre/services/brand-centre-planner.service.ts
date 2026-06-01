import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandCentreJobStatus,
  BrandCentreJobType,
  PlannerCardType,
  PlannerWorkflowStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

type BriefRow = {
  requiredDeliverables?: Array<{ platform: string; quantity: number }>;
  operationalChecklists?: Record<string, unknown>;
};

type AssetEntityRow = {
  productionBriefs?: BriefRow[];
};

type CampaignMetadata = {
  operationalBudgetParameters?: {
    minAllocationThreshold?: number;
    maxAllocationThreshold?: number;
  };
};

@Injectable()
export class BrandCentrePlannerService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlannerDashboard(brandProfileId: string) {
    const cards = await this.prisma.brandPlannerCard.findMany({
      where: {
        brandProfileId,
        workflowStatus: { not: PlannerWorkflowStatus.DISCARDED },
      },
      orderBy: { createdAt: "desc" },
    });

    const grouped = {
      newCampaign: cards.filter(
        (c) => c.cardType === PlannerCardType.NEW_CAMPAIGN,
      ),
      suggestedUpdate: cards.filter(
        (c) => c.cardType === PlannerCardType.SUGGESTED_UPDATE,
      ),
      autoPauseLog: cards.filter(
        (c) => c.cardType === PlannerCardType.AUTO_PAUSE_LOG,
      ),
    };

    const plannerAggregateJob = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.PLANNER_AGGREGATE,
        status: {
          in: [BrandCentreJobStatus.QUEUED, BrandCentreJobStatus.RUNNING],
        },
      },
      orderBy: { queuedAt: "desc" },
    });

    return {
      totalCards: cards.length,
      grouped,
      cards: cards.map((c) => this.mapCardSummary(c)),
      plannerAggregateJob: plannerAggregateJob
        ? {
            id: plannerAggregateJob.id,
            status: plannerAggregateJob.status,
            errorMessage: plannerAggregateJob.errorMessage,
            queuedAt: plannerAggregateJob.queuedAt.toISOString(),
          }
        : null,
    };
  }

  async getCard(brandProfileId: string, cardId: string) {
    const card = await this.prisma.brandPlannerCard.findFirst({
      where: { id: cardId, brandProfileId },
    });
    if (!card) {
      throw new NotFoundException("Planner card not found");
    }
    return card;
  }

  async patchCard(
    brandProfileId: string,
    cardId: string,
    data: { workflowStatus?: PlannerWorkflowStatus },
  ) {
    const card = await this.prisma.brandPlannerCard.findFirst({
      where: { id: cardId, brandProfileId },
    });
    if (!card) {
      throw new NotFoundException("Planner card not found");
    }
    if (card.cardType === PlannerCardType.AUTO_PAUSE_LOG) {
      throw new BadRequestException(
        "Auto-pause cards cannot be edited; use acknowledge",
      );
    }
    return this.prisma.brandPlannerCard.update({
      where: { id: cardId },
      data: {
        workflowStatus: data.workflowStatus ?? card.workflowStatus,
      },
    });
  }

  async approveCard(brandProfileId: string, cardId: string) {
    const card = await this.prisma.brandPlannerCard.findFirst({
      where: { id: cardId, brandProfileId },
    });
    if (!card) {
      throw new NotFoundException("Planner card not found");
    }
    if (card.cardType === PlannerCardType.AUTO_PAUSE_LOG) {
      throw new BadRequestException("Auto-pause cards cannot be approved");
    }
    if (card.workflowStatus === PlannerWorkflowStatus.PROCEEDED_TO_PIPELINE) {
      return card;
    }

    const budget = await this.prisma.brandBudgetConfiguration.findUnique({
      where: { brandProfileId },
    });
    if (!budget) {
      throw new BadRequestException("Budget configuration required");
    }

    const cTotal = this.computeCommitmentTotal(card);
    const master = Number(budget.masterMonthlyBudget);
    const activeCommitted = 0;
    const remainingFloat = master - activeCommitted;

    if (cTotal > remainingFloat) {
      throw new BadRequestException(
        `Circuit breaker: commitment ${cTotal} exceeds remaining budget ${remainingFloat}`,
      );
    }

    return this.prisma.brandPlannerCard.update({
      where: { id: cardId },
      data: { workflowStatus: PlannerWorkflowStatus.PROCEEDED_TO_PIPELINE },
    });
  }

  async acknowledgeAutoPause(brandProfileId: string, cardId: string) {
    const card = await this.prisma.brandPlannerCard.findFirst({
      where: { id: cardId, brandProfileId },
    });
    if (!card) {
      throw new NotFoundException("Planner card not found");
    }
    if (card.cardType !== PlannerCardType.AUTO_PAUSE_LOG) {
      throw new BadRequestException("Only auto-pause cards can be acknowledged");
    }
    return this.prisma.brandPlannerCard.update({
      where: { id: cardId },
      data: { workflowStatus: PlannerWorkflowStatus.DISCARDED },
    });
  }

  private computeCommitmentTotal(card: {
    campaignMetadata: unknown;
    assetsAndBriefsMatrix: unknown;
  }): number {
    const meta = card.campaignMetadata as CampaignMetadata;
    const maxAlloc =
      meta.operationalBudgetParameters?.maxAllocationThreshold ?? 500;
    const matrix = (card.assetsAndBriefsMatrix ?? []) as AssetEntityRow[];
    let total = 0;
    for (const entity of matrix) {
      for (const brief of entity.productionBriefs ?? []) {
        const qty = (brief.requiredDeliverables ?? []).reduce(
          (sum, d) => sum + (d.quantity ?? 1),
          0,
        );
        total += maxAlloc * Math.max(qty, 1);
      }
    }
    return total;
  }

  private mapCardSummary(card: {
    id: string;
    cardType: PlannerCardType;
    aggregationKey: unknown;
    workflowStatus: PlannerWorkflowStatus;
    existingTargetCampaignId: string | null;
    createdAt: Date;
    campaignMetadata: unknown;
    assetsAndBriefsMatrix: unknown;
  }) {
    const key = card.aggregationKey as Record<string, unknown>;
    const meta = card.campaignMetadata as Record<string, unknown> | null;
    const matrix = Array.isArray(card.assetsAndBriefsMatrix)
      ? card.assetsAndBriefsMatrix
      : [];

    const audience = meta?.audienceDemographics as
      | Record<string, unknown>
      | undefined;
    const budgetParams = meta?.operationalBudgetParameters as
      | Record<string, unknown>
      | undefined;

    const minBudget =
      typeof budgetParams?.minAllocationThreshold === "number"
        ? budgetParams.minAllocationThreshold
        : null;
    const maxBudget =
      typeof budgetParams?.maxAllocationThreshold === "number"
        ? budgetParams.maxAllocationThreshold
        : null;

    const personaTargeting: string[] = [];
    if (audience) {
      const geo = Array.isArray(audience.geoTargets)
        ? (audience.geoTargets as string[]).join(", ")
        : null;
      const gender = Array.isArray(audience.genderFocus)
        ? (audience.genderFocus as string[]).join(", ")
        : null;
      const ages = Array.isArray(audience.ageWindows)
        ? (audience.ageWindows as string[]).join(", ")
        : null;
      const interests = Array.isArray(audience.explicitInterests)
        ? (audience.explicitInterests as string[]).join(", ")
        : null;
      if (geo) {
        personaTargeting.push(`Geo: ${geo}`);
      }
      if (gender) {
        personaTargeting.push(`Gender: ${gender}`);
      }
      if (ages) {
        personaTargeting.push(`Age: ${ages}`);
      }
      if (interests) {
        personaTargeting.push(`Interests: ${interests}`);
      }
    }

    const assets = matrix.flatMap((entityRow) => {
      const entity = entityRow as Record<string, unknown>;
      const entityName =
        typeof entity.entityName === "string" ? entity.entityName : "Asset";
      const briefs = Array.isArray(entity.productionBriefs)
        ? entity.productionBriefs
        : [];
      if (briefs.length === 0) {
        return [
          {
            productName: entityName,
            briefName: "-",
            pillars: ["-"],
            deliverables: ["-"],
          },
        ];
      }
      return briefs.map((briefRow) => {
        const brief = briefRow as Record<string, unknown>;
        const deliverables = Array.isArray(brief.requiredDeliverables)
          ? (brief.requiredDeliverables as Array<Record<string, unknown>>).map(
              (d) => {
                const platform =
                  typeof d.platform === "string" ? d.platform : "Platform";
                const qty =
                  typeof d.quantity === "number" ? d.quantity : 1;
                return `${qty}x ${platform}`;
              },
            )
          : ["-"];
        const pillars =
          typeof brief.contentPillarThemeCore === "string"
            ? [brief.contentPillarThemeCore]
            : ["-"];
        return {
          productName: entityName,
          briefName:
            typeof brief.briefName === "string" ? brief.briefName : "-",
          pillars,
          deliverables: deliverables.length > 0 ? deliverables : ["-"],
        };
      });
    });

    const objective =
      typeof key.objective === "string" ? key.objective : null;
    const tier =
      typeof key.targetCreatorTier === "string"
        ? key.targetCreatorTier
        : null;
    const hook =
      typeof key.aiContextHook === "string" ? key.aiContextHook : null;

    const deadline =
      typeof meta?.campaignArchitectureDeadline === "string"
        ? meta.campaignArchitectureDeadline
        : null;

    return {
      id: card.id,
      cardType: card.cardType,
      workflowStatus: card.workflowStatus,
      objective,
      targetCreatorTier: tier,
      aiContextHook: hook,
      existingTargetCampaignId: card.existingTargetCampaignId,
      createdAt: card.createdAt.toISOString(),
      strategy: {
        objective: objective ?? "-",
        personaTargeting: personaTargeting.length > 0 ? personaTargeting : ["-"],
        budget:
          minBudget != null && maxBudget != null
            ? `$${minBudget.toLocaleString()} - $${maxBudget.toLocaleString()} per creator`
            : "-",
        deadline: deadline ?? "-",
        assets: assets.length > 0 ? assets : [],
      },
    };
  }
}

import { Injectable } from "@nestjs/common";
import { LeakPlannerStatus, PlannerCardType, PlannerWorkflowStatus } from "@prisma/client";

import { BrandCentreIntelligenceService } from "../../brand-centre/services/brand-centre-intelligence.service";
import { BrandCentrePlannerService } from "../../brand-centre/services/brand-centre-planner.service";
import { BrandUceCampaignService } from "../../brand-uce/services/brand-uce-campaign.service";
import type { DataTableData } from "../schemas/copilot-payload.schema";

@Injectable()
export class PlannerCoPilotToolsService {
  constructor(
    private readonly planner: BrandCentrePlannerService,
    private readonly intelligence: BrandCentreIntelligenceService,
    private readonly uceCampaigns: BrandUceCampaignService,
  ) {}

  async getPlannerReadContext(brandProfileId: string) {
    return this.planner.getPlannerDashboard(brandProfileId);
  }

  async listMovableLeaks(brandProfileId: string) {
    const leaks = await this.intelligence.listLeaks(brandProfileId, "active");
    return leaks.filter(
      (leak) => leak.plannerStatus !== LeakPlannerStatus.PUSHED_TO_PLANNER,
    );
  }

  async listLaunchablePlannerCards(brandProfileId: string) {
    const dashboard = await this.planner.getPlannerDashboard(brandProfileId);
    return dashboard.cards.filter(
      (card) =>
        card.cardType === PlannerCardType.NEW_CAMPAIGN &&
        card.workflowStatus === PlannerWorkflowStatus.PENDING_USER_REVIEW,
    );
  }

  async listDraftCampaigns(brandProfileId: string) {
    return this.uceCampaigns.listCampaigns(brandProfileId, {
      status: "DRAFT",
    });
  }

  buildPlannerPipelineNarrative(
    dashboard: Awaited<ReturnType<BrandCentrePlannerService["getPlannerDashboard"]>>,
  ): string {
    const pending = dashboard.cards.filter(
      (card) => card.workflowStatus === PlannerWorkflowStatus.PENDING_USER_REVIEW,
    ).length;
    const pipeline = dashboard.cards.filter(
      (card) =>
        card.workflowStatus === PlannerWorkflowStatus.PROCEEDED_TO_PIPELINE,
    ).length;

    if (dashboard.plannerAggregateJob) {
      return `Campaign Planner is building a new card (job ${dashboard.plannerAggregateJob.status.toLowerCase()}). ${dashboard.totalCards} card(s) on the board — ${pending} pending review, ${pipeline} approved for launch.`;
    }

    if (dashboard.totalCards === 0) {
      return "Campaign Planner has no cards yet. Move an Intelligence & Gaps leak to the planner to generate a draft campaign blueprint.";
    }

    const hooks = dashboard.cards
      .slice(0, 5)
      .map((card) => card.aiContextHook ?? card.strategy.objective)
      .join("; ");

    return `Campaign Planner has ${dashboard.totalCards} card(s): ${pending} pending review, ${pipeline} ready to launch. Cards include: ${hooks}.`;
  }

  buildPlannerTable(
    dashboard: Awaited<ReturnType<BrandCentrePlannerService["getPlannerDashboard"]>>,
  ): DataTableData {
    return {
      headers: ["Card", "Type", "Status", "Objective", "Tier"],
      rows: dashboard.cards.map((card) => ({
        Card: card.aiContextHook ?? card.id.slice(0, 8),
        Type: card.cardType,
        Status: card.workflowStatus,
        Objective: card.objective ?? "-",
        Tier: card.targetCreatorTier ?? "-",
      })),
    };
  }

  buildDraftCampaignsNarrative(
    campaigns: Awaited<ReturnType<BrandUceCampaignService["listCampaigns"]>>,
  ): string {
    if (campaigns.length === 0) {
      return "You have no DRAFT campaigns. Launch from Campaign Planner or use the Launch campaign shortcut in chat.";
    }
    const names = campaigns
      .slice(0, 8)
      .map((c) => `"${c.campaign_name}" (budget ${c.budget_pool})`)
      .join("; ");
    return `You have ${campaigns.length} DRAFT campaign(s): ${names}. Only drafts can be edited from chat — activate manually in Campaigns when ready.`;
  }

  buildDraftCampaignsTable(
    campaigns: Awaited<ReturnType<BrandUceCampaignService["listCampaigns"]>>,
  ): DataTableData {
    return {
      headers: ["Campaign", "Objective", "Budget pool", "Products", "Briefs"],
      rows: campaigns.map((c) => ({
        Campaign: c.campaign_name,
        Objective: c.core_objective ?? "-",
        "Budget pool": c.budget_pool,
        Products: c.product_count,
        Briefs: c.brief_count,
      })),
    };
  }
}

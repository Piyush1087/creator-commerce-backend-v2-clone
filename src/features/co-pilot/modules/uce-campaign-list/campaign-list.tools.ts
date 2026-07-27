import { Injectable } from "@nestjs/common";
import type { UceCampaignObjective, UceCampaignStatus } from "@prisma/client";

import { BrandUceCampaignService } from "../../../brand-uce/services/brand-uce-campaign.service";
import type {
  DataTableData,
  MetricItem,
} from "../../schemas/copilot-payload.schema";
import { fuzzyMatchNamedEntity } from "../../utils/co-pilot-fuzzy-match.util";

export type CampaignListRow = Awaited<
  ReturnType<BrandUceCampaignService["listCampaigns"]>
>[number];

@Injectable()
export class CampaignListToolsService {
  constructor(private readonly uceCampaigns: BrandUceCampaignService) {}

  listCampaigns(
    brandProfileId: string,
    filters: {
      status?: UceCampaignStatus;
      search?: string;
      objective?: UceCampaignObjective;
      product?: string;
      sortBy?: "updatedAt" | "name" | "budget" | "spend";
      sortDir?: "asc" | "desc";
    } = {},
  ) {
    return this.uceCampaigns.listCampaigns(brandProfileId, filters);
  }

  getSummary(brandProfileId: string, campaignId: string) {
    return this.uceCampaigns.getCampaignSummary(brandProfileId, campaignId);
  }

  getFinancials(brandProfileId: string, campaignId: string) {
    return this.uceCampaigns.getCampaignFinancials(brandProfileId, campaignId);
  }

  getPerformance(brandProfileId: string, campaignId: string) {
    return this.uceCampaigns.getCampaignPerformance(brandProfileId, campaignId);
  }

  compare(brandProfileId: string, campaignIds: string[]) {
    return this.uceCampaigns.compareCampaigns(brandProfileId, campaignIds);
  }

  async findByNameHint(brandProfileId: string, hint: string) {
    const campaigns = await this.listCampaigns(brandProfileId, {});
    const match = fuzzyMatchNamedEntity(
      hint,
      campaigns.map((c) => ({
        id: c.campaign_id,
        name: c.campaign_name,
        row: c,
      })),
    );
    return match?.row ?? null;
  }

  buildCampaignTable(campaigns: CampaignListRow[]): DataTableData {
    return {
      headers: [
        "Campaign",
        "Status",
        "Objective",
        "Budget",
        "Spend",
        "Active collabs",
      ],
      rows: campaigns.map((c) => ({
        Campaign: c.campaign_name,
        Status: c.current_status,
        Objective: c.core_objective ?? "-",
        Budget: c.budget_pool,
        Spend: c.total_spend_to_date,
        "Active collabs": c.active_collabs_count,
      })),
    };
  }

  buildCompareTable(
    rows: Awaited<ReturnType<BrandUceCampaignService["compareCampaigns"]>>,
  ): DataTableData {
    return {
      headers: [
        "Campaign",
        "Status",
        "Objective",
        "Budget",
        "Spend",
        "Utilization %",
        "Active collabs",
      ],
      rows: rows.map((c) => ({
        Campaign: c.campaign_name,
        Status: c.current_status,
        Objective: c.core_objective ?? "-",
        Budget: c.budget_pool,
        Spend: c.total_spend_to_date,
        "Utilization %": c.utilization_pct,
        "Active collabs": c.total_active_collabs_count,
      })),
    };
  }

  buildSummaryMetrics(
    summary: Awaited<ReturnType<BrandUceCampaignService["getCampaignSummary"]>>,
  ): MetricItem[] {
    return [
      {
        label: "Status",
        value: summary.current_status,
        statusColor: "NEUTRAL",
      },
      {
        label: "Budget pool",
        value: String(summary.budget_pool),
        statusColor: "NEUTRAL",
      },
      {
        label: "Spend to date",
        value: String(summary.total_spend_to_date),
        statusColor: "NEUTRAL",
      },
      {
        label: "Remaining",
        value: String(summary.remaining_budget),
        statusColor: summary.utilization_pct > 80 ? "YELLOW" : "GREEN",
      },
      {
        label: "Active collabs",
        value: String(summary.total_active_collabs_count),
        statusColor: "NEUTRAL",
      },
    ];
  }

  buildPerformanceMetrics(
    perf: Awaited<
      ReturnType<BrandUceCampaignService["getCampaignPerformance"]>
    >,
  ): MetricItem[] {
    return [
      {
        label: "Impressions",
        value: perf.total_impressions,
        statusColor: "NEUTRAL",
      },
      {
        label: "Spend",
        value: String(perf.total_spend_to_date),
        statusColor: "NEUTRAL",
      },
      {
        label: "Prospects",
        value: String(perf.total_prospects_count),
        statusColor: "NEUTRAL",
      },
      {
        label: "Applicants",
        value: String(perf.total_applicants_count),
        statusColor: "NEUTRAL",
      },
      {
        label: "Active collabs",
        value: String(perf.total_active_collabs_count),
        statusColor: "NEUTRAL",
      },
    ];
  }

  buildFinancialMetrics(
    fin: Awaited<ReturnType<BrandUceCampaignService["getCampaignFinancials"]>>,
  ): MetricItem[] {
    return [
      {
        label: "Budget pool",
        value: String(fin.budget_pool),
        statusColor: "NEUTRAL",
      },
      {
        label: "Spend to date",
        value: String(fin.total_spend_to_date),
        statusColor: "NEUTRAL",
      },
      {
        label: "Remaining",
        value: String(fin.remaining_budget),
        statusColor: fin.utilization_pct > 80 ? "YELLOW" : "GREEN",
      },
      {
        label: "Utilization %",
        value: String(fin.utilization_pct),
        statusColor: fin.utilization_pct > 95 ? "RED" : "NEUTRAL",
      },
    ];
  }

  listNarrative(campaigns: CampaignListRow[], label = "campaigns"): string {
    if (campaigns.length === 0) {
      return `No ${label} found. Create a draft from Campaign Planner or the Launch campaign shortcut.`;
    }
    return `Found ${campaigns.length} ${label}. Table below is read-only — pause, resume, archive, or duplicate via confirm when you ask.`;
  }
}

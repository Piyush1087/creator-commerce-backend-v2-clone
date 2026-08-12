import { Injectable } from "@nestjs/common";
import type { UceCampaignObjective, UceCampaignStatus } from "@prisma/client";

import { BrandUceCampaignService } from "../../../brand-uce/services/brand-uce-campaign.service";
import { BrandUcePipelineService } from "../../../brand-uce/services/brand-uce-pipeline.service";
import type {
  DataTableData,
  MetricItem,
  ValidationChecklistData,
} from "../../schemas/copilot-payload.schema";
import { fuzzyMatchNamedEntity } from "../../utils/co-pilot-fuzzy-match.util";

export type CampaignListRow = Awaited<
  ReturnType<BrandUceCampaignService["listCampaigns"]>
>[number];

export type CampaignShell = Awaited<
  ReturnType<BrandUceCampaignService["getCampaignShell"]>
>;

@Injectable()
export class CampaignListToolsService {
  constructor(
    private readonly uceCampaigns: BrandUceCampaignService,
    private readonly pipeline: BrandUcePipelineService,
  ) {}

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

  getShell(brandProfileId: string, campaignId: string) {
    return this.uceCampaigns.getCampaignShell(brandProfileId, campaignId);
  }

  getChecklist(brandProfileId: string, campaignId: string) {
    return this.uceCampaigns.getActivationChecklist(brandProfileId, campaignId);
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

  async listInvites(brandProfileId: string, campaignId: string) {
    const [prospects, applicants, active] = await Promise.all([
      this.pipeline.listProspects(brandProfileId, campaignId, {}),
      this.pipeline.listApplicants(brandProfileId, campaignId, {}),
      this.pipeline.listActiveCollabs(brandProfileId, campaignId, {}),
    ]);
    return {
      prospects: prospects.rows as unknown as Array<Record<string, unknown>>,
      applicants: applicants.rows as unknown as Array<Record<string, unknown>>,
      active: active.rows as unknown as Array<Record<string, unknown>>,
    };
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
        label: "Products",
        value: String(summary.product_count),
        statusColor: summary.product_count > 0 ? "GREEN" : "YELLOW",
      },
      {
        label: "Briefs",
        value: String(summary.brief_count),
        statusColor: summary.brief_count > 0 ? "GREEN" : "YELLOW",
      },
      {
        label: "Active collabs",
        value: String(summary.total_active_collabs_count),
        statusColor: "NEUTRAL",
      },
    ];
  }

  buildStatusMetrics(shell: CampaignShell): MetricItem[] {
    return [
      {
        label: "Status",
        value: shell.current_status,
        statusColor:
          shell.current_status === "LIVE" || shell.current_status === "PUBLISHED"
            ? "GREEN"
            : shell.current_status === "DRAFT"
              ? "YELLOW"
              : "NEUTRAL",
      },
      {
        label: "Live?",
        value: shell.current_status === "LIVE" ? "Yes" : "No",
        statusColor: shell.current_status === "LIVE" ? "GREEN" : "YELLOW",
      },
      {
        label: "Draft?",
        value: shell.current_status === "DRAFT" ? "Yes" : "No",
        statusColor: "NEUTRAL",
      },
      {
        label: "Objective",
        value: shell.zone_1_master?.core_objective ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Can edit essentials",
        value: shell.can_edit_essentials ? "Yes" : "No",
        statusColor: "NEUTRAL",
      },
    ];
  }

  statusNarrative(shell: CampaignShell): string {
    const live = shell.current_status === "LIVE";
    const draft = shell.current_status === "DRAFT";
    return `"${shell.campaign_name}" is ${shell.current_status}${
      live ? " (live)" : draft ? " (still a draft)" : ""
    }.${shell.pause_warning ? ` ${shell.pause_warning}` : ""}`;
  }

  checklistNarrative(
    shell: CampaignShell,
    checklist: Awaited<
      ReturnType<BrandUceCampaignService["getActivationChecklist"]>
    >,
  ): string {
    const blockers = checklist.filter((c) => !c.satisfied);
    if (shell.current_status === "LIVE") {
      return `"${shell.campaign_name}" is already live. Checklist is for publish readiness on drafts.`;
    }
    if (blockers.length === 0) {
      return `"${shell.campaign_name}" checklist is complete — you can publish / go live after confirm.`;
    }
    return `"${shell.campaign_name}" can’t publish yet. Missing: ${blockers
      .map((b) => b.label)
      .join("; ")}.`;
  }

  checklistToValidation(
    shell: CampaignShell,
    checklist: Awaited<
      ReturnType<BrandUceCampaignService["getActivationChecklist"]>
    >,
    opts?: { action?: string; title?: string },
  ): ValidationChecklistData {
    const blockers = checklist.filter((c) => !c.satisfied);
    return {
      title: opts?.title ?? "Campaign activation checklist",
      action: opts?.action ?? "PUBLISH",
      code: blockers.length
        ? "CAMPAIGN_CHECKLIST_BLOCKED"
        : "CAMPAIGN_CHECKLIST_OK",
      campaignId: shell.campaign_id,
      campaignName: shell.campaign_name,
      autoResume: blockers.length > 0,
      deepLinkPath: `/brand/campaigns/${shell.campaign_id}`,
      items: checklist.map((c) => ({
        id: c.key,
        title: c.label,
        satisfied: c.satisfied,
        helpText: c.satisfied
          ? "Complete"
          : "Required before publish / go live",
        repairHint: c.satisfied
          ? undefined
          : "Open the campaign wizard to fix this item.",
      })),
      primaryActionLabel: blockers.length
        ? "Open campaign"
        : "Ready to publish",
      cancelActionLabel: "Dismiss",
    };
  }

  validatePublish(
    shell: CampaignShell,
    checklist: Awaited<
      ReturnType<BrandUceCampaignService["getActivationChecklist"]>
    >,
  ): { narrativeText: string; validationChecklistData: ValidationChecklistData } {
    const isDraft = shell.current_status === "DRAFT";
    const items = [
      {
        id: "draft_status",
        title: "Campaign is DRAFT",
        satisfied: isDraft,
        helpText: isDraft
          ? "Status allows go-live."
          : `Current status is ${shell.current_status}.`,
        repairHint: isDraft
          ? undefined
          : "Only DRAFT campaigns can be published from chat.",
      },
      ...checklist.map((c) => ({
        id: c.key,
        title: c.label,
        satisfied: c.satisfied,
        helpText: c.satisfied ? "Complete" : "Required before publish",
        repairHint: c.satisfied
          ? undefined
          : "Fix this in the campaign wizard.",
      })),
    ];
    const blocked = items.some((i) => !i.satisfied);
    return {
      narrativeText: blocked
        ? `"${shell.campaign_name}" is not ready to publish yet.`
        : `"${shell.campaign_name}" is ready to publish. Say “publish ${shell.campaign_name}” to confirm.`,
      validationChecklistData: {
        title: "Validate publish",
        action: "GO_LIVE",
        code: blocked ? "PUBLISH_BLOCKED" : "PUBLISH_READY",
        campaignId: shell.campaign_id,
        campaignName: shell.campaign_name,
        autoResume: blocked,
        deepLinkPath: `/brand/campaigns/${shell.campaign_id}`,
        items,
        primaryActionLabel: blocked ? "Open campaign" : "Ready",
        cancelActionLabel: "Dismiss",
      },
    };
  }

  validateDelete(shell: CampaignShell): {
    narrativeText: string;
    validationChecklistData: ValidationChecklistData;
  } {
    return {
      narrativeText: `Delete isn’t available in chat for "${shell.campaign_name}". Archive it instead if you want it off the active list.`,
      validationChecklistData: {
        title: "Delete campaign",
        action: "DELETE",
        code: "DELETE_UNSUPPORTED",
        campaignId: shell.campaign_id,
        campaignName: shell.campaign_name,
        autoResume: false,
        deepLinkPath: `/brand/campaigns/${shell.campaign_id}`,
        items: [
          {
            id: "delete_api",
            title: "Delete in chat",
            satisfied: false,
            helpText: "Hard delete is not supported from Brand Co-Pilot.",
            repairHint:
              'Say “archive campaign …” or open Campaigns in the app.',
          },
        ],
        primaryActionLabel: "Open campaign",
        cancelActionLabel: "Dismiss",
      },
    };
  }

  productsTable(shell: CampaignShell): DataTableData {
    const products = shell.zone_2_tactics.products;
    if (products.length === 0) {
      return {
        headers: ["Product", "SKU", "Inventory"],
        rows: [{ Product: "—", SKU: "—", Inventory: "No products added" }],
      };
    }
    return {
      headers: ["Product", "SKU", "Type", "Inventory", "Cost/unit"],
      rows: products.map((p) => ({
        Product: p.product_name,
        SKU: p.sku_code ?? "—",
        Type: p.asset_type,
        Inventory: p.inventory_count,
        "Cost/unit": p.cost_per_unit,
      })),
    };
  }

  productsNarrative(shell: CampaignShell): string {
    const count = shell.zone_2_tactics.products.length;
    return count === 0
      ? `"${shell.campaign_name}" has no products yet.`
      : `"${shell.campaign_name}" has ${count} product(s) (${shell.total_inventory_allocated} inventory allocated).`;
  }

  briefsTable(shell: CampaignShell): DataTableData {
    const briefs = shell.zone_2_tactics.briefs;
    if (briefs.length === 0) {
      return {
        headers: ["Brief", "Type", "Guidelines"],
        rows: [{ Brief: "—", Type: "—", Guidelines: "No briefs yet" }],
      };
    }
    return {
      headers: ["Brief", "Type", "Platforms", "Guidelines"],
      rows: briefs.map((b) => ({
        Brief: b.internal_title,
        Type: b.brief_type ?? "—",
        Platforms: (b.required_platforms ?? []).join(", ") || "—",
        Guidelines: (b.creative_guidelines ?? "").slice(0, 120) || "—",
      })),
    };
  }

  briefsNarrative(shell: CampaignShell): string {
    const briefs = shell.zone_2_tactics.briefs;
    if (briefs.length === 0) {
      return `"${shell.campaign_name}" has no briefs yet.`;
    }
    const first = briefs[0];
    return `"${shell.campaign_name}" has ${briefs.length} brief(s). First: “${first.internal_title}”${
      first.creative_guidelines
        ? ` — ${(first.creative_guidelines ?? "").slice(0, 160)}`
        : ""
    }.`;
  }

  invitesTable(args: {
    prospects: Array<Record<string, unknown>>;
    applicants: Array<Record<string, unknown>>;
    active: Array<Record<string, unknown>>;
  }): DataTableData {
    const rows: Array<Record<string, string | number | boolean>> = [];
    const push = (
      list: Array<Record<string, unknown>>,
      bucket: string,
    ) => {
      for (const row of list) {
        rows.push({
          Creator: String(
            row.instagram_handle ??
              row.creator_display_name ??
              row.creator_email ??
              "—",
          ),
          Bucket: bucket,
          Status: String(row.collab_status ?? row.status ?? bucket),
        });
      }
    };
    push(args.prospects, "Invited/Prospect");
    push(args.applicants, "Applicant");
    push(args.active, "Joined/Active");
    if (rows.length === 0) {
      return {
        headers: ["Creator", "Bucket", "Status"],
        rows: [{ Creator: "—", Bucket: "—", Status: "No creators yet" }],
      };
    }
    return {
      headers: ["Creator", "Bucket", "Status"],
      rows,
    };
  }

  invitesNarrative(args: {
    campaignName: string;
    prospects: unknown[];
    applicants: unknown[];
    active: unknown[];
    userText: string;
  }): string {
    const n = args.userText.toLowerCase();
    if (/\baccepted|joined\b/.test(n)) {
      return `"${args.campaignName}" has ${args.active.length} joined/active creator(s).`;
    }
    if (/\brejected\b/.test(n)) {
      return `Rejected creators aren’t a separate pipeline list in chat yet for "${args.campaignName}". Showing invited / applicants / active instead.`;
    }
    if (/\binvited\b/.test(n)) {
      return `"${args.campaignName}" has ${args.prospects.length} invited/prospect creator(s).`;
    }
    return `"${args.campaignName}" pipeline: ${args.prospects.length} invited, ${args.applicants.length} applicants, ${args.active.length} active.`;
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

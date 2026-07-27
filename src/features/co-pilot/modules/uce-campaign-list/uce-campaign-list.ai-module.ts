import { Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";
import { randomUUID } from "crypto";

import type {
  CoPilotAiModule,
  CoPilotModuleReadContext,
  CoPilotModuleReadResult,
} from "../../core/ai-module.contract";
import type { ReadQueryKind } from "../../core/read-kind.types";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "../../core/write-intent.types";
import type { ExecutionWidgetData } from "../../schemas/copilot-payload.schema";
import {
  detectCampaignListRead,
  detectCampaignListWrite,
  extractCampaignNameHint,
  extractObjectiveFilter,
  extractSearchTerm,
  extractSortBy,
  extractStatusFilter,
  parseCompareCampaignHints,
} from "./campaign-list.intents";
import { CAMPAIGN_LIST_PROMPT_EXTENSION } from "./campaign-list.prompt";
import { CampaignListToolsService } from "./campaign-list.tools";

const READ_KINDS: ReadQueryKind[] = [
  "LIST_CAMPAIGNS",
  "SEARCH_CAMPAIGNS",
  "FILTER_CAMPAIGNS",
  "SORT_CAMPAIGNS",
  "CAMPAIGN_SUMMARY",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
];

const WRITE_INTENTS: WriteIntentKind[] = [
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
];

@Injectable()
export class UceCampaignListAiModule implements CoPilotAiModule {
  readonly id = "uce-campaign-list";
  readonly name = "Campaign List";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;
  readonly promptExtension = CAMPAIGN_LIST_PROMPT_EXTENSION;

  constructor(private readonly tools: CampaignListToolsService) {}

  detectRead(
    userText: string,
    _scopeContext: CoPilotScopeContext,
  ): ReadQueryKind | null {
    return detectCampaignListRead(userText);
  }

  detectWrite(
    userText: string,
    _history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null {
    return detectCampaignListWrite(userText);
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (!READ_KINDS.includes(kind)) {
      return null;
    }

    const n = ctx.userText.toLowerCase();
    const status =
      ctx.classifierFilters?.status ?? extractStatusFilter(n);
    const objective =
      ctx.classifierFilters?.objective ?? extractObjectiveFilter(n);
    const sortBy = ctx.classifierFilters?.sortBy ?? extractSortBy(n);
    const search =
      ctx.classifierFilters?.search ?? extractSearchTerm(ctx.userText, n);
    const product = ctx.classifierFilters?.product;

    if (
      kind === "LIST_CAMPAIGNS" ||
      kind === "SEARCH_CAMPAIGNS" ||
      kind === "FILTER_CAMPAIGNS" ||
      kind === "SORT_CAMPAIGNS"
    ) {
      const campaigns = await this.tools.listCampaigns(ctx.brandProfileId, {
        status,
        objective,
        search: kind === "SEARCH_CAMPAIGNS" || search ? search : undefined,
        product,
        sortBy: kind === "SORT_CAMPAIGNS" ? (sortBy ?? "updatedAt") : sortBy,
      });
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText: this.tools.listNarrative(campaigns),
        tableData: this.tools.buildCampaignTable(campaigns),
        toolsInvoked: ["uce.listCampaigns"],
      };
    }

    if (kind === "COMPARE_CAMPAIGNS") {
      let ids: string[] =
        ctx.resolvedCompareIds && ctx.resolvedCompareIds.length >= 2
          ? [...ctx.resolvedCompareIds]
          : [];
      if (ids.length < 2) {
        const hints = parseCompareCampaignHints(ctx.userText);
        for (const hint of hints) {
          const match = await this.tools.findByNameHint(
            ctx.brandProfileId,
            hint,
          );
          if (match) {
            ids.push(match.campaign_id);
          }
        }
      }
      if (ids.length < 2) {
        const all = await this.tools.listCampaigns(ctx.brandProfileId, {});
        return {
          formatType: "TABULAR_AUDIT_DATA",
          narrativeText:
            "I need two campaigns to compare. Tell me both names (e.g. Compare Summer Sale with Winter Sale), or pick from the list below.",
          tableData: this.tools.buildCampaignTable(all),
          toolsInvoked: ["uce.listCampaigns"],
        };
      }
      const rows = await this.tools.compare(ctx.brandProfileId, ids);
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText: `Comparison of ${rows.map((r) => r.campaign_name).join(" vs ")}.`,
        tableData: this.tools.buildCompareTable(rows),
        toolsInvoked: ["uce.compareCampaigns"],
      };
    }

    let campaignId = ctx.resolvedCampaignId;
    let campaignName = ctx.resolvedCampaignName;

    if (!campaignId) {
      const nameHint =
        extractCampaignNameHint(ctx.userText) ??
        ctx.userText.match(/campaign\s+(.+)$/i)?.[1]?.trim();
      if (nameHint) {
        const match = await this.tools.findByNameHint(
          ctx.brandProfileId,
          nameHint,
        );
        if (match) {
          campaignId = match.campaign_id;
          campaignName = match.campaign_name;
        }
      }
    }

    if (!campaignId) {
      const all = await this.tools.listCampaigns(ctx.brandProfileId, {});
      if (all.length === 1) {
        campaignId = all[0].campaign_id;
        campaignName = all[0].campaign_name;
      } else {
        return {
          formatType: "TABULAR_AUDIT_DATA",
          narrativeText:
            "Which campaign should I use? Pick one from the list or name it in your next message.",
          tableData: this.tools.buildCampaignTable(all),
          toolsInvoked: ["uce.listCampaigns"],
        };
      }
    }

    if (kind === "CAMPAIGN_SUMMARY") {
      const summary = await this.tools.getSummary(
        ctx.brandProfileId,
        campaignId,
      );
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText: `Summary for "${summary.campaign_name}" (${summary.current_status}): budget ${summary.budget_pool}, spend ${summary.total_spend_to_date}, ${summary.utilization_pct}% utilized, ${summary.total_active_collabs_count} active collabs.`,
        metricGridData: this.tools.buildSummaryMetrics(summary),
        toolsInvoked: ["uce.getCampaignSummary"],
      };
    }

    if (kind === "CAMPAIGN_PERFORMANCE") {
      const perf = await this.tools.getPerformance(
        ctx.brandProfileId,
        campaignId,
      );
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText: `Performance for "${perf.campaign_name}": ${perf.total_impressions} impressions, spend ${perf.total_spend_to_date}, pipeline ${perf.total_prospects_count} prospects / ${perf.total_applicants_count} applicants / ${perf.total_active_collabs_count} active.`,
        metricGridData: this.tools.buildPerformanceMetrics(perf),
        toolsInvoked: ["uce.getCampaignPerformance"],
      };
    }

    if (kind === "CAMPAIGN_FINANCIALS") {
      const fin = await this.tools.getFinancials(
        ctx.brandProfileId,
        campaignId,
      );
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText: `Financials for "${campaignName ?? fin.campaign_name}": pool ${fin.budget_pool}, spend ${fin.total_spend_to_date}, remaining ${fin.remaining_budget} (${fin.utilization_pct}% used).`,
        metricGridData: this.tools.buildFinancialMetrics(fin),
        toolsInvoked: ["uce.getCampaignFinancials"],
      };
    }

    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    brandProfileId: string,
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    if (!WRITE_INTENTS.includes(intent.kind as WriteIntentKind)) {
      return intent;
    }

    const stagedPayload = { ...intent.stagedPayload };
    const missingSlots = intent.missingSlots.map((s) => ({ ...s }));

    if (intent.kind === "BULK_CAMPAIGN_ACTION") {
      const action = String(stagedPayload.bulk_action ?? "").toUpperCase() as
        | "PAUSE"
        | "RESUME"
        | "ARCHIVE"
        | "";
      const statusFilter =
        action === "PAUSE"
          ? ("ACTIVE" as const)
          : action === "RESUME"
            ? ("PAUSED" as const)
            : action === "ARCHIVE"
              ? undefined
              : undefined;

      const campaigns = await this.tools.listCampaigns(brandProfileId, {
        status: statusFilter,
      });
      const campaignSlot = missingSlots.find(
        (s) => s.fieldName === "campaign_ids",
      );
      if (campaignSlot) {
        campaignSlot.inputType = "SINGLE_SELECT";
        campaignSlot.selectOptions = campaigns.map(
          (c) => `${c.campaign_id}::${c.campaign_name}`,
        );
        campaignSlot.uiLabel = "Campaigns to include (select one to start; add more ids in text)";
        campaignSlot.placeholderText = "Choose a campaign";
      }

      if (
        !stagedPayload.campaign_ids &&
        campaigns.length > 0 &&
        action === "ARCHIVE" &&
        campaigns.length <= 5
      ) {
        // leave multi-select to user
      }

      return {
        kind: intent.kind,
        stagedPayload,
        missingSlots: missingSlots.filter((slot) => {
          if (slot.fieldName === "bulk_action" && stagedPayload.bulk_action) {
            return false;
          }
          if (
            slot.fieldName === "campaign_ids" &&
            stagedPayload.campaign_ids
          ) {
            return false;
          }
          return true;
        }),
      };
    }

    const listStatus =
      intent.kind === "PAUSE_CAMPAIGN"
        ? ("ACTIVE" as const)
        : intent.kind === "RESUME_CAMPAIGN"
          ? ("PAUSED" as const)
          : undefined;

    const campaigns = await this.tools.listCampaigns(brandProfileId, {
      status: listStatus,
    });

    const campaignSlot = missingSlots.find((s) => s.fieldName === "campaign_id");
    if (campaignSlot) {
      campaignSlot.selectOptions = campaigns.map(
        (c) => `${c.campaign_id}::${c.campaign_name}`,
      );
    }

    const hint = String(stagedPayload.campaign_name_hint ?? "").trim();
    if (hint && !stagedPayload.campaign_id) {
      const match = await this.tools.findByNameHint(brandProfileId, hint);
      if (match) {
        stagedPayload.campaign_id = match.campaign_id;
        stagedPayload.campaign_name = match.campaign_name;
      }
    }

    if (!stagedPayload.campaign_id && campaigns.length === 1) {
      stagedPayload.campaign_id = campaigns[0].campaign_id;
      stagedPayload.campaign_name = campaigns[0].campaign_name;
    }

    return {
      kind: intent.kind,
      stagedPayload,
      missingSlots: missingSlots.filter((slot) => {
        if (slot.fieldName === "campaign_id" && stagedPayload.campaign_id) {
          return false;
        }
        if (
          slot.fieldName === "new_campaign_name" &&
          stagedPayload.new_campaign_name
        ) {
          return false;
        }
        return true;
      }),
    };
  }

  buildExecutionWidget(args: {
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
    idempotencyKey: string;
  }): ExecutionWidgetData | null {
    const key = args.idempotencyKey || randomUUID();
    switch (args.intentKind) {
      case "PAUSE_CAMPAIGN":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/pause",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            action: "PAUSE",
          },
          requiredZodValidationSchemaName: "PauseCampaignDto",
          primaryActionLabel: "Confirm pause campaign",
          cancelActionLabel: "Discard",
        };
      case "RESUME_CAMPAIGN":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/resume",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            action: "RESUME",
          },
          requiredZodValidationSchemaName: "ResumeCampaignDto",
          primaryActionLabel: "Confirm resume campaign",
          cancelActionLabel: "Discard",
        };
      case "ARCHIVE_CAMPAIGN":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/archive",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            action: "ARCHIVE",
            note: "Archive sets status to ARCHIVED",
          },
          requiredZodValidationSchemaName: "ArchiveCampaignDto",
          primaryActionLabel: "Confirm archive campaign",
          cancelActionLabel: "Discard",
        };
      case "DUPLICATE_CAMPAIGN":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/duplicate",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            new_campaign_name: args.stagedPayload.new_campaign_name,
          },
          requiredZodValidationSchemaName: "DuplicateCampaignDto",
          primaryActionLabel: "Confirm duplicate campaign",
          cancelActionLabel: "Discard",
        };
      case "BULK_CAMPAIGN_ACTION":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/bulk",
          idempotencyKey: key,
          prefilledFields: {
            bulk_action: args.stagedPayload.bulk_action,
            campaign_ids: args.stagedPayload.campaign_ids,
          },
          requiredZodValidationSchemaName: "BulkCampaignActionDto",
          primaryActionLabel: "Confirm bulk campaign action",
          cancelActionLabel: "Discard",
        };
      default:
        return null;
    }
  }

  writeSlotNarrative(
    kind: WriteIntentKind,
    _stagedPayload?: Record<string, unknown>,
  ): string | null {
    switch (kind) {
      case "PAUSE_CAMPAIGN":
        return "I can pause an ACTIVE campaign after you confirm. Choose the campaign below.";
      case "RESUME_CAMPAIGN":
        return "I can resume a PAUSED campaign after you confirm (activation checklist still applies).";
      case "ARCHIVE_CAMPAIGN":
        return "I can archive a campaign (sets status to ARCHIVED) after you confirm.";
      case "DUPLICATE_CAMPAIGN":
        return "I can duplicate a campaign into a new DRAFT after you confirm the source and new name.";
      case "BULK_CAMPAIGN_ACTION":
        return "I can run a bulk pause/resume/archive after you confirm the action and campaign selection.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    const name = String(
      stagedPayload?.campaign_name ?? stagedPayload?.campaign_id ?? "campaign",
    );
    switch (kind) {
      case "PAUSE_CAMPAIGN":
        return `Review pause for "${name}". Inbound applications go offline; active collabs stay accessible.`;
      case "RESUME_CAMPAIGN":
        return `Review resume for "${name}". Activation checklist must pass.`;
      case "ARCHIVE_CAMPAIGN":
        return `Review archive for "${name}". Status will become ARCHIVED.`;
      case "DUPLICATE_CAMPAIGN":
        return `Review duplicate of "${name}" as "${String(stagedPayload?.new_campaign_name ?? "new draft")}".`;
      case "BULK_CAMPAIGN_ACTION":
        return `Review bulk ${String(stagedPayload?.bulk_action ?? "action")} for the selected campaigns.`;
      default:
        return null;
    }
  }
}

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
import { CoPilotConversationMemoryService } from "../../services/co-pilot-conversation-memory.service";
import {
  isFactOrientedQuestion,
  presentDetailRead,
  presentInventoryRead,
  wantsFullDetailWidget,
} from "../../utils/co-pilot-presentation.util";

const READ_KINDS: ReadQueryKind[] = [
  "LIST_CAMPAIGNS",
  "SEARCH_CAMPAIGNS",
  "FILTER_CAMPAIGNS",
  "SORT_CAMPAIGNS",
  "CAMPAIGN_SUMMARY",
  "CAMPAIGN_STATUS",
  "CAMPAIGN_CHECKLIST",
  "CAMPAIGN_PRODUCTS",
  "CAMPAIGN_BRIEF",
  "CAMPAIGN_INVITES",
  "CAMPAIGN_VALIDATE",
  "CAMPAIGN_PERFORMANCE",
  "COMPARE_CAMPAIGNS",
  "CAMPAIGN_FINANCIALS",
];

const WRITE_INTENTS: WriteIntentKind[] = [
  "PAUSE_CAMPAIGN",
  "RESUME_CAMPAIGN",
  "GO_LIVE_CAMPAIGN",
  "ARCHIVE_CAMPAIGN",
  "DUPLICATE_CAMPAIGN",
  "BULK_CAMPAIGN_ACTION",
  "CAMPAIGN_EDIT_DRAFT",
];

@Injectable()
export class UceCampaignListAiModule implements CoPilotAiModule {
  readonly id = "uce-campaign-list";
  readonly name = "Campaign List";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;
  readonly promptExtension = CAMPAIGN_LIST_PROMPT_EXTENSION;

  constructor(
    private readonly tools: CampaignListToolsService,
    private readonly memory: CoPilotConversationMemoryService,
  ) {}

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
      const single =
        campaigns.length === 1
          ? `You have 1 matching campaign: "${campaigns[0].campaign_name}" (${campaigns[0].current_status}, budget ${campaigns[0].budget_pool}). Ask for summary, performance, or financials anytime.`
          : campaigns.length === 0
            ? "No campaigns matched that request."
            : undefined;
      return {
        ...presentInventoryRead({
          userText: ctx.userText,
          narrativeText: this.tools.listNarrative(campaigns),
          tableData: this.tools.buildCampaignTable(campaigns),
          rowCount: campaigns.length,
          singleItemNarrative: single,
          toolsInvoked: ["uce.listCampaigns"],
        }),
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
          ...presentInventoryRead({
            userText: "list all",
            narrativeText:
              "I need two campaigns to compare. Tell me both names (e.g. Compare Summer Sale with Winter Sale).",
            tableData: this.tools.buildCampaignTable(all),
            rowCount: all.length,
            singleItemNarrative:
              all.length === 1
                ? `Only one campaign is available ("${all[0].campaign_name}"). Name a second campaign to compare.`
                : all.length === 0
                  ? "You don’t have campaigns to compare yet."
                  : undefined,
            toolsInvoked: ["uce.listCampaigns"],
          }),
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
      const mem = this.memory.getCampaignMemory(ctx.threadId);
      if (mem?.selectedCampaignId) {
        campaignId = mem.selectedCampaignId;
        campaignName = mem.selectedCampaignName;
      }
    }

    if (!campaignId) {
      const all = await this.tools.listCampaigns(ctx.brandProfileId, {});
      if (all.length === 1) {
        campaignId = all[0].campaign_id;
        campaignName = all[0].campaign_name;
      } else {
        return {
          ...presentInventoryRead({
            userText: "list all",
            narrativeText:
              "Which campaign should I use? Name it in your next message.",
            tableData: this.tools.buildCampaignTable(all),
            rowCount: all.length,
            singleItemNarrative:
              all.length === 0
                ? "You don’t have any campaigns yet."
                : undefined,
            toolsInvoked: ["uce.listCampaigns"],
          }),
        };
      }
    }

    this.memory.rememberSelectedCampaign(ctx.threadId, {
      id: campaignId,
      name: campaignName ?? campaignId,
    });

    if (kind === "CAMPAIGN_STATUS") {
      const shell = await this.tools.getShell(ctx.brandProfileId, campaignId);
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: this.tools.statusNarrative(shell),
          metricGridData: this.tools.buildStatusMetrics(shell),
          preferMetrics: true,
          toolsInvoked: ["uce.getCampaignStatus"],
        }),
      };
    }

    if (kind === "CAMPAIGN_CHECKLIST") {
      const shell = await this.tools.getShell(ctx.brandProfileId, campaignId);
      const checklist = await this.tools.getChecklist(
        ctx.brandProfileId,
        campaignId,
      );
      return {
        formatType: "VALIDATION_CHECKLIST",
        narrativeText: this.tools.checklistNarrative(shell, checklist),
        validationChecklistData: this.tools.checklistToValidation(
          shell,
          checklist,
        ),
        toolsInvoked: ["uce.getCampaignChecklist"],
      };
    }

    if (kind === "CAMPAIGN_VALIDATE") {
      const shell = await this.tools.getShell(ctx.brandProfileId, campaignId);
      const n = ctx.userText.toLowerCase();
      if (/\bdelete\b/.test(n)) {
        const validated = this.tools.validateDelete(shell);
        return {
          formatType: "VALIDATION_CHECKLIST",
          ...validated,
          toolsInvoked: ["uce.validateDeleteCampaign"],
        };
      }
      const checklist = await this.tools.getChecklist(
        ctx.brandProfileId,
        campaignId,
      );
      const validated = this.tools.validatePublish(shell, checklist);
      return {
        formatType: "VALIDATION_CHECKLIST",
        ...validated,
        toolsInvoked: ["uce.validatePublishCampaign"],
      };
    }

    if (kind === "CAMPAIGN_PRODUCTS") {
      const shell = await this.tools.getShell(ctx.brandProfileId, campaignId);
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText: this.tools.productsNarrative(shell),
        tableData: this.tools.productsTable(shell),
        toolsInvoked: ["uce.getCampaignProducts"],
      };
    }

    if (kind === "CAMPAIGN_BRIEF") {
      const shell = await this.tools.getShell(ctx.brandProfileId, campaignId);
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText: this.tools.briefsNarrative(shell),
        tableData: this.tools.briefsTable(shell),
        toolsInvoked: ["uce.getCampaignBrief"],
      };
    }

    if (kind === "CAMPAIGN_INVITES") {
      const invites = await this.tools.listInvites(
        ctx.brandProfileId,
        campaignId,
      );
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText: this.tools.invitesNarrative({
          campaignName: campaignName ?? campaignId,
          prospects: invites.prospects,
          applicants: invites.applicants,
          active: invites.active,
          userText: ctx.userText,
        }),
        tableData: this.tools.invitesTable(invites),
        toolsInvoked: ["uce.getCampaignInvites"],
      };
    }

    if (kind === "CAMPAIGN_SUMMARY") {
      const summary = await this.tools.getSummary(
        ctx.brandProfileId,
        campaignId,
      );
      const checklist = await this.tools.getChecklist(
        ctx.brandProfileId,
        campaignId,
      );
      const blockers = checklist.filter((c) => !c.satisfied);
      const narrative = `Summary for "${summary.campaign_name}" (${summary.current_status}): budget ${summary.budget_pool}, spend ${summary.total_spend_to_date}, ${summary.utilization_pct}% utilized, ${summary.product_count} products, ${summary.brief_count} briefs, ${summary.total_active_collabs_count} active collabs.${
        blockers.length
          ? ` Checklist still missing: ${blockers.map((b) => b.label).join("; ")}.`
          : " Activation checklist is complete."
      }`;
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: narrative,
          metricGridData: this.tools.buildSummaryMetrics(summary),
          preferMetrics:
            wantsFullDetailWidget(ctx.userText) ||
            (!isFactOrientedQuestion(ctx.userText) &&
              /\b(summary|overview|details|information|explain)\b/i.test(
                ctx.userText,
              )),
          toolsInvoked: [
            "uce.getCampaignOverview",
            "uce.getCampaignChecklist",
          ],
        }),
      };
    }

    if (kind === "CAMPAIGN_PERFORMANCE") {
      const perf = await this.tools.getPerformance(
        ctx.brandProfileId,
        campaignId,
      );
      const narrative = `Performance for "${perf.campaign_name}": ${perf.total_impressions} impressions, spend ${perf.total_spend_to_date}, pipeline ${perf.total_prospects_count} prospects / ${perf.total_applicants_count} applicants / ${perf.total_active_collabs_count} active.`;
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: narrative,
          metricGridData: this.tools.buildPerformanceMetrics(perf),
          preferMetrics:
            wantsFullDetailWidget(ctx.userText) ||
            /\b(performance|metrics|impressions|statistics|progress)\b/i.test(
              ctx.userText,
            ),
          toolsInvoked: ["uce.getCampaignAnalytics"],
        }),
      };
    }

    if (kind === "CAMPAIGN_FINANCIALS") {
      const fin = await this.tools.getFinancials(
        ctx.brandProfileId,
        campaignId,
      );
      const n = ctx.userText.toLowerCase();
      let narrative = `Financials for "${campaignName ?? fin.campaign_name}": pool ${fin.budget_pool}, spend ${fin.total_spend_to_date}, remaining ${fin.remaining_budget} (${fin.utilization_pct}% used).`;
      if (/\bbudget\b/.test(n) && !/\bspend|remaining|financial\b/.test(n)) {
        narrative = `"${campaignName ?? fin.campaign_name}" has a budget pool of ${fin.budget_pool} (${fin.utilization_pct}% used).`;
      } else if (/\bspend\b/.test(n) && !/\bbudget|remaining|financial\b/.test(n)) {
        narrative = `"${campaignName ?? fin.campaign_name}" has spent ${fin.total_spend_to_date} so far.`;
      } else if (/\bremaining\b/.test(n)) {
        narrative = `"${campaignName ?? fin.campaign_name}" has ${fin.remaining_budget} remaining.`;
      }
      return {
        ...presentDetailRead({
          userText: ctx.userText,
          narrativeText: narrative,
          metricGridData: this.tools.buildFinancialMetrics(fin),
          preferMetrics:
            wantsFullDetailWidget(ctx.userText) ||
            /\b(financials|finance overview)\b/i.test(ctx.userText),
          toolsInvoked: ["uce.getCampaignFinancials"],
        }),
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
          ? ("LIVE" as const)
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
        ? ("LIVE" as const)
        : intent.kind === "RESUME_CAMPAIGN"
          ? ("PAUSED" as const)
          : intent.kind === "GO_LIVE_CAMPAIGN"
            ? ("DRAFT" as const)
            : intent.kind === "CAMPAIGN_EDIT_DRAFT"
              ? ("DRAFT" as const)
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
        if (stagedPayload.rename_only) {
          stagedPayload.source_campaign_name = match.campaign_name;
        } else {
          stagedPayload.campaign_name = match.campaign_name;
        }
      }
    }

    if (!stagedPayload.campaign_id && campaigns.length === 1) {
      stagedPayload.campaign_id = campaigns[0].campaign_id;
      if (stagedPayload.rename_only) {
        stagedPayload.source_campaign_name = campaigns[0].campaign_name;
      } else {
        stagedPayload.campaign_name = campaigns[0].campaign_name;
      }
    }

    let kind = intent.kind;
    if (stagedPayload.campaign_id) {
      const matched = campaigns.find(
        (c) => c.campaign_id === stagedPayload.campaign_id,
      );
      const status = matched?.current_status;
      if (
        status === "DRAFT" &&
        (kind === "RESUME_CAMPAIGN" || kind === "GO_LIVE_CAMPAIGN")
      ) {
        kind = "GO_LIVE_CAMPAIGN";
      } else if (
        status === "PAUSED" &&
        (kind === "GO_LIVE_CAMPAIGN" || kind === "RESUME_CAMPAIGN")
      ) {
        kind = "RESUME_CAMPAIGN";
      }
    }

    // Strict preflight: never stage go-live/resume HITL until activation checklist passes.
    if (
      stagedPayload.campaign_id &&
      (kind === "GO_LIVE_CAMPAIGN" || kind === "RESUME_CAMPAIGN")
    ) {
      const campaignId = String(stagedPayload.campaign_id);
      const shell = await this.tools.getShell(brandProfileId, campaignId);
      const checklist = await this.tools.getChecklist(
        brandProfileId,
        campaignId,
      );
      const blockers = checklist.filter((c) => !c.satisfied);
      const statusOk =
        kind === "GO_LIVE_CAMPAIGN"
          ? shell.current_status === "DRAFT"
          : shell.current_status === "PAUSED";
      if (!statusOk || blockers.length > 0) {
        stagedPayload.hitl_blocked = true;
        stagedPayload.hitl_block_title =
          kind === "GO_LIVE_CAMPAIGN" ? "Publish blocked" : "Resume blocked";
        stagedPayload.hitl_block_action =
          kind === "GO_LIVE_CAMPAIGN" ? "GO_LIVE" : "RESUME";
        stagedPayload.hitl_block_code = "CAMPAIGN_NOT_READY";
        stagedPayload.campaign_name = shell.campaign_name;
        stagedPayload.current_status = shell.current_status;
        stagedPayload.hitl_block_items =
          checklist.length > 0
            ? checklist.map((c) => ({
                id: c.key,
                title: c.label,
                satisfied: c.satisfied,
                helpText: c.satisfied
                  ? "Complete"
                  : "Required before this action",
                repairHint: c.satisfied
                  ? undefined
                  : "Open the campaign wizard to fix this, then ask again.",
              }))
            : [
                {
                  id: "status",
                  title: "Valid campaign status",
                  satisfied: false,
                  helpText: `Current status: ${shell.current_status}`,
                  repairHint:
                    kind === "GO_LIVE_CAMPAIGN"
                      ? "Only DRAFT campaigns can go live."
                      : "Only PAUSED campaigns can be resumed.",
                },
              ];
        stagedPayload.hitl_block_narrative =
          blockers.length > 0
            ? `"${shell.campaign_name}" isn’t ready yet. Complete the checklist, then ask again — confirmation is staged only when prerequisites pass.`
            : `"${shell.campaign_name}" can’t run this action in status ${shell.current_status}.`;
        stagedPayload.hitl_block_deep_link = `/brand/campaigns/${campaignId}`;
      } else {
        delete stagedPayload.hitl_blocked;
        delete stagedPayload.activation_blocked;
        delete stagedPayload.activation_checklist;
      }
    }

    // Status gates for other lifecycle writes — no confirm widget when ineligible.
    if (
      stagedPayload.campaign_id &&
      (kind === "PAUSE_CAMPAIGN" ||
        kind === "ARCHIVE_CAMPAIGN" ||
        kind === "CAMPAIGN_EDIT_DRAFT")
    ) {
      const all = await this.tools.listCampaigns(brandProfileId, {});
      const row = all.find((c) => c.campaign_id === stagedPayload.campaign_id);
      const status = row?.current_status;
      if (row) {
        stagedPayload.campaign_name =
          stagedPayload.rename_only
            ? stagedPayload.campaign_name
            : (stagedPayload.campaign_name ?? row.campaign_name);
        stagedPayload.current_status = status;
        stagedPayload.source_campaign_name =
          stagedPayload.source_campaign_name ?? row.campaign_name;
      }

      if (kind === "PAUSE_CAMPAIGN" && status && status !== "LIVE") {
        stagedPayload.hitl_blocked = true;
        stagedPayload.hitl_block_title = "Pause blocked";
        stagedPayload.hitl_block_action = "PAUSE";
        stagedPayload.hitl_block_code = "CAMPAIGN_STATUS_MISMATCH";
        stagedPayload.hitl_block_narrative = `"${row?.campaign_name ?? "Campaign"}" is ${status}. Only LIVE campaigns can be paused.`;
        stagedPayload.hitl_block_deep_link = `/brand/campaigns/${String(stagedPayload.campaign_id)}`;
        stagedPayload.hitl_block_items = [
          {
            id: "status",
            title: "Campaign is LIVE",
            satisfied: false,
            helpText: `Current status: ${status}`,
            repairHint: "Pause only works on LIVE campaigns.",
          },
        ];
      }

      if (kind === "ARCHIVE_CAMPAIGN" && status) {
        const ok =
          status === "LIVE" ||
          status === "PAUSED" ||
          status === "COMPLETED";
        if (!ok) {
          stagedPayload.hitl_blocked = true;
          stagedPayload.hitl_block_title = "Archive blocked";
          stagedPayload.hitl_block_action = "ARCHIVE";
          stagedPayload.hitl_block_code = "CAMPAIGN_STATUS_MISMATCH";
          stagedPayload.hitl_block_narrative = `"${row?.campaign_name ?? "Campaign"}" is ${status}. Archive requires LIVE, PAUSED, or COMPLETED.`;
          stagedPayload.hitl_block_deep_link = `/brand/campaigns/${String(stagedPayload.campaign_id)}`;
          stagedPayload.hitl_block_items = [
            {
              id: "status",
              title: "Archivable status",
              satisfied: false,
              helpText: `Current status: ${status}`,
              repairHint:
                "DRAFT campaigns should be left as draft or removed in the UI.",
            },
          ];
        }
      }

      if (kind === "CAMPAIGN_EDIT_DRAFT" && status && status !== "DRAFT") {
        stagedPayload.hitl_blocked = true;
        stagedPayload.hitl_block_title = "Rename blocked";
        stagedPayload.hitl_block_action = "EDIT_DRAFT";
        stagedPayload.hitl_block_code = "CAMPAIGN_STATUS_MISMATCH";
        stagedPayload.hitl_block_narrative = `"${row?.campaign_name ?? "Campaign"}" is ${status}. Rename from chat only works on DRAFT campaigns.`;
        stagedPayload.hitl_block_deep_link = `/brand/campaigns/${String(stagedPayload.campaign_id)}`;
        stagedPayload.hitl_block_items = [
          {
            id: "status",
            title: "Campaign is DRAFT",
            satisfied: false,
            helpText: `Current status: ${status}`,
            repairHint: "Only drafts can be renamed from co-pilot.",
          },
        ];
      }
    }

    return {
      kind,
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
        if (
          slot.fieldName === "campaign_name" &&
          stagedPayload.campaign_name &&
          stagedPayload.rename_only
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
      case "GO_LIVE_CAMPAIGN":
        return {
          formTargetRoute: "/api/v1/brand-uce/campaigns/lifecycle/go-live",
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            action: "GO_LIVE",
          },
          requiredZodValidationSchemaName: "GoLiveCampaignDto",
          primaryActionLabel: "Confirm go live",
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
      case "CAMPAIGN_EDIT_DRAFT":
        return {
          formTargetRoute: `/api/v1/brand-uce/campaigns/${String(args.stagedPayload.campaign_id ?? "")}/wizard`,
          idempotencyKey: key,
          prefilledFields: {
            campaign_id: args.stagedPayload.campaign_id,
            campaign_name: args.stagedPayload.campaign_name,
            rename_only: args.stagedPayload.rename_only,
          },
          requiredZodValidationSchemaName: "UpdateDraftWizardDto",
          primaryActionLabel: "Confirm rename draft",
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
      case "GO_LIVE_CAMPAIGN":
        return "I can publish a DRAFT campaign (go live) after you confirm. Activation checklist must pass.";
      case "ARCHIVE_CAMPAIGN":
        return "I can archive a campaign (sets status to ARCHIVED) after you confirm.";
      case "DUPLICATE_CAMPAIGN":
        return "I can duplicate a campaign into a new DRAFT after you confirm the source and new name.";
      case "BULK_CAMPAIGN_ACTION":
        return "I can run a bulk pause/resume/archive after you confirm the action and campaign selection.";
      case "CAMPAIGN_EDIT_DRAFT":
        return "I can rename a DRAFT campaign after you confirm the new name.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    const name = String(
      stagedPayload?.source_campaign_name ??
        stagedPayload?.campaign_name ??
        stagedPayload?.campaign_id ??
        "campaign",
    );
    switch (kind) {
      case "PAUSE_CAMPAIGN":
        return `Review pause for "${name}". Inbound applications go offline; active collabs stay accessible.`;
      case "RESUME_CAMPAIGN":
        return `Review resume for "${name}". Activation checklist must pass.`;
      case "GO_LIVE_CAMPAIGN":
        return `Review go live (publish) for "${name}". Draft → ACTIVE if checklist passes.`;
      case "ARCHIVE_CAMPAIGN":
        return `Review archive for "${name}". Status will become ARCHIVED.`;
      case "DUPLICATE_CAMPAIGN":
        return `Review duplicate of "${name}" as "${String(stagedPayload?.new_campaign_name ?? "new draft")}".`;
      case "BULK_CAMPAIGN_ACTION":
        return `Review bulk ${String(stagedPayload?.bulk_action ?? "action")} for the selected campaigns.`;
      case "CAMPAIGN_EDIT_DRAFT":
        return `Review rename of draft to "${String(stagedPayload?.campaign_name ?? "new name")}".`;
      default:
        return null;
    }
  }
}

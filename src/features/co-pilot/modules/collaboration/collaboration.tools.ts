import { Injectable } from "@nestjs/common";
import type { UceMilestoneStage } from "@prisma/client";

import type { AuthUser } from "../../../auth/types/auth-user";
import { CollaborationService } from "../../../collaboration/services/collaboration.service";
import type {
  DataTableData,
  MetricItem,
  ValidationChecklistData,
} from "../../schemas/copilot-payload.schema";
import { fuzzyMatchNamedEntity } from "../../utils/co-pilot-fuzzy-match.util";
import { STAGE_LABELS } from "./collaboration.stages";

export type CollabThreadRow = Awaited<
  ReturnType<CollaborationService["listThreads"]>
>["rows"][number];

export type CollabThreadDetail = Awaited<
  ReturnType<CollaborationService["getThread"]>
>;

function formatInr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

@Injectable()
export class CollaborationCoPilotToolsService {
  constructor(private readonly collaboration: CollaborationService) {}

  async listThreads(
    authUser: AuthUser,
    filters?: { stage?: UceMilestoneStage; search?: string },
  ) {
    const result = await this.collaboration.listThreads(authUser, {
      stage: filters?.stage,
      search: filters?.search,
    });
    return result.rows;
  }

  async getThread(authUser: AuthUser, collaborationId: string) {
    return this.collaboration.getThread(authUser, collaborationId);
  }

  async getCollabReadContext(
    authUser: AuthUser,
    filters?: { stage?: UceMilestoneStage; search?: string },
  ) {
    const list = await this.listThreads(authUser, filters);
    const stuckLogistics = list.filter(
      (t) => t.current_stage === "STAGE_3_LOGISTICS",
    );
    const stuckProduction = list.filter(
      (t) => t.current_stage === "STAGE_4_CONTENT_REVIEW",
    );
    const withIssues = list.filter((t) => t.fulfillment_issue_count >= 1);

    return {
      totalActive: list.length,
      stuckLogistics: stuckLogistics.length,
      stuckProduction: stuckProduction.length,
      withFulfillmentIssues: withIssues.length,
      threads: list.slice(0, 20),
    };
  }

  async findByHint(authUser: AuthUser, hint: string) {
    const threads = await this.listThreads(authUser, {});
    const candidates = threads.flatMap((row) => {
      const names = [
        row.creator_display_name,
        row.creator_handle,
        row.campaign_name,
        row.brief_title,
      ].filter((v): v is string => Boolean(v && String(v).trim()));
      return names.map((name) => ({
        id: row.collaboration_id,
        name,
        row,
      }));
    });
    const match = fuzzyMatchNamedEntity(hint, candidates);
    return match?.row ?? null;
  }

  buildCollabTable(threads: CollabThreadRow[]): DataTableData {
    if (threads.length === 0) {
      return {
        headers: ["Status", "Detail"],
        rows: [{ Status: "—", Detail: "No active collaborations found." }],
      };
    }

    return {
      headers: [
        "Creator",
        "Campaign",
        "Stage",
        "Issues",
        "Negotiation round",
      ],
      rows: threads.map((row) => ({
        Creator: row.creator_display_name ?? row.creator_handle ?? "—",
        Campaign: row.campaign_name,
        Stage: STAGE_LABELS[row.current_stage] ?? row.current_stage,
        Issues: String(row.fulfillment_issue_count),
        "Negotiation round": String(row.negotiation_round),
      })),
    };
  }

  /** Layer 1 status shell. */
  buildStatusMetrics(detail: CollabThreadDetail): MetricItem[] {
    const thread = detail.thread;
    const creator =
      thread.creatorUser.creatorProfile?.displayName ??
      thread.creatorUser.name ??
      thread.creatorHandle;
    return [
      {
        label: "Stage",
        value: STAGE_LABELS[thread.currentStage] ?? thread.currentStage,
        statusColor: "NEUTRAL",
      },
      {
        label: "Payout",
        value: thread.payoutMode,
        statusColor: "NEUTRAL",
      },
      {
        label: "Negotiation round",
        value: String(thread.negotiationRound),
        statusColor: "NEUTRAL",
      },
      {
        label: "Creator",
        value: creator ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Campaign",
        value: thread.campaign.name,
        statusColor: "NEUTRAL",
      },
      {
        label: "Fulfillment issues",
        value: String(thread.fulfillmentIssueCount ?? 0),
        statusColor:
          thread.fulfillmentIssueCount >= 1 ? "YELLOW" : "GREEN",
      },
      {
        label: "Escrow",
        value: detail.commercials?.escrow_status ?? "—",
        statusColor: "NEUTRAL",
      },
    ];
  }

  /**
   * Layer 2 stage artifacts from Collaboration thread detail
   * (commercials / logistics / media / finalization) — not chat messages.
   */
  buildStageDetailMetrics(detail: CollabThreadDetail): MetricItem[] {
    const stage = detail.thread.currentStage;
    const commercials = detail.commercials;
    const logistics = detail.logistics;
    const finalization = detail.finalization;
    const media = detail.media ?? [];

    if (stage === "STAGE_1_NEGOTIATION" || stage === "STAGE_2_SECUREMENT") {
      const metrics: MetricItem[] = [
        {
          label: "Creator quote (initial)",
          value: formatInr(commercials?.initial_quote),
          statusColor: "NEUTRAL",
        },
        {
          label: "Brand counter-offer",
          value:
            commercials?.brand_counter_offer != null
              ? formatInr(commercials.brand_counter_offer)
              : "None yet",
          statusColor: "NEUTRAL",
        },
        {
          label: "Current offer",
          value: formatInr(commercials?.total_quote),
          statusColor: "NEUTRAL",
        },
        {
          label: "Final quote",
          value:
            commercials?.final_quote != null && commercials.final_quote > 0
              ? formatInr(commercials.final_quote)
              : "Not locked",
          statusColor: "NEUTRAL",
        },
        {
          label: "Negotiation round",
          value: String(detail.thread.negotiationRound),
          statusColor: "NEUTRAL",
        },
      ];
      if (stage === "STAGE_2_SECUREMENT") {
        metrics.push(
          {
            label: "Escrow status",
            value: commercials?.escrow_status ?? "—",
            statusColor: "NEUTRAL",
          },
          {
            label: "Advance (30%)",
            value: formatInr(commercials?.advance_30_amount),
            statusColor: "NEUTRAL",
          },
          {
            label: "Balance (70%)",
            value: formatInr(commercials?.balance_70_amount),
            statusColor: "NEUTRAL",
          },
        );
      }
      return metrics;
    }

    if (stage === "STAGE_3_LOGISTICS") {
      return [
        {
          label: "Tracking ID",
          value: logistics?.trackingId?.trim() || "Not set",
          statusColor: logistics?.trackingId ? "GREEN" : "YELLOW",
        },
        {
          label: "Courier",
          value: logistics?.courierName?.trim() || "—",
          statusColor: "NEUTRAL",
        },
        {
          label: "Received by creator",
          value: logistics?.isReceivedConfirmed ? "Yes" : "No",
          statusColor: logistics?.isReceivedConfirmed ? "GREEN" : "YELLOW",
        },
        {
          label: "Open issue",
          value: logistics?.lastReportedIssue ?? "None",
          statusColor: logistics?.lastReportedIssue ? "YELLOW" : "GREEN",
        },
      ];
    }

    if (stage === "STAGE_4_CONTENT_REVIEW") {
      const latest = [...media].sort(
        (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
      )[0];
      return [
        {
          label: "Latest submission",
          value: latest?.mediaUrl?.trim() || "No media yet",
          statusColor: latest?.mediaUrl ? "GREEN" : "YELLOW",
        },
        {
          label: "Submission status",
          value: latest?.status ?? "—",
          statusColor: "NEUTRAL",
        },
        {
          label: "Version",
          value: latest ? String(latest.versionNumber) : "—",
          statusColor: "NEUTRAL",
        },
        {
          label: "Revision count",
          value: String(detail.thread.revisionCount ?? 0),
          statusColor: "NEUTRAL",
        },
      ];
    }

    if (stage === "STAGE_5_PUBLISHING") {
      return [
        {
          label: "Live post URL",
          value: finalization?.livePostUrl?.trim() || "Not submitted",
          statusColor: finalization?.livePostUrl ? "GREEN" : "YELLOW",
        },
        {
          label: "Compliance verified",
          value: finalization?.isComplianceVerified ? "Yes" : "No",
          statusColor: finalization?.isComplianceVerified ? "GREEN" : "YELLOW",
        },
      ];
    }

    if (stage === "STAGE_6_FEEDBACK_SYNC") {
      return [
        {
          label: "Brand rating",
          value:
            finalization?.brandRating != null
              ? String(finalization.brandRating)
              : "Pending",
          statusColor: finalization?.brandRating != null ? "GREEN" : "YELLOW",
        },
        {
          label: "Creator rating",
          value:
            finalization?.creatorRating != null
              ? String(finalization.creatorRating)
              : "Pending",
          statusColor: finalization?.creatorRating != null ? "GREEN" : "YELLOW",
        },
      ];
    }

    return [];
  }

  /** Status shell + current-stage detail (used for STATUS and DETAIL reads). */
  buildStatusAndDetailMetrics(detail: CollabThreadDetail): MetricItem[] {
    return [
      ...this.buildStatusMetrics(detail),
      ...this.buildStageDetailMetrics(detail),
    ];
  }

  detailNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
    userText?: string,
  ): string {
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;
    const commercials = detail.commercials;
    const n = (userText ?? "").toLowerCase();

    if (
      detail.thread.currentStage === "STAGE_1_NEGOTIATION" ||
      detail.thread.currentStage === "STAGE_2_SECUREMENT"
    ) {
      const initial = formatInr(commercials?.initial_quote);
      const counter =
        commercials?.brand_counter_offer != null
          ? formatInr(commercials.brand_counter_offer)
          : null;
      const current = formatInr(commercials?.total_quote);

      if (/\bcounter\b/.test(n)) {
        return counter
          ? `${creatorLabel} on "${campaignName}" has a brand counter-offer of ${counter}.`
          : `${creatorLabel} on "${campaignName}" has no brand counter-offer yet. The creator’s quote on file is ${initial}.`;
      }
      if (/\bcurrent (?:offer|quote|price)\b/.test(n)) {
        return `The current offer for ${creatorLabel} on "${campaignName}" is ${current}.`;
      }
      if (
        /\bquot(?:e|ed|ing)\b/.test(n) ||
        /\bhow much\b/.test(n) ||
        /\bamount\b/.test(n) ||
        /\bprice\b/.test(n) ||
        /\boffer\b/.test(n)
      ) {
        return counter
          ? `${creatorLabel} quoted ${initial} on "${campaignName}". Your counter is ${counter}; current offer is ${current}.`
          : `${creatorLabel} quoted ${initial} on "${campaignName}". No brand counter yet${
              current !== initial ? `; current offer on file is ${current}` : ""
            }.`;
      }

      return `${creatorLabel} on "${campaignName}" is in ${stage} (round ${detail.thread.negotiationRound}). Creator quote ${initial}${
        counter ? `, brand counter ${counter}` : ", no counter yet"
      }, current offer ${current}.`;
    }

    if (detail.thread.currentStage === "STAGE_3_LOGISTICS") {
      const tracking = detail.logistics?.trackingId?.trim();
      if (/\btracking|courier|awb\b/.test(n)) {
        return tracking
          ? `Tracking for ${creatorLabel} on "${campaignName}" is ${tracking}${
              detail.logistics?.courierName
                ? ` via ${detail.logistics.courierName}`
                : ""
            }.`
          : `No tracking ID is set yet for ${creatorLabel} on "${campaignName}".`;
      }
      return `Logistics for ${creatorLabel} on "${campaignName}": tracking ${
        tracking || "not set"
      }, received ${detail.logistics?.isReceivedConfirmed ? "yes" : "no"}.`;
    }

    if (detail.thread.currentStage === "STAGE_4_CONTENT_REVIEW") {
      const latest = [...(detail.media ?? [])].sort(
        (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
      )[0];
      if (/\bsubmit|submission|media|draft\b/.test(n)) {
        return latest?.mediaUrl
          ? `${creatorLabel}’s latest submission on "${campaignName}" is ${latest.mediaUrl} (${latest.status}).`
          : `${creatorLabel} hasn’t submitted media on "${campaignName}" yet.`;
      }
      return `Content review for ${creatorLabel} on "${campaignName}": ${
        latest?.mediaUrl
          ? `latest submission ${latest.mediaUrl} (${latest.status})`
          : "no media submitted yet"
      }.`;
    }

    if (detail.thread.currentStage === "STAGE_5_PUBLISHING") {
      const live = detail.finalization?.livePostUrl?.trim();
      if (/\blive|post|compliance\b/.test(n)) {
        return live
          ? `Live post for ${creatorLabel} on "${campaignName}" is ${live}${
              detail.finalization?.isComplianceVerified
                ? " (compliance verified)"
                : " (compliance not verified yet)"
            }.`
          : `No live post URL yet for ${creatorLabel} on "${campaignName}".`;
      }
      return `Publishing for ${creatorLabel} on "${campaignName}": live post ${
        live || "not submitted"
      }.`;
    }

    return `Collaboration with ${creatorLabel} on "${campaignName}" is in ${stage}.`;
  }

  statusNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
  ): string {
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;
    const commercials = detail.commercials;
    if (detail.thread.currentStage === "STAGE_1_NEGOTIATION") {
      return `${creatorLabel} on "${campaignName}" is in ${stage} (round ${detail.thread.negotiationRound}, ${detail.thread.payoutMode}). Creator quote ${formatInr(
        commercials?.initial_quote,
      )}${
        commercials?.brand_counter_offer != null
          ? `, counter ${formatInr(commercials.brand_counter_offer)}`
          : ", no counter yet"
      }.`;
    }
    return `Collaboration with ${creatorLabel} on "${campaignName}" is in ${stage} (${detail.thread.payoutMode}).`;
  }

  singleCollabListNarrative(row: CollabThreadRow): string {
    const creator = row.creator_display_name ?? row.creator_handle ?? "Creator";
    const stage = STAGE_LABELS[row.current_stage] ?? row.current_stage;
    return `You have 1 active collaboration: ${creator} on "${row.campaign_name}" (${stage}, round ${row.negotiation_round}). Ask about the quote, stage, or next action anytime.`;
  }

  pipelineNarrative(ctx: Awaited<ReturnType<typeof this.getCollabReadContext>>) {
    return `${ctx.totalActive} active collaboration(s). Pipeline snapshot below.`;
  }

  issuesNarrative(ctx: Awaited<ReturnType<typeof this.getCollabReadContext>>) {
    return `${ctx.withFulfillmentIssues} collaboration(s) with fulfillment issues; ${ctx.stuckLogistics} in Logistics, ${ctx.stuckProduction} in Content Review.`;
  }

  selectOptionLabel(row: CollabThreadRow): string {
    const creator = row.creator_display_name ?? row.creator_handle ?? "Creator";
    return `${row.collaboration_id}::${creator} · ${row.campaign_name}`;
  }

  async listMessages(authUser: AuthUser, collaborationId: string) {
    return this.collaboration.listMessages(authUser, collaborationId);
  }

  brandPendingActions(detail: CollabThreadDetail): Array<{
    id: string;
    title: string;
    ready: boolean;
    helpText: string;
  }> {
    const stage = detail.thread.currentStage;
    const commercials = detail.commercials;
    const logistics = detail.logistics;
    const media = detail.media ?? [];
    const latest = [...media].sort(
      (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
    )[0];
    const live = detail.finalization?.livePostUrl?.trim();

    if (stage === "STAGE_1_NEGOTIATION") {
      const hasQuote =
        commercials?.initial_quote != null && commercials.initial_quote > 0;
      return [
        {
          id: "review_quote",
          title: "Review creator quote",
          ready: hasQuote,
          helpText: hasQuote
            ? `Creator quote ${formatInr(commercials?.initial_quote)} is on file.`
            : "Waiting for the creator to send a quote.",
        },
        {
          id: "counter_or_accept",
          title: "Counter-offer or accept terms",
          ready: hasQuote,
          helpText: hasQuote
            ? "Brand can counter-offer or accept the current commercials."
            : "Available after a creator quote exists.",
        },
      ];
    }

    if (stage === "STAGE_2_SECUREMENT") {
      const isEscrow = detail.thread.payoutMode === "ESCROW";
      const funded =
        (commercials?.escrow_status ?? "").toUpperCase().includes("FUND") ||
        (commercials?.escrow_status ?? "").toUpperCase() === "LOCKED";
      return [
        {
          id: "fund_escrow",
          title: isEscrow ? "Fund escrow" : "Complete securement",
          ready: isEscrow && !funded,
          helpText: isEscrow
            ? funded
              ? `Escrow status: ${commercials?.escrow_status ?? "—"}.`
              : "Fund escrow to unlock logistics."
            : "Non-escrow payout — confirm securement in the collaboration UI if still open.",
        },
      ];
    }

    if (stage === "STAGE_3_LOGISTICS") {
      return [
        {
          id: "dispatch",
          title: "Dispatch product / add tracking",
          ready: !logistics?.trackingId,
          helpText: logistics?.trackingId
            ? `Tracking ${logistics.trackingId} is set${
                logistics.isReceivedConfirmed
                  ? "; creator confirmed receipt"
                  : "; waiting for creator receipt"
              }.`
            : "Mark shipped with a tracking ID to advance.",
        },
      ];
    }

    if (stage === "STAGE_4_CONTENT_REVIEW") {
      const pending = latest?.status === "PENDING" || !latest;
      return [
        {
          id: "review_content",
          title: latest
            ? "Approve content or request revision"
            : "Wait for creator content",
          ready: Boolean(latest?.mediaUrl) && pending,
          helpText: latest?.mediaUrl
            ? `Latest submission ${latest.mediaUrl} (${latest.status}).`
            : "Creator hasn’t uploaded content yet.",
        },
      ];
    }

    if (stage === "STAGE_5_PUBLISHING") {
      return [
        {
          id: "verify_compliance",
          title: "Verify live-post compliance",
          ready: Boolean(live) && !detail.finalization?.isComplianceVerified,
          helpText: live
            ? detail.finalization?.isComplianceVerified
              ? "Compliance already verified."
              : `Live post ${live} awaits verification.`
            : "Waiting for the creator to submit a live post URL.",
        },
      ];
    }

    return [
      {
        id: "feedback",
        title: "Leave feedback / ratings",
        ready: true,
        helpText: "Collaboration is in Feedback — use the collaboration UI for ratings.",
      },
    ];
  }

  pendingChecklistData(detail: CollabThreadDetail): ValidationChecklistData {
    const items = this.brandPendingActions(detail);
    return {
      title: "Pending collaboration actions",
      action: "VIEW_PENDING",
      code: "COLLAB_PENDING",
      autoResume: false,
      deepLinkPath: `/brand/collaborations?thread=${detail.thread.id}`,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        satisfied: !item.ready,
        helpText: item.helpText,
        repairHint: item.ready
          ? "Ask me to run this action when you’re ready."
          : undefined,
      })),
      primaryActionLabel: "Open collaboration",
      cancelActionLabel: "Dismiss",
    };
  }

  pendingNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
  ): string {
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;
    const open = this.brandPendingActions(detail).filter((a) => a.ready);
    if (open.length === 0) {
      return `${creatorLabel} on "${campaignName}" is in ${stage}. Nothing is blocked on the brand side right now.`;
    }
    return `${creatorLabel} on "${campaignName}" is in ${stage}. Next for you: ${open
      .map((a) => a.title)
      .join("; ")}.`;
  }

  quoteMetrics(detail: CollabThreadDetail): MetricItem[] {
    const commercials = detail.commercials;
    return [
      {
        label: "Creator quote",
        value: formatInr(commercials?.initial_quote),
        statusColor: commercials?.initial_quote ? "GREEN" : "YELLOW",
      },
      {
        label: "Brand counter",
        value:
          commercials?.brand_counter_offer != null
            ? formatInr(commercials.brand_counter_offer)
            : "None",
        statusColor: "NEUTRAL",
      },
      {
        label: "Current offer",
        value: formatInr(commercials?.total_quote),
        statusColor: "NEUTRAL",
      },
      {
        label: "Final / locked",
        value:
          commercials?.final_quote != null && commercials.final_quote > 0
            ? formatInr(commercials.final_quote)
            : "Not locked",
        statusColor: "NEUTRAL",
      },
      {
        label: "Final offer flag",
        value: commercials?.is_final_offer ? "Yes" : "No",
        statusColor: "NEUTRAL",
      },
    ];
  }

  shipmentMetrics(detail: CollabThreadDetail): MetricItem[] {
    const logistics = detail.logistics;
    return [
      {
        label: "Shipped",
        value: logistics?.trackingId ? "Yes" : "Not yet",
        statusColor: logistics?.trackingId ? "GREEN" : "YELLOW",
      },
      {
        label: "Tracking",
        value: logistics?.trackingId?.trim() || "—",
        statusColor: logistics?.trackingId ? "GREEN" : "YELLOW",
      },
      {
        label: "Courier",
        value: logistics?.courierName?.trim() || "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Received",
        value: logistics?.isReceivedConfirmed ? "Yes" : "No",
        statusColor: logistics?.isReceivedConfirmed ? "GREEN" : "YELLOW",
      },
    ];
  }

  contentMetrics(detail: CollabThreadDetail): MetricItem[] {
    const media = detail.media ?? [];
    const latest = [...media].sort(
      (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
    )[0];
    return [
      {
        label: "Uploaded",
        value: latest?.mediaUrl ? "Yes" : "No",
        statusColor: latest?.mediaUrl ? "GREEN" : "YELLOW",
      },
      {
        label: "Latest URL",
        value: latest?.mediaUrl?.trim() || "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Status",
        value: latest?.status ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Version",
        value: latest ? String(latest.versionNumber) : "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Revisions",
        value: String(detail.thread.revisionCount ?? 0),
        statusColor: "NEUTRAL",
      },
    ];
  }

  deliverablesTable(detail: CollabThreadDetail): DataTableData {
    const briefTitle = detail.thread.brief.internalTitle;
    const guidelines = detail.thread.brief.creativeGuidelines?.trim();
    const media = detail.media ?? [];
    const latest = [...media].sort(
      (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
    )[0];
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;

    return {
      headers: ["Deliverable", "Status", "Detail"],
      rows: [
        {
          Deliverable: briefTitle || "Campaign brief",
          Status: stage,
          Detail: guidelines
            ? guidelines.slice(0, 120)
            : "Brief deliverable for this collaboration",
        },
        {
          Deliverable: "Creator content submission",
          Status: latest?.status ?? "NOT_SUBMITTED",
          Detail: latest?.mediaUrl ?? "Pending upload",
        },
        {
          Deliverable: "Live post",
          Status: detail.finalization?.livePostUrl
            ? detail.finalization.isComplianceVerified
              ? "VERIFIED"
              : "SUBMITTED"
            : "PENDING",
          Detail: detail.finalization?.livePostUrl ?? "—",
        },
      ],
    };
  }

  deliverablesNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
  ): string {
    const media = detail.media ?? [];
    const latest = [...media].sort(
      (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
    )[0];
    const live = detail.finalization?.livePostUrl;
    return `Deliverables for ${creatorLabel} on "${campaignName}": content ${
      latest?.status ?? "not submitted"
    }, live post ${live ? "submitted" : "pending"}.`;
  }

  timelineTable(detail: CollabThreadDetail): DataTableData {
    const stageOrder = [
      "STAGE_1_NEGOTIATION",
      "STAGE_2_SECUREMENT",
      "STAGE_3_LOGISTICS",
      "STAGE_4_CONTENT_REVIEW",
      "STAGE_5_PUBLISHING",
      "STAGE_6_FEEDBACK_SYNC",
    ] as const;
    const currentIdx = stageOrder.indexOf(
      detail.thread.currentStage as (typeof stageOrder)[number],
    );
    const rows = stageOrder.map((stage, idx) => {
      let status = "Upcoming";
      if (idx < currentIdx) status = "Done";
      if (idx === currentIdx) status = "Current";
      return {
        Stage: STAGE_LABELS[stage],
        Status: status,
        Notes:
          idx === currentIdx
            ? this.pendingNarrative(
                detail,
                detail.thread.creatorUser.creatorProfile?.displayName ??
                  detail.thread.creatorHandle,
                detail.thread.campaign.name,
              )
            : "—",
      };
    });
    return {
      headers: ["Stage", "Status", "Notes"],
      rows,
    };
  }

  timelineNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
  ): string {
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;
    return `${creatorLabel} on "${campaignName}" has progressed to ${stage} (round ${detail.thread.negotiationRound}). Timeline below shows completed vs upcoming stages.`;
  }

  creatorMetrics(detail: CollabThreadDetail): MetricItem[] {
    const profile = detail.thread.creatorUser.creatorProfile;
    return [
      {
        label: "Display name",
        value:
          profile?.displayName ?? detail.thread.creatorUser.name ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Handle",
        value: detail.thread.creatorHandle ?? "—",
        statusColor: "NEUTRAL",
      },
      {
        label: "Instagram",
        value: profile?.instagramHandle
          ? `@${profile.instagramHandle.replace(/^@/, "")}`
          : "—",
        statusColor: profile?.instagramHandle ? "GREEN" : "YELLOW",
      },
      {
        label: "Email",
        value: detail.thread.creatorUser.email ?? "—",
        statusColor: "NEUTRAL",
      },
    ];
  }

  creatorNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
  ): string {
    const ig = detail.thread.creatorUser.creatorProfile?.instagramHandle;
    return `Creator on this collaboration: ${creatorLabel}${
      ig ? ` (@${ig.replace(/^@/, "")})` : ""
    }.`;
  }

  conversationTable(
    messages: Awaited<
      ReturnType<CollaborationService["listMessages"]>
    >["messages"],
  ): DataTableData {
    const recent = messages.slice(-15);
    if (recent.length === 0) {
      return {
        headers: ["When", "Kind", "Message"],
        rows: [{ When: "—", Kind: "—", Message: "No messages yet." }],
      };
    }
    return {
      headers: ["When", "Kind", "Message"],
      rows: recent.map((m) => ({
        When: m.created_at,
        Kind: m.kind,
        Message: (m.body ?? "").slice(0, 160),
      })),
    };
  }

  conversationNarrative(
    messages: Awaited<
      ReturnType<CollaborationService["listMessages"]>
    >["messages"],
    creatorLabel: string,
  ): string {
    if (messages.length === 0) {
      return `No conversation messages yet with ${creatorLabel}.`;
    }
    const last = messages[messages.length - 1];
    return `${messages.length} message(s) with ${creatorLabel}. Latest (${last.kind}): “${(last.body ?? "").slice(0, 120)}”.`;
  }

  analyticsMetrics(threads: CollabThreadRow[]): MetricItem[] {
    const byStage = (stage: string) =>
      threads.filter((t) => t.current_stage === stage).length;
    return [
      {
        label: "Active collaborations",
        value: String(threads.length),
        statusColor: "NEUTRAL",
      },
      {
        label: "Negotiation",
        value: String(byStage("STAGE_1_NEGOTIATION")),
        statusColor: "NEUTRAL",
      },
      {
        label: "Securement",
        value: String(byStage("STAGE_2_SECUREMENT")),
        statusColor: "NEUTRAL",
      },
      {
        label: "Logistics",
        value: String(byStage("STAGE_3_LOGISTICS")),
        statusColor: "NEUTRAL",
      },
      {
        label: "Content review",
        value: String(byStage("STAGE_4_CONTENT_REVIEW")),
        statusColor: "NEUTRAL",
      },
      {
        label: "Publishing",
        value: String(byStage("STAGE_5_PUBLISHING")),
        statusColor: "NEUTRAL",
      },
      {
        label: "With issues",
        value: String(
          threads.filter((t) => t.fulfillment_issue_count >= 1).length,
        ),
        statusColor: "YELLOW",
      },
    ];
  }

  analyticsNarrative(threads: CollabThreadRow[]): string {
    const pending =
      threads.filter((t) => t.current_stage === "STAGE_1_NEGOTIATION")
        .length +
      threads.filter((t) => t.current_stage === "STAGE_2_SECUREMENT").length;
    return `${threads.length} active collaboration(s); ${pending} waiting in negotiation/securement. Stage breakdown below.`;
  }

  summaryNarrative(
    detail: CollabThreadDetail,
    creatorLabel: string,
    campaignName: string,
  ): string {
    const stage =
      STAGE_LABELS[detail.thread.currentStage] ?? detail.thread.currentStage;
    const pending = this.pendingNarrative(detail, creatorLabel, campaignName);
    return `Summary — ${creatorLabel} / "${campaignName}" is in ${stage} (${detail.thread.payoutMode}, round ${detail.thread.negotiationRound}). ${pending}`;
  }

  validateActionChecklist(
    detail: CollabThreadDetail,
    userText: string,
  ): {
    narrativeText: string;
    validationChecklistData: ValidationChecklistData;
  } {
    const n = userText.toLowerCase();
    const stage = detail.thread.currentStage;
    const items: Array<{
      id: string;
      title: string;
      satisfied: boolean;
      helpText?: string;
      repairHint?: string;
    }> = [];

    let action = "VALIDATE";
    let title = "Can this action proceed?";

    if (/\b(accept|quote)\b/.test(n)) {
      action = "ACCEPT_TERMS";
      title = "Accept quote readiness";
      const ok = stage === "STAGE_1_NEGOTIATION";
      items.push({
        id: "stage",
        title: "In Negotiation",
        satisfied: ok,
        helpText: ok
          ? "Stage allows accept terms."
          : `Current stage is ${STAGE_LABELS[stage] ?? stage}.`,
        repairHint: ok
          ? undefined
          : "Open a negotiation-stage collaboration or wait until it returns to Negotiation.",
      });
      items.push({
        id: "quote",
        title: "Creator quote on file",
        satisfied: Boolean(detail.commercials?.initial_quote),
        helpText: detail.commercials?.initial_quote
          ? `Quote ${formatInr(detail.commercials.initial_quote)}`
          : "No creator quote yet.",
      });
    } else if (/\b(ship|dispatch|shipment)\b/.test(n)) {
      action = "DISPATCH";
      title = "Shipment readiness";
      const ok = stage === "STAGE_3_LOGISTICS";
      items.push({
        id: "stage",
        title: "In Logistics",
        satisfied: ok,
        helpText: ok
          ? "Stage allows dispatch."
          : `Current stage is ${STAGE_LABELS[stage] ?? stage}.`,
      });
    } else if (/\b(approve|reject|content|revision)\b/.test(n)) {
      action = "APPROVE_CONTENT";
      title = "Content review readiness";
      const ok = stage === "STAGE_4_CONTENT_REVIEW";
      const latest = [...(detail.media ?? [])].sort(
        (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
      )[0];
      items.push({
        id: "stage",
        title: "In Content Review",
        satisfied: ok,
        helpText: ok
          ? "Stage allows approve/reject content."
          : `Current stage is ${STAGE_LABELS[stage] ?? stage}.`,
      });
      items.push({
        id: "media",
        title: "Content submitted",
        satisfied: Boolean(latest?.mediaUrl),
        helpText: latest?.mediaUrl ?? "No media uploaded yet.",
      });
    } else if (/\breject (?:the )?quote|decline\b/.test(n)) {
      action = "REJECT_QUOTE";
      title = "Reject quote";
      items.push({
        id: "api",
        title: "Reject-quote in chat",
        satisfied: false,
        helpText:
          "Brand co-pilot can’t hard-decline a quote in chat yet. Counter-offer instead, or open the collaboration UI.",
        repairHint: "Say “counter-offer 12000” or open /brand/collaborations.",
      });
    } else {
      const pending = this.brandPendingActions(detail);
      for (const p of pending) {
        items.push({
          id: p.id,
          title: p.title,
          satisfied: !p.ready,
          helpText: p.helpText,
        });
      }
    }

    const blocked = items.some((i) => !i.satisfied);
    return {
      narrativeText: blocked
        ? "Not ready yet — checklist below explains what’s blocking."
        : "Yes — prerequisites look good. Confirm the action when you’re ready.",
      validationChecklistData: {
        title,
        action,
        code: "COLLAB_VALIDATE",
        autoResume: false,
        deepLinkPath: `/brand/collaborations?thread=${detail.thread.id}`,
        items,
        primaryActionLabel: "Open collaboration",
        cancelActionLabel: "Dismiss",
      },
    };
  }
}

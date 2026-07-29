import { Injectable } from "@nestjs/common";
import type { UceMilestoneStage } from "@prisma/client";

import type { AuthUser } from "../../../auth/types/auth-user";
import { CollaborationService } from "../../../collaboration/services/collaboration.service";
import type {
  DataTableData,
  MetricItem,
} from "../../schemas/copilot-payload.schema";
import { fuzzyMatchNamedEntity } from "../../utils/co-pilot-fuzzy-match.util";
import { STAGE_LABELS } from "./collaboration.stages";

export type CollabThreadRow = Awaited<
  ReturnType<CollaborationService["listThreads"]>
>["rows"][number];

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

  buildStatusMetrics(
    detail: Awaited<ReturnType<CollaborationService["getThread"]>>,
  ): MetricItem[] {
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
}

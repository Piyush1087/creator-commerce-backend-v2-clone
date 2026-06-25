import { Injectable } from "@nestjs/common";

import type { AuthUser } from "../../auth/types/auth-user";
import { CollaborationService } from "../../collaboration/services/collaboration.service";
import type { DataTableData } from "../schemas/copilot-payload.schema";

@Injectable()
export class CollaborationCoPilotToolsService {
  constructor(private readonly collaboration: CollaborationService) {}

  async getCollabReadContext(user: AuthUser, filters?: { stage?: string }) {
    const result = await this.collaboration.listThreads(user, {
      stage: filters?.stage as never,
    });

    const list = result.rows;

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

  buildCollabTable(context: Awaited<ReturnType<typeof this.getCollabReadContext>>): DataTableData {
    if (context.threads.length === 0) {
      return {
        headers: ["Status", "Detail"],
        rows: [{ Status: "—", Detail: "No active collaborations found." }],
      };
    }

    return {
      headers: ["Creator", "Campaign", "Stage", "Issues", "Negotiation round"],
      rows: context.threads.map((row) => ({
        Creator: row.creator_display_name ?? row.creator_handle ?? "—",
        Campaign: row.campaign_name,
        Stage: row.current_stage,
        Issues: String(row.fulfillment_issue_count),
        "Negotiation round": String(row.negotiation_round),
      })),
    };
  }
}

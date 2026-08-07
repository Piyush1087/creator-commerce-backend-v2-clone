import { BadRequestException, Injectable } from "@nestjs/common";
import type { CoPilotScopeContext } from "@prisma/client";

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
import { CoPilotIntentService } from "../../services/co-pilot-intent.service";
import { PlannerCoPilotToolsService } from "../../tools/planner.tools";
import {
  buildPlannerLaunchGuidanceFooter,
  isPlannerLaunchGuidanceQuery,
  isPlannerPipelineReadQuery,
  plannerCardLabel,
  resolvePlannerCardFromContext,
} from "../../utils/co-pilot-planner.util";
import { mentionsPlanner } from "../../utils/co-pilot-planner.util";
import {
  presentInventoryRead,
  wantsInventoryWidget,
} from "../../utils/co-pilot-presentation.util";

const READ_KINDS: ReadQueryKind[] = ["PLANNER_PIPELINE", "CAMPAIGN_DRAFT_LIST"];
const WRITE_INTENTS: WriteIntentKind[] = [
  "PLANNER_LAUNCH_DRAFT",
  "CAMPAIGN_LAUNCH",
  "CAMPAIGN_EDIT_DRAFT",
];

@Injectable()
export class BrandCentrePlannerAiModule implements CoPilotAiModule {
  readonly id = "brand-centre-planner";
  readonly name = "Campaign Planner";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;

  constructor(
    private readonly plannerTools: PlannerCoPilotToolsService,
    private readonly intents: CoPilotIntentService,
  ) {}

  detectRead(userText: string, _scope: CoPilotScopeContext): ReadQueryKind | null {
    if (isPlannerLaunchGuidanceQuery(userText) || isPlannerPipelineReadQuery(userText)) {
      return "PLANNER_PIPELINE";
    }
    const n = userText.toLowerCase();
    if (mentionsPlanner(n)) {
      return null;
    }
    if (
      (n.includes("draft") && n.includes("campaign")) ||
      n.includes("draft campaigns") ||
      n.includes("list my drafts")
    ) {
      return "CAMPAIGN_DRAFT_LIST";
    }
    return null;
  }

  detectWrite(
    userText: string,
    _history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null {
    return (
      this.intents.detectCampaignEditDraft(userText) ??
      this.intents.detectPlannerLaunchDraft(userText) ??
      (() => {
        const launch = this.intents.detectCampaignLaunch(userText);
        return launch.kind === "NONE" ? null : launch;
      })()
    );
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (kind === "PLANNER_PIPELINE") {
      const dashboard = await this.plannerTools.getPlannerReadContext(
        ctx.brandProfileId,
      );
      const launchable = await this.plannerTools.listLaunchablePlannerCards(
        ctx.brandProfileId,
      );
      let narrative = this.plannerTools.buildPlannerPipelineNarrative(dashboard);
      if (isPlannerLaunchGuidanceQuery(ctx.userText) || launchable.length > 0) {
        narrative = `${narrative}\n\n${buildPlannerLaunchGuidanceFooter(launchable.length)}`;
      }
      const cardCount = dashboard.cards.length;
      const forceTable =
        wantsInventoryWidget(ctx.userText) ||
        isPlannerPipelineReadQuery(ctx.userText) ||
        cardCount >= 2;
      return {
        ...presentInventoryRead({
          userText: forceTable ? "list pipeline" : ctx.userText,
          narrativeText: narrative,
          tableData: this.plannerTools.buildPlannerTable(dashboard),
          rowCount: forceTable ? Math.max(cardCount, 2) : cardCount,
          singleItemNarrative:
            cardCount === 1
              ? narrative
              : cardCount === 0
                ? narrative
                : undefined,
          toolsInvoked: ["planner.getPlannerReadContext"],
        }),
      };
    }

    if (kind === "CAMPAIGN_DRAFT_LIST") {
      const drafts = await this.plannerTools.listDraftCampaigns(
        ctx.brandProfileId,
      );
      return {
        ...presentInventoryRead({
          userText: ctx.userText,
          narrativeText: this.plannerTools.buildDraftCampaignsNarrative(drafts),
          tableData: this.plannerTools.buildDraftCampaignsTable(drafts),
          rowCount: drafts.length,
          singleItemNarrative:
            drafts.length === 1
              ? `You have 1 draft campaign: "${drafts[0].campaign_name}" (budget ${drafts[0].budget_pool}).`
              : drafts.length === 0
                ? "You don’t have any draft campaigns yet."
                : undefined,
          toolsInvoked: ["uce.listDraftCampaigns"],
        }),
      };
    }

    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    brandProfileId: string,
    context?: {
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      userText: string;
    },
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    const stagedPayload = { ...intent.stagedPayload };
    const missingSlots = intent.missingSlots.map((s) => ({ ...s }));

    if (intent.kind === "PLANNER_LAUNCH_DRAFT") {
      const cards = await this.plannerTools.listLaunchablePlannerCards(
        brandProfileId,
      );
      if (cards.length === 0) {
        throw new BadRequestException(
          "No green planner cards are pending review. Move a leak to the planner first.",
        );
      }
      let matched = context
        ? resolvePlannerCardFromContext(context.history, cards, context.userText)
        : undefined;
      if (!matched && cards.length === 1) matched = cards[0];
      const cardSlot = missingSlots.find((s) => s.fieldName === "planner_card_id");
      if (cardSlot) {
        cardSlot.selectOptions = cards.map(
          (card) =>
            `${card.id}::${card.aiContextHook ?? card.strategy.objective ?? "Planner card"}`,
        );
      }
      if (matched) {
        stagedPayload.planner_card_id = matched.id;
        stagedPayload.planner_card_label = plannerCardLabel(matched);
      }
    }

    if (intent.kind === "CAMPAIGN_EDIT_DRAFT") {
      const drafts = await this.plannerTools.listDraftCampaigns(brandProfileId);
      if (drafts.length === 0) {
        throw new BadRequestException("No DRAFT campaigns found to edit.");
      }
      const campaignSlot = missingSlots.find((s) => s.fieldName === "campaign_id");
      if (campaignSlot) {
        campaignSlot.selectOptions = drafts.map(
          (draft) => `${draft.campaign_id}::${draft.campaign_name}`,
        );
      }
      if (drafts.length === 1) {
        stagedPayload.campaign_id = drafts[0].campaign_id;
        stagedPayload.campaign_name = drafts[0].campaign_name;
      }
    }

    return {
      kind: intent.kind,
      stagedPayload,
      missingSlots: missingSlots.filter((slot) => {
        if (slot.fieldName === "planner_card_id" && stagedPayload.planner_card_id) {
          return false;
        }
        if (slot.fieldName === "campaign_id" && stagedPayload.campaign_id) {
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
    if (!WRITE_INTENTS.includes(args.intentKind)) return null;
    return this.intents.buildExecutionWidget({
      intentKind: args.intentKind as
        | "PLANNER_LAUNCH_DRAFT"
        | "CAMPAIGN_LAUNCH"
        | "CAMPAIGN_EDIT_DRAFT"
        | "DNA_IDENTITY_UPDATE"
        | "DNA_OFFERING_UPDATE"
        | "DNA_PERSONA_CREATE"
        | "INTELLIGENCE_MOVE_TO_PLANNER",
      stagedPayload: args.stagedPayload,
      idempotencyKey: args.idempotencyKey,
    });
  }

  writeSlotNarrative(kind: WriteIntentKind): string | null {
    switch (kind) {
      case "PLANNER_LAUNCH_DRAFT":
        return "I can approve a planner card and create a UCE draft campaign (with products and briefs pre-filled) after you confirm.";
      case "CAMPAIGN_EDIT_DRAFT":
        return "I can update a DRAFT campaign only — live or paused campaigns must be edited in Campaigns.";
      case "CAMPAIGN_LAUNCH":
        return "I can stage a campaign draft, but I need a few details before you confirm anything.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(kind: WriteIntentKind): string | null {
    switch (kind) {
      case "PLANNER_LAUNCH_DRAFT":
        return "Review the planner card launch. A DRAFT UCE campaign will be created after you confirm.";
      case "CAMPAIGN_EDIT_DRAFT":
        return "Review the draft campaign changes below. Only DRAFT campaigns can be updated from chat.";
      case "CAMPAIGN_LAUNCH":
        return "Review the staged campaign draft below. Nothing is saved until you confirm.";
      default:
        return null;
    }
  }
}

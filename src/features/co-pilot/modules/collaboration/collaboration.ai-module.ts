import { Injectable } from "@nestjs/common";
import type { CoPilotScopeContext, UceMilestoneStage } from "@prisma/client";
import { randomUUID } from "crypto";

import type { AuthUser } from "../../../auth/types/auth-user";
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
import { CoPilotConversationMemoryService } from "../../services/co-pilot-conversation-memory.service";
import {
  detectCollaborationRead,
  detectCollaborationWrite,
  extractCreatorOrCampaignHint,
} from "./collaboration.intents";
import { COLLABORATION_PROMPT_EXTENSION } from "./collaboration.prompt";
import {
  extractStageFilter,
  isBrandWriteAllowedAtStage,
  STAGE_LABELS,
} from "./collaboration.stages";
import {
  CollaborationCoPilotToolsService,
  type CollabThreadRow,
} from "./collaboration.tools";

const READ_KINDS: ReadQueryKind[] = [
  "COLLAB_PIPELINE",
  "COLLAB_ISSUES",
  "COLLAB_STATUS",
];

const WRITE_INTENTS: WriteIntentKind[] = [
  "COLLAB_COUNTER_OFFER",
  "COLLAB_ACCEPT_TERMS",
  "COLLAB_FUND_ESCROW",
  "COLLAB_DISPATCH",
  "COLLAB_APPROVE_CONTENT",
  "COLLAB_REQUEST_REVISION",
  "COLLAB_VERIFY_COMPLIANCE",
];

function parseSelectId(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const value = raw.trim();
  const sep = value.indexOf("::");
  return sep >= 0 ? value.slice(0, sep) : value;
}

@Injectable()
export class CollaborationAiModule implements CoPilotAiModule {
  readonly id = "collaboration";
  readonly name = "Collaboration";
  readonly supportedReadKinds = READ_KINDS;
  readonly supportedWriteIntents = WRITE_INTENTS;
  readonly promptExtension = COLLABORATION_PROMPT_EXTENSION;

  constructor(
    private readonly tools: CollaborationCoPilotToolsService,
    private readonly memory: CoPilotConversationMemoryService,
  ) {}

  detectRead(
    userText: string,
    _scope: CoPilotScopeContext,
  ): ReadQueryKind | null {
    return detectCollaborationRead(userText);
  }

  detectWrite(
    userText: string,
    _history: Array<{ role: "USER" | "ASSISTANT"; text: string }>,
  ): DetectedWriteIntent | null {
    return detectCollaborationWrite(userText);
  }

  async executeRead(
    kind: ReadQueryKind,
    ctx: CoPilotModuleReadContext,
  ): Promise<CoPilotModuleReadResult | null> {
    if (!READ_KINDS.includes(kind)) {
      return null;
    }

    const authUser = ctx.authUser as AuthUser | undefined;
    if (!authUser) {
      return {
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "I couldn’t load collaborations without an authenticated brand session.",
      };
    }

    const n = ctx.userText.toLowerCase();
    const stage = extractStageFilter(n);
    const search =
      extractCreatorOrCampaignHint(ctx.userText) ??
      (n.includes("search")
        ? ctx.userText.replace(/search/i, "").trim()
        : undefined);

    if (kind === "COLLAB_PIPELINE" || kind === "COLLAB_ISSUES") {
      const collabCtx = await this.tools.getCollabReadContext(authUser, {
        stage,
        search: kind === "COLLAB_PIPELINE" ? search : undefined,
      });
      this.memory.rememberListedCollaborations(
        ctx.threadId,
        collabCtx.threads.map((t) => ({
          id: t.collaboration_id,
          name: `${t.creator_display_name ?? t.creator_handle ?? "Creator"} · ${t.campaign_name}`,
          stage: t.current_stage,
          campaignName: t.campaign_name,
        })),
      );
      const tableThreads =
        kind === "COLLAB_ISSUES"
          ? collabCtx.threads.filter(
              (t) =>
                t.fulfillment_issue_count >= 1 ||
                t.current_stage === "STAGE_3_LOGISTICS" ||
                t.current_stage === "STAGE_4_CONTENT_REVIEW",
            )
          : collabCtx.threads;
      return {
        formatType: "TABULAR_AUDIT_DATA",
        narrativeText:
          kind === "COLLAB_ISSUES"
            ? this.tools.issuesNarrative(collabCtx)
            : this.tools.pipelineNarrative(collabCtx) +
              (stage
                ? ` Filtered to ${STAGE_LABELS[stage] ?? stage}.`
                : ""),
        tableData: this.tools.buildCollabTable(tableThreads),
        toolsInvoked: ["collab.listThreads"],
      };
    }

    if (kind === "COLLAB_STATUS") {
      const resolved = await this.resolveThreadForRead(authUser, ctx);
      if (!resolved) {
        const all = await this.tools.listThreads(authUser, {});
        this.memory.rememberListedCollaborations(
          ctx.threadId,
          all.map((t) => ({
            id: t.collaboration_id,
            name: `${t.creator_display_name ?? t.creator_handle ?? "Creator"} · ${t.campaign_name}`,
            stage: t.current_stage,
            campaignName: t.campaign_name,
          })),
        );
        return {
          formatType: "TABULAR_AUDIT_DATA",
          narrativeText:
            "Which collaboration should I open? Pick one from the list or name the creator/campaign.",
          tableData: this.tools.buildCollabTable(all),
          toolsInvoked: ["collab.listThreads"],
        };
      }

      const detail = await this.tools.getThread(
        authUser,
        resolved.collaboration_id,
      );
      this.memory.rememberSelectedCollaboration(ctx.threadId, {
        id: resolved.collaboration_id,
        name: `${resolved.creator_display_name ?? resolved.creator_handle ?? "Creator"} · ${resolved.campaign_name}`,
        stage: resolved.current_stage,
        campaignName: resolved.campaign_name,
      });
      return {
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText: `Collaboration with ${resolved.creator_display_name ?? resolved.creator_handle ?? "creator"} on "${resolved.campaign_name}" is in ${STAGE_LABELS[resolved.current_stage] ?? resolved.current_stage}.`,
        metricGridData: this.tools.buildStatusMetrics(detail),
        toolsInvoked: ["collab.getThread"],
      };
    }

    return null;
  }

  async enrichWriteIntent(
    intent: Exclude<DetectedWriteIntent, { kind: "NONE" }>,
    _brandProfileId: string,
    context?: {
      history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
      userText: string;
      authUser?: unknown;
      threadId?: string;
    },
  ): Promise<Exclude<DetectedWriteIntent, { kind: "NONE" }>> {
    if (!WRITE_INTENTS.includes(intent.kind as WriteIntentKind)) {
      return intent;
    }

    const authUser = context?.authUser as AuthUser | undefined;
    if (!authUser) {
      return intent;
    }

    const threadId = context?.threadId;
    const stagedPayload = { ...intent.stagedPayload };
    const missingSlots = intent.missingSlots.map((s) => ({ ...s }));

    const preferredStage = this.preferredStageForIntent(intent.kind);
    let threads = await this.tools.listThreads(authUser, {
      stage: preferredStage,
    });
    if (threads.length === 0) {
      threads = await this.tools.listThreads(authUser, {});
    }

    if (threadId) {
      this.memory.rememberListedCollaborations(
        threadId,
        threads.map((t) => ({
          id: t.collaboration_id,
          name: `${t.creator_display_name ?? t.creator_handle ?? "Creator"} · ${t.campaign_name}`,
          stage: t.current_stage,
          campaignName: t.campaign_name,
        })),
      );
    }

    const collabSlot = missingSlots.find(
      (s) => s.fieldName === "collaboration_id",
    );
    if (collabSlot) {
      collabSlot.selectOptions = threads.map((t) =>
        this.tools.selectOptionLabel(t),
      );
    }

    const hint = String(stagedPayload.creator_or_campaign_hint ?? "").trim();
    if (hint && !stagedPayload.collaboration_id) {
      const match = await this.tools.findByHint(authUser, hint);
      if (match) {
        stagedPayload.collaboration_id = match.collaboration_id;
        stagedPayload.creator_label =
          match.creator_display_name ?? match.creator_handle;
        stagedPayload.campaign_name = match.campaign_name;
        stagedPayload.current_stage = match.current_stage;
      }
    }

    if (!stagedPayload.collaboration_id && threadId) {
      const mem = this.memory.getCollaborationMemory(threadId);
      if (mem?.selectedCollaborationId) {
        const selected = threads.find(
          (t) => t.collaboration_id === mem.selectedCollaborationId,
        );
        if (selected) {
          stagedPayload.collaboration_id = selected.collaboration_id;
          stagedPayload.creator_label =
            selected.creator_display_name ?? selected.creator_handle;
          stagedPayload.campaign_name = selected.campaign_name;
          stagedPayload.current_stage = selected.current_stage;
        }
      }
    }

    if (!stagedPayload.collaboration_id && threads.length === 1) {
      stagedPayload.collaboration_id = threads[0].collaboration_id;
      stagedPayload.creator_label =
        threads[0].creator_display_name ?? threads[0].creator_handle;
      stagedPayload.campaign_name = threads[0].campaign_name;
      stagedPayload.current_stage = threads[0].current_stage;
    }

    if (stagedPayload.collaboration_id && threadId) {
      this.memory.rememberSelectedCollaboration(threadId, {
        id: String(stagedPayload.collaboration_id),
        name: `${String(stagedPayload.creator_label ?? "Creator")} · ${String(stagedPayload.campaign_name ?? "")}`,
        stage: String(stagedPayload.current_stage ?? ""),
        campaignName: String(stagedPayload.campaign_name ?? ""),
      });
    }

    if (
      stagedPayload.collaboration_id &&
      stagedPayload.current_stage &&
      !isBrandWriteAllowedAtStage(
        intent.kind,
        stagedPayload.current_stage as UceMilestoneStage,
      )
    ) {
      stagedPayload.stage_mismatch = true;
    }

    return {
      kind: intent.kind,
      stagedPayload,
      missingSlots: missingSlots.filter((slot) => {
        if (
          slot.fieldName === "collaboration_id" &&
          stagedPayload.collaboration_id
        ) {
          return false;
        }
        if (
          slot.fieldName === "counter_offer" &&
          stagedPayload.counter_offer !== undefined &&
          stagedPayload.counter_offer !== null &&
          String(stagedPayload.counter_offer).trim() !== ""
        ) {
          return false;
        }
        if (slot.fieldName === "tracking_id" && stagedPayload.tracking_id) {
          return false;
        }
        if (
          slot.fieldName === "brand_feedback" &&
          stagedPayload.brand_feedback
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
    const collabId = parseSelectId(args.stagedPayload.collaboration_id);
    const baseFields = {
      collaboration_id: collabId,
      creator_label: args.stagedPayload.creator_label,
      campaign_name: args.stagedPayload.campaign_name,
      current_stage: args.stagedPayload.current_stage,
    };

    switch (args.intentKind) {
      case "COLLAB_COUNTER_OFFER":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/negotiation/counter-offer`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            counter_offer: args.stagedPayload.counter_offer,
            action: "COUNTER_OFFER",
          },
          requiredZodValidationSchemaName: "BrandCounterOfferDto",
          primaryActionLabel: "Confirm counter-offer",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_ACCEPT_TERMS":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/negotiation/accept`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            action: "ACCEPT_TERMS",
          },
          requiredZodValidationSchemaName: "AcceptCommercialsDto",
          primaryActionLabel: "Confirm accept terms",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_FUND_ESCROW":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/securement/fund-escrow`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            action: "FUND_ESCROW",
          },
          requiredZodValidationSchemaName: "FundEscrowDto",
          primaryActionLabel: "Confirm fund escrow",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_DISPATCH":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/logistics/dispatch`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            tracking_id: args.stagedPayload.tracking_id,
            courier_name: args.stagedPayload.courier_name,
            action: "DISPATCH",
          },
          requiredZodValidationSchemaName: "DispatchLogisticsDto",
          primaryActionLabel: "Confirm dispatch",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_APPROVE_CONTENT":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/production/review`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            decision: "APPROVED",
            action: "APPROVE_CONTENT",
          },
          requiredZodValidationSchemaName: "ReviewCollaborationMediaDto",
          primaryActionLabel: "Confirm approve content",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_REQUEST_REVISION":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/production/review`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            decision: "REJECTED",
            brand_feedback: args.stagedPayload.brand_feedback,
            action: "REQUEST_REVISION",
          },
          requiredZodValidationSchemaName: "ReviewCollaborationMediaDto",
          primaryActionLabel: "Confirm request revision",
          cancelActionLabel: "Discard",
        };
      case "COLLAB_VERIFY_COMPLIANCE":
        return {
          formTargetRoute: `/api/v1/collaboration/threads/${collabId}/posting/verify-compliance`,
          idempotencyKey: key,
          prefilledFields: {
            ...baseFields,
            action: "VERIFY_COMPLIANCE",
          },
          requiredZodValidationSchemaName: "VerifyComplianceDto",
          primaryActionLabel: "Confirm verify compliance",
          cancelActionLabel: "Discard",
        };
      default:
        return null;
    }
  }

  writeSlotNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    if (stagedPayload?.stage_mismatch) {
      return `That action isn’t valid for the current stage (${String(stagedPayload.current_stage ?? "unknown")}). Choose a matching collaboration or a different action.`;
    }
    switch (kind) {
      case "COLLAB_COUNTER_OFFER":
        return "I can send a counter-offer after you confirm the collaboration and amount.";
      case "COLLAB_ACCEPT_TERMS":
        return "I can accept the current commercials after you confirm.";
      case "COLLAB_FUND_ESCROW":
        return "I can fund escrow for an ESCROW collaboration in Securement after you confirm.";
      case "COLLAB_DISPATCH":
        return "I can mark logistics dispatched after you confirm tracking details.";
      case "COLLAB_APPROVE_CONTENT":
        return "I can approve pending content after you confirm.";
      case "COLLAB_REQUEST_REVISION":
        return "I can request a revision after you confirm feedback.";
      case "COLLAB_VERIFY_COMPLIANCE":
        return "I can verify live-post compliance after you confirm.";
      default:
        return null;
    }
  }

  hitlReviewNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string | null {
    const label = String(
      stagedPayload?.creator_label ??
        stagedPayload?.campaign_name ??
        "collaboration",
    );
    switch (kind) {
      case "COLLAB_COUNTER_OFFER":
        return `Review counter-offer of ₹${String(stagedPayload?.counter_offer ?? "?")} for ${label}.`;
      case "COLLAB_ACCEPT_TERMS":
        return `Review accept terms for ${label}.`;
      case "COLLAB_FUND_ESCROW":
        return `Review fund escrow for ${label}.`;
      case "COLLAB_DISPATCH":
        return `Review dispatch (tracking ${String(stagedPayload?.tracking_id ?? "—")}) for ${label}.`;
      case "COLLAB_APPROVE_CONTENT":
        return `Review content approval for ${label}.`;
      case "COLLAB_REQUEST_REVISION":
        return `Review revision request for ${label}.`;
      case "COLLAB_VERIFY_COMPLIANCE":
        return `Review compliance verification for ${label}.`;
      default:
        return null;
    }
  }

  private preferredStageForIntent(
    kind: WriteIntentKind,
  ): UceMilestoneStage | undefined {
    switch (kind) {
      case "COLLAB_COUNTER_OFFER":
      case "COLLAB_ACCEPT_TERMS":
        return "STAGE_1_NEGOTIATION";
      case "COLLAB_FUND_ESCROW":
        return "STAGE_2_SECUREMENT";
      case "COLLAB_DISPATCH":
        return "STAGE_3_LOGISTICS";
      case "COLLAB_APPROVE_CONTENT":
      case "COLLAB_REQUEST_REVISION":
        return "STAGE_4_CONTENT_REVIEW";
      case "COLLAB_VERIFY_COMPLIANCE":
        return "STAGE_5_PUBLISHING";
      default:
        return undefined;
    }
  }

  private async resolveThreadForRead(
    authUser: AuthUser,
    ctx: CoPilotModuleReadContext,
  ): Promise<CollabThreadRow | null> {
    const mem = this.memory.getCollaborationMemory(ctx.threadId);
    if (mem?.selectedCollaborationId) {
      const listed = mem.listedCollaborations.find(
        (c) => c.id === mem.selectedCollaborationId,
      );
      if (listed) {
        const all = await this.tools.listThreads(authUser, {});
        return (
          all.find((t) => t.collaboration_id === listed.id) ?? null
        );
      }
    }

    const hint = extractCreatorOrCampaignHint(ctx.userText);
    if (hint) {
      return this.tools.findByHint(authUser, hint);
    }

    const all = await this.tools.listThreads(authUser, {});
    if (all.length === 1) {
      return all[0];
    }
    return null;
  }
}

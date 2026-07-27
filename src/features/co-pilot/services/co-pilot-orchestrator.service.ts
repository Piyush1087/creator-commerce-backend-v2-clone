import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CoPilotInteractionStatus,
  CoPilotScopeContext,
} from "@prisma/client";
import { randomUUID } from "crypto";

import type { AuthUser } from "../../auth/types/auth-user";
import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { zodToGeminiResponseSchema } from "../../brand-centre/prompts/zod-to-gemini-response-schema.util";
import { CoPilotModuleRegistry } from "../core/module-registry";
import { CoPilotPromptComposer } from "../core/prompt-composer";
import type {
  DetectedWriteIntent,
  WriteIntentKind,
} from "../core/write-intent.types";
import { GeminiStreamClient } from "../integrations/gemini-stream.client";
import {
  CoPilotChatPayloadSchema,
  GeminiCoPilotOutputSchema,
  type CoPilotChatPayload,
  type SlotFillingData,
} from "../schemas/copilot-payload.schema";
import { BrandCentreCoPilotToolsService } from "../tools/brand-centre.tools";
import { PlannerCoPilotToolsService } from "../tools/planner.tools";
import {
  buildCoPilotFallbackReply,
  isGibberishInput,
} from "../utils/co-pilot-conversational.util";
import {
  buildDnaIdentityWriteNarrative,
  buildPaletteAdvisoryNarrative,
  buildApplyAdvisoryNarrative,
  isDnaIdentityAdvisoryQuery,
  isDnaIdentityApplyAdvisoryQuery,
  refineDnaIdentityClarification,
  type DnaIdentityUpdateAxis,
} from "../utils/co-pilot-dna-identity.util";
import { buildNoMovableLeaksNarrative } from "../utils/co-pilot-leak-planner.util";
import {
  looksLikeCampaignFollowUp,
  looksLikeCampaignUtterance,
  normalizeCoPilotUserText,
} from "../utils/co-pilot-text-normalize.util";
import { CoPilotCampaignSmartRouterService } from "./co-pilot-campaign-smart-router.service";
import { CoPilotConversationMemoryService } from "./co-pilot-conversation-memory.service";
import { CoPilotIntentService } from "./co-pilot-intent.service";
import { CoPilotInteractionLogService } from "./co-pilot-thread.service";
import { CoPilotModerationService } from "./co-pilot-moderation.service";
import { CoPilotResponseGroundingService } from "./co-pilot-response-grounding.service";
import { CoPilotSlotSessionService } from "./co-pilot-slot-session.service";

export type RunMessageArgs = {
  brandProfileId: string;
  userId: string;
  authUser: AuthUser;
  threadId: string;
  userText: string;
  scopeContext: CoPilotScopeContext;
  history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
  slotValues?: Record<string, string>;
};

@Injectable()
export class CoPilotOrchestratorService {
  private readonly logger = new Logger(CoPilotOrchestratorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiJsonClient,
    private readonly geminiStream: GeminiStreamClient,
    private readonly brandCentreTools: BrandCentreCoPilotToolsService,
    private readonly plannerTools: PlannerCoPilotToolsService,
    private readonly interactionLog: CoPilotInteractionLogService,
    private readonly slotSessions: CoPilotSlotSessionService,
    private readonly intents: CoPilotIntentService,
    private readonly moderation: CoPilotModerationService,
    private readonly grounding: CoPilotResponseGroundingService,
    private readonly registry: CoPilotModuleRegistry,
    private readonly promptComposer: CoPilotPromptComposer,
    private readonly campaignSmartRouter: CoPilotCampaignSmartRouterService,
    private readonly conversationMemory: CoPilotConversationMemoryService,
  ) {}

  shouldStreamPayload(payload: CoPilotChatPayload): boolean {
    return (
      payload.formatType === "CONVERSATIONAL_NARRATIVE" ||
      payload.formatType === "METRIC_HIGHLIGHT_GRID" ||
      payload.formatType === "TABULAR_AUDIT_DATA"
    );
  }

  async runMessage(
    args: RunMessageArgs,
  ): Promise<{ payload: CoPilotChatPayload; billable: boolean }> {
    const started = Date.now();
    const modelId = this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
    const messageId = randomUUID();

    const moderation = this.moderation.checkInput(args.userText);
    if (!moderation.allowed) {
      const payload = CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: moderation.refusalNarrative,
      });
      await this.interactionLog.logRun({
        brandProfileId: args.brandProfileId,
        userId: args.userId,
        threadId: args.threadId,
        messageId,
        scopeContext: args.scopeContext,
        modelId,
        toolsInvoked: ["moderation.block"],
        status: CoPilotInteractionStatus.MODERATION_BLOCKED,
        latencyMs: Date.now() - started,
        errorCode: moderation.reason,
      });
      return { payload, billable: false };
    }

    try {
      const payload = await this.resolvePayload(args, messageId);
      payload.narrativeText = this.moderation.sanitizeOutput(payload.narrativeText);

      await this.interactionLog.logRun({
        brandProfileId: args.brandProfileId,
        userId: args.userId,
        threadId: args.threadId,
        messageId,
        scopeContext: args.scopeContext,
        modelId,
        toolsInvoked: this.toolsForPayload(payload),
        status: CoPilotInteractionStatus.SUCCESS,
        latencyMs: Date.now() - started,
      });
      return { payload, billable: true };
    } catch (err) {
      this.logger.warn(`orchestrator err=${String(err)}`);
      const context = await this.brandCentreTools.getBrandCentreReadContext(
        args.brandProfileId,
      );
      const payload = this.buildDeterministicPayload({
        messageId,
        threadId: args.threadId,
        userText: args.userText,
        scopeContext: args.scopeContext,
        context,
        authUser: args.authUser,
      });
      await this.interactionLog.logRun({
        brandProfileId: args.brandProfileId,
        userId: args.userId,
        threadId: args.threadId,
        messageId,
        scopeContext: args.scopeContext,
        modelId,
        toolsInvoked: ["getBrandCentreReadContext"],
        status: CoPilotInteractionStatus.VALIDATION_ERROR,
        latencyMs: Date.now() - started,
        errorCode: err instanceof Error ? err.message : "ORCHESTRATOR_ERROR",
      });
      return { payload, billable: true };
    }
  }

  private async resolvePayload(
    args: RunMessageArgs,
    messageId: string,
  ): Promise<CoPilotChatPayload> {
    if (args.slotValues) {
      const slotPayload = await this.trySlotFlow(args, messageId);
      if (slotPayload) {
        return slotPayload;
      }
      // Slot submit without an active session — do not re-route to a different write intent.
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "That form expired or is no longer active. Please ask me again to move a leak to Campaign Planner (or continue the action you wanted), then pick from the list.",
      });
    }

    const activeSession = await this.slotSessions.getActiveSession(args.threadId);
    if (
      activeSession?.intentWorkspaceContext === "DNA_IDENTITY_UPDATE" &&
      !args.slotValues
    ) {
      const refined = refineDnaIdentityClarification(args.userText, {
        stagedPayload: activeSession.stagedPayload as Record<string, unknown>,
        missingSlots:
          activeSession.missingSlots as SlotFillingData["missingSlots"],
      });
      if (refined) {
        const enriched = await this.enrichDnaIdentityStagedPayload(
          args.brandProfileId,
          refined.stagedPayload,
        );
        await this.slotSessions.upsertSession({
          threadId: args.threadId,
          intentWorkspaceContext: "DNA_IDENTITY_UPDATE",
          stagedPayload: enriched,
          missingSlots: refined.missingSlots,
        });
        if (refined.missingSlots.length === 0) {
          return await this.buildDnaIdentityExecutionPayload({
            messageId,
            threadId: args.threadId,
            stagedPayload: enriched,
          });
        }
        const partial = this.intents.buildSlotFillingPayload({
          narrativeText: this.dnaIdentitySlotNarrative(enriched),
          intentWorkspaceContext: "DNA_IDENTITY_UPDATE",
          stagedPayload: enriched,
          missingSlots: refined.missingSlots,
        });
        return CoPilotChatPayloadSchema.parse({
          messageId,
          threadId: args.threadId,
          timestamp: new Date().toISOString(),
          ...partial,
        });
      }
    }

    if (isDnaIdentityAdvisoryQuery(args.userText)) {
      const context = await this.brandCentreTools.getBrandCentreReadContext(
        args.brandProfileId,
      );
      await this.slotSessions.clearSession(args.threadId);
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: buildPaletteAdvisoryNarrative(context.dna.brandName),
      });
    }

    if (isDnaIdentityApplyAdvisoryQuery(args.userText)) {
      await this.slotSessions.clearSession(args.threadId);
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: buildApplyAdvisoryNarrative(),
      });
    }

    const normalizedText = normalizeCoPilotUserText(args.userText);
    const routingArgs: RunMessageArgs = {
      ...args,
      userText: normalizedText,
    };
    const campaignMemory = this.conversationMemory.getCampaignMemory(
      args.threadId,
    );
    const shouldTryCampaignSmart =
      looksLikeCampaignUtterance(normalizedText) ||
      (Boolean(campaignMemory?.listedCampaigns.length) &&
        looksLikeCampaignFollowUp(normalizedText));

    if (shouldTryCampaignSmart) {
      const smart = await this.campaignSmartRouter.tryRoute({
        brandProfileId: routingArgs.brandProfileId,
        userId: routingArgs.userId,
        threadId: routingArgs.threadId,
        messageId,
        userText: routingArgs.userText,
        scopeContext: routingArgs.scopeContext,
        history: routingArgs.history,
        authUser: routingArgs.authUser,
      });

      if (smart.handled && smart.kind === "read") {
        await this.slotSessions.clearSession(args.threadId);
        return smart.payload;
      }

      if (smart.handled && smart.kind === "write") {
        await this.slotSessions.clearSession(args.threadId);
        const enriched = await this.enrichWriteIntent(
          args.brandProfileId,
          smart.intent,
          { history: args.history, userText: normalizedText },
        );
        await this.slotSessions.upsertSession({
          threadId: args.threadId,
          intentWorkspaceContext: enriched.kind,
          stagedPayload: enriched.stagedPayload,
          missingSlots: enriched.missingSlots,
        });

        if (enriched.missingSlots.length === 0) {
          return await this.buildStagedExecutionPayload({
            messageId,
            threadId: args.threadId,
            intentKind: enriched.kind,
            stagedPayload: enriched.stagedPayload,
          });
        }

        const partial = this.intents.buildSlotFillingPayload({
          narrativeText: this.writeIntentNarrative(
            enriched.kind,
            enriched.stagedPayload,
          ),
          intentWorkspaceContext: enriched.kind,
          stagedPayload: enriched.stagedPayload,
          missingSlots: enriched.missingSlots,
        });
        return CoPilotChatPayloadSchema.parse({
          messageId,
          threadId: args.threadId,
          timestamp: new Date().toISOString(),
          ...partial,
        });
      }
    }

    const registryRead = this.registry.resolveRead(
      normalizedText,
      args.scopeContext,
    );
    const isExplicitRead = registryRead !== null;
    const writeIntentResolved = this.registry.resolveWrite(
      normalizedText,
      args.history,
    );
    const writeIntent: DetectedWriteIntent = writeIntentResolved ?? {
      kind: "NONE",
    };

    if (isExplicitRead || writeIntent.kind !== "NONE") {
      await this.slotSessions.clearSession(args.threadId);
    } else if (activeSession) {
      const missing = activeSession.missingSlots as SlotFillingData["missingSlots"];
      if (missing.length > 0) {
        await this.slotSessions.clearSession(args.threadId);
      }
    }

    if (writeIntent.kind === "INTELLIGENCE_MOVE_TO_PLANNER") {
      const movableLeaks = await this.plannerTools.listMovableLeaks(args.brandProfileId);
      if (movableLeaks.length === 0) {
        return CoPilotChatPayloadSchema.parse({
          messageId,
          threadId: args.threadId,
          timestamp: new Date().toISOString(),
          formatType: "CONVERSATIONAL_NARRATIVE",
          narrativeText: buildNoMovableLeaksNarrative(),
        });
      }
    }

    if (writeIntent.kind !== "NONE") {
      const enriched = await this.enrichWriteIntent(
        args.brandProfileId,
        writeIntent,
        { history: args.history, userText: normalizedText },
      );
      await this.slotSessions.upsertSession({
        threadId: args.threadId,
        intentWorkspaceContext: enriched.kind,
        stagedPayload: enriched.stagedPayload,
        missingSlots: enriched.missingSlots,
      });

      if (enriched.missingSlots.length === 0) {
        return await this.buildStagedExecutionPayload({
          messageId,
          threadId: args.threadId,
          intentKind: enriched.kind,
          stagedPayload: enriched.stagedPayload,
        });
      }

      const partial = this.intents.buildSlotFillingPayload({
        narrativeText: this.writeIntentNarrative(enriched.kind, enriched.stagedPayload),
        intentWorkspaceContext: enriched.kind,
        stagedPayload: enriched.stagedPayload,
        missingSlots: enriched.missingSlots,
      });
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        ...partial,
      });
    }

    if (isExplicitRead && registryRead) {
      const readPayload = await this.tryRegistryReadPayload(
        routingArgs,
        messageId,
        registryRead.kind,
      );
      if (readPayload) {
        return readPayload;
      }
    }

    const pendingHitl = await this.hasPendingHitlSession(args.threadId);
    if (pendingHitl) {
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText:
          "You still have a staged action waiting for confirmation above. Confirm or discard it before starting something new.",
      });
    }

    const context = await this.brandCentreTools.getBrandCentreReadContext(
      args.brandProfileId,
    );

    if (isGibberishInput(args.userText)) {
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: buildCoPilotFallbackReply(context.dna.brandName),
      });
    }

    try {
      const geminiOutput = await this.generateWithGemini(args, context);
      const grounded = this.grounding.groundBrandCentreGeminiResponse({
        userText: args.userText,
        narrativeText: geminiOutput.narrativeText,
        context,
      });
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        ...grounded,
      });
    } catch {
      return this.buildDeterministicPayload({
        messageId,
        threadId: args.threadId,
        userText: args.userText,
        scopeContext: args.scopeContext,
        context,
        authUser: args.authUser,
      });
    }
  }

  private async tryRegistryReadPayload(
    args: RunMessageArgs,
    messageId: string,
    readKind: NonNullable<
      ReturnType<CoPilotModuleRegistry["resolveRead"]>
    >["kind"],
  ): Promise<CoPilotChatPayload | null> {
    const result = await this.registry.executeRead(readKind, {
      brandProfileId: args.brandProfileId,
      userId: args.userId,
      userText: args.userText,
      scopeContext: args.scopeContext,
      messageId,
      threadId: args.threadId,
      history: args.history,
      authUser: args.authUser,
    });
    if (!result) {
      return null;
    }
    return CoPilotChatPayloadSchema.parse({
      messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: result.formatType,
      narrativeText: result.narrativeText,
      metricGridData: result.metricGridData,
      tableData: result.tableData,
    });
  }

  private async trySlotFlow(
    args: RunMessageArgs,
    messageId: string,
  ): Promise<CoPilotChatPayload | null> {
    const active = await this.slotSessions.getActiveSession(args.threadId);
    if (!active && !args.slotValues) {
      return null;
    }

    const merged = args.slotValues
      ? await this.slotSessions.mergeSlotValues(args.threadId, args.slotValues)
      : active
        ? {
            intentWorkspaceContext: active.intentWorkspaceContext,
            stagedPayload: active.stagedPayload as Record<string, unknown>,
            missingSlots: active.missingSlots as SlotFillingData["missingSlots"],
          }
        : null;

    if (!merged) {
      return null;
    }

    if (merged.missingSlots.length > 0) {
      if (!args.slotValues) {
        await this.slotSessions.clearSession(args.threadId);
        return null;
      }

      const partial = this.intents.buildSlotFillingPayload({
        narrativeText: "Thanks — a few fields are still required before I can stage the action.",
        intentWorkspaceContext: merged.intentWorkspaceContext,
        stagedPayload: merged.stagedPayload,
        missingSlots: merged.missingSlots,
      });
      return CoPilotChatPayloadSchema.parse({
        messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        ...partial,
      });
    }

    let stagedRecord = merged.stagedPayload;
    const existingKey =
      typeof stagedRecord.idempotencyKey === "string"
        ? stagedRecord.idempotencyKey
        : null;

    if (!args.slotValues && existingKey) {
      return null;
    }

    const idempotencyKey = existingKey ?? randomUUID();
    const intentKind = merged.intentWorkspaceContext as WriteIntentKind;
    if (intentKind === "DNA_IDENTITY_UPDATE") {
      stagedRecord = await this.enrichDnaIdentityStagedPayload(
        args.brandProfileId,
        stagedRecord,
      );
    }
    const stagedWithKey = { ...stagedRecord, idempotencyKey };
    await this.slotSessions.upsertSession({
      threadId: args.threadId,
      intentWorkspaceContext: merged.intentWorkspaceContext,
      stagedPayload: stagedWithKey,
      missingSlots: [],
      idempotencyKey,
    });

    const widget =
      this.registry
        .findModuleForWriteIntent(intentKind)
        ?.buildExecutionWidget?.({
          intentKind,
          stagedPayload: stagedRecord,
          idempotencyKey,
        }) ??
      this.intents.buildExecutionWidget({
        intentKind,
        stagedPayload: stagedRecord,
        idempotencyKey,
      });

    return CoPilotChatPayloadSchema.parse({
      messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: "INTERACTIVE_EXECUTION_WIDGET",
      narrativeText: this.hitlReviewNarrative(intentKind, stagedRecord),
      executionWidget: widget,
    });
  }

  private async buildStagedExecutionPayload(args: {
    messageId: string;
    threadId: string;
    intentKind: WriteIntentKind;
    stagedPayload: Record<string, unknown>;
  }): Promise<CoPilotChatPayload> {
    if (args.intentKind === "DNA_IDENTITY_UPDATE") {
      return this.buildDnaIdentityExecutionPayload({
        messageId: args.messageId,
        threadId: args.threadId,
        stagedPayload: args.stagedPayload,
      });
    }

    const idempotencyKey = randomUUID();
    const stagedWithKey = { ...args.stagedPayload, idempotencyKey };

    await this.slotSessions.upsertSession({
      threadId: args.threadId,
      intentWorkspaceContext: args.intentKind,
      stagedPayload: stagedWithKey,
      missingSlots: [],
      idempotencyKey,
    });

    const widget =
      this.registry
        .findModuleForWriteIntent(args.intentKind)
        ?.buildExecutionWidget?.({
          intentKind: args.intentKind,
          stagedPayload: args.stagedPayload,
          idempotencyKey,
        }) ??
      this.intents.buildExecutionWidget({
        intentKind: args.intentKind,
        stagedPayload: args.stagedPayload,
        idempotencyKey,
      });

    return CoPilotChatPayloadSchema.parse({
      messageId: args.messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: "INTERACTIVE_EXECUTION_WIDGET",
      narrativeText: this.hitlReviewNarrative(args.intentKind, args.stagedPayload),
      executionWidget: widget,
    });
  }

  private async buildDnaIdentityExecutionPayload(args: {
    messageId: string;
    threadId: string;
    stagedPayload: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<CoPilotChatPayload> {
    const idempotencyKey = args.idempotencyKey ?? randomUUID();
    const stagedWithKey = { ...args.stagedPayload, idempotencyKey };

    await this.slotSessions.upsertSession({
      threadId: args.threadId,
      intentWorkspaceContext: "DNA_IDENTITY_UPDATE",
      stagedPayload: stagedWithKey,
      missingSlots: [],
      idempotencyKey,
    });

    const widget = this.intents.buildExecutionWidget({
      intentKind: "DNA_IDENTITY_UPDATE",
      stagedPayload: args.stagedPayload,
      idempotencyKey,
    });

    return CoPilotChatPayloadSchema.parse({
      messageId: args.messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: "INTERACTIVE_EXECUTION_WIDGET",
      narrativeText: this.hitlReviewNarrative("DNA_IDENTITY_UPDATE", args.stagedPayload),
      executionWidget: widget,
    });
  }

  private dnaIdentitySlotNarrative(stagedPayload: Record<string, unknown>): string {
    const axes = (stagedPayload.update_axes ?? []) as DnaIdentityUpdateAxis[];
    if (axes.length > 0) {
      return `${buildDnaIdentityWriteNarrative(axes)} Fill in the staged fields below.`;
    }
    return "I can update Brand DNA visual identity after you confirm. Fill in the staged fields below.";
  }

  private async enrichDnaIdentityStagedPayload(
    brandProfileId: string,
    stagedPayload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const context =
      await this.brandCentreTools.getBrandCentreReadContext(brandProfileId);
    const visual = context.dna.visualIdentity;
    return {
      ...stagedPayload,
      current_palette: visual.palette,
      current_fonts: visual.fonts,
      current_aesthetics: visual.aesthetics,
    };
  }

  private writeIntentNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string {
    const fromModule = this.registry
      .findModuleForWriteIntent(kind)
      ?.writeSlotNarrative?.(kind, stagedPayload);
    if (fromModule) {
      return fromModule;
    }
    switch (kind) {
      case "DNA_IDENTITY_UPDATE": {
        const axes = (stagedPayload?.update_axes ?? []) as DnaIdentityUpdateAxis[];
        if (axes.length > 0) {
          return `${buildDnaIdentityWriteNarrative(axes)} Fill in the staged fields below.`;
        }
        return "I can update Brand DNA visual identity after you confirm. Fill in the staged fields below.";
      }
      case "DNA_OFFERING_UPDATE":
        return "I can update a product short description after you confirm. Nothing is saved until you approve.";
      case "DNA_PERSONA_CREATE":
        return "I can create a new audience persona after you confirm the details below.";
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return "I can send an Intelligence & Gaps leak to Campaign Planner after you confirm. A planner card will be built in the background — you'll see live progress after you confirm.";
      case "PLANNER_LAUNCH_DRAFT":
        return "I can approve a planner card and create a UCE draft campaign (with products and briefs pre-filled) after you confirm.";
      case "CAMPAIGN_EDIT_DRAFT":
        return "I can update a DRAFT campaign only — live or paused campaigns must be edited in Campaigns.";
      case "CAMPAIGN_LAUNCH":
      default:
        return "I can stage a campaign draft, but I need a few details before you confirm anything.";
    }
  }

  private hitlReviewNarrative(
    kind: WriteIntentKind,
    stagedPayload?: Record<string, unknown>,
  ): string {
    const fromModule = this.registry
      .findModuleForWriteIntent(kind)
      ?.hitlReviewNarrative?.(kind, stagedPayload);
    if (fromModule) {
      return fromModule;
    }
    switch (kind) {
      case "DNA_IDENTITY_UPDATE": {
        const axes = (stagedPayload?.update_axes ?? []) as DnaIdentityUpdateAxis[];
        if (axes.length > 0) {
          return buildDnaIdentityWriteNarrative(axes);
        }
        return "Review the Brand DNA identity changes below. Nothing is saved until you confirm.";
      }
      case "DNA_OFFERING_UPDATE":
        return "Review the product description update below. Nothing is saved until you confirm.";
      case "DNA_PERSONA_CREATE":
        return "Review the new persona below. Nothing is saved until you confirm.";
      case "INTELLIGENCE_MOVE_TO_PLANNER":
        return "Review the leak to send to Campaign Planner. After you confirm, I'll show live job progress while the planner card is built.";
      case "PLANNER_LAUNCH_DRAFT":
        return "Review the planner card launch. A DRAFT UCE campaign will be created after you confirm.";
      case "CAMPAIGN_EDIT_DRAFT":
        return "Review the draft campaign changes below. Only DRAFT campaigns can be updated from chat.";
      case "CAMPAIGN_LAUNCH":
      default:
        return "Review the staged campaign draft below. Nothing is saved until you confirm.";
    }
  }

  private toolsForPayload(payload: CoPilotChatPayload): string[] {
    const tools = ["getBrandCentreReadContext"];
    if (payload.formatType === "SLOT_FILLING_CLARIFICATION") {
      tools.push("slotSession.merge");
    }
    if (payload.formatType === "INTERACTIVE_EXECUTION_WIDGET") {
      tools.push("hitl.stage");
    }
    if (payload.tableData) {
      tools.push("tabular.read");
    }
    if (payload.metricGridData?.length) {
      tools.push("buildMetricGridFromContext");
    }
    return tools;
  }

  private async hasPendingHitlSession(threadId: string): Promise<boolean> {
    const active = await this.slotSessions.getActiveSession(threadId);
    if (!active) {
      return false;
    }
    const missing = active.missingSlots as SlotFillingData["missingSlots"];
    if (missing.length > 0) {
      return false;
    }
    const staged = active.stagedPayload as Record<string, unknown>;
    return typeof staged.idempotencyKey === "string";
  }

  private async enrichWriteIntent(
    brandProfileId: string,
    intent: Extract<DetectedWriteIntent, { kind: WriteIntentKind }>,
    context?: {
      history: RunMessageArgs["history"];
      userText: string;
    },
  ): Promise<Extract<DetectedWriteIntent, { kind: WriteIntentKind }>> {
    try {
      return await this.registry.enrichWriteIntent(
        intent,
        brandProfileId,
        context,
      );
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      if (err instanceof Error) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private buildGeminiUserPrompt(
    args: RunMessageArgs,
    context: Awaited<
      ReturnType<BrandCentreCoPilotToolsService["getBrandCentreReadContext"]>
    >,
  ) {
    const historyBlock =
      args.history.length > 0
        ? args.history
            .slice(-8)
            .map((m) => `${m.role}: ${m.text}`)
            .join("\n")
        : "(no prior turns)";

    return [
      `Scope: ${args.scopeContext}`,
      this.grounding.buildCanonicalStatsPromptBlock(context),
      `Brand Centre context JSON:`,
      JSON.stringify(context, null, 2),
      `Recent thread:`,
      historyBlock,
      `Latest user message:`,
      args.userText,
    ].join("\n\n");
  }

  private async generateWithGemini(
    args: RunMessageArgs,
    context: Awaited<
      ReturnType<BrandCentreCoPilotToolsService["getBrandCentreReadContext"]>
    >,
  ) {
    const raw = await this.gemini.generateJson({
      systemInstruction: this.promptComposer.composeSystemPrompt(),
      userText: this.buildGeminiUserPrompt(args, context),
      responseSchema: zodToGeminiResponseSchema(GeminiCoPilotOutputSchema),
    });
    return GeminiCoPilotOutputSchema.parse(raw);
  }

  private buildDeterministicPayload(args: {
    messageId: string;
    threadId: string;
    userText: string;
    scopeContext: CoPilotScopeContext;
    context: Awaited<
      ReturnType<BrandCentreCoPilotToolsService["getBrandCentreReadContext"]>
    >;
    authUser: AuthUser;
  }): CoPilotChatPayload {
    const normalized = args.userText.toLowerCase();
    const metricGrid = this.brandCentreTools.buildMetricGridFromContext(
      args.context,
    );

    if (
      normalized.includes("overview") ||
      normalized.includes("brand centre") ||
      normalized.includes("dna and intelligence")
    ) {
      return CoPilotChatPayloadSchema.parse({
        messageId: args.messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText: `Read-only snapshot for ${args.context.dna.brandName} — Brand DNA and Intelligence & Gaps together.`,
        metricGridData: metricGrid,
      });
    }

    if (
      normalized.includes("incomplete") ||
      normalized.includes("completeness") ||
      normalized.includes("flagged")
    ) {
      return CoPilotChatPayloadSchema.parse({
        messageId: args.messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "METRIC_HIGHLIGHT_GRID",
        narrativeText:
          "Profile completeness across Brand DNA and Intelligence & Gaps.",
        metricGridData: metricGrid,
      });
    }

    if (
      normalized.includes("launch readiness") ||
      (normalized.includes("readiness") && !normalized.includes("campaign"))
    ) {
      const leakSummary =
        args.context.intelligence.topLeaks.length > 0
          ? args.context.intelligence.topLeaks
              .map((leak) => `${leak.title} (${leak.priority})`)
              .join("; ")
          : "No active intelligence gaps on file.";

      return CoPilotChatPayloadSchema.parse({
        messageId: args.messageId,
        threadId: args.threadId,
        timestamp: new Date().toISOString(),
        formatType: "CONVERSATIONAL_NARRATIVE",
        narrativeText: `Launch readiness for ${args.context.dna.brandName}: DNA completeness ${args.context.dna.verifiedFieldEstimate}; offerings ${args.context.dna.offeringCount}; intelligence gaps — ${leakSummary}`,
      });
    }

    return CoPilotChatPayloadSchema.parse({
      messageId: args.messageId,
      threadId: args.threadId,
      timestamp: new Date().toISOString(),
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText: buildCoPilotFallbackReply(args.context.dna.brandName),
    });
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CoPilotFormatType,
  CoPilotInteractionStatus,
  CreatorCoPilotScopeContext,
} from "@prisma/client";
import { randomUUID } from "crypto";

import type { AuthUser } from "../../auth/types/auth-user";
import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { zodToGeminiResponseSchema } from "../../brand-centre/prompts/zod-to-gemini-response-schema.util";
import {
  CoPilotChatPayloadSchema,
  GeminiCoPilotOutputSchema,
  type CoPilotChatPayload,
} from "../schemas/thread.schema";
import { CREATOR_COPILOT_SYSTEM_PROMPT } from "../integrations/creator-copilot-system-prompt";
import { CreatorCoPilotIntentService } from "./creator-co-pilot-intent.service";
import { CreatorCoPilotModerationService } from "./creator-co-pilot-moderation.service";
import { CreatorCoPilotSlotSessionService } from "./creator-co-pilot-slot-session.service";
import { CreatorCoPilotToolsService } from "../tools/creator-centre.tools";
import { PrismaService } from "../../../prisma/prisma.service";

export type RunCreatorMessageArgs = {
  creatorProfileId: string;
  userId: string;
  authUser: AuthUser;
  threadId: string;
  userText: string;
  scopeContext: CreatorCoPilotScopeContext;
  history: Array<{ role: "USER" | "ASSISTANT"; text: string }>;
  slotValues?: Record<string, string>;
};

@Injectable()
export class CreatorCoPilotOrchestratorService {
  private readonly logger = new Logger(CreatorCoPilotOrchestratorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiJsonClient,
    private readonly tools: CreatorCoPilotToolsService,
    private readonly moderation: CreatorCoPilotModerationService,
    private readonly intents: CreatorCoPilotIntentService,
    private readonly slotSessions: CreatorCoPilotSlotSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async runMessage(args: RunCreatorMessageArgs): Promise<{
    payload: CoPilotChatPayload;
    billable: boolean;
  }> {
    const started = Date.now();
    const moderation = this.moderation.checkInput(args.userText);
    if (!moderation.allowed) {
      const payload = this.buildNarrativePayload(
        args.threadId,
        moderation.refusalNarrative,
      );
      await this.logRun({
        ...args,
        status: CoPilotInteractionStatus.MODERATION_BLOCKED,
        latencyMs: Date.now() - started,
      });
      return { payload, billable: false };
    }

    try {
      if (args.slotValues && Object.keys(args.slotValues).length > 0) {
        const slotResult = await this.handleSlotValues(args);
        if (slotResult) {
          await this.logRun({
            ...args,
            status: CoPilotInteractionStatus.SUCCESS,
            latencyMs: Date.now() - started,
            toolsInvoked: ["creator_slot_fill"],
          });
          return { payload: slotResult, billable: true };
        }
      }

      const writeIntent = this.intents.detectWriteIntent(args.userText);
      if (writeIntent.kind !== "NONE") {
        const payload = await this.handleWriteIntent(args, writeIntent);
        await this.logRun({
          ...args,
          status: CoPilotInteractionStatus.SUCCESS,
          latencyMs: Date.now() - started,
          intentKey: writeIntent.kind,
          toolsInvoked: ["creator_write_intent"],
        });
        return { payload, billable: true };
      }

      const context = await this.tools.getCreatorReadContext(args.authUser);
      const narrative = await this.generateNarrative(args, context);
      const payload = this.buildNarrativePayload(args.threadId, narrative);
      await this.logRun({
        ...args,
        status: CoPilotInteractionStatus.SUCCESS,
        latencyMs: Date.now() - started,
        toolsInvoked: ["creator_centre_read_context"],
      });
      return { payload, billable: true };
    } catch (err) {
      this.logger.warn(`creator copilot failed: ${String(err)}`);
      const payload = this.buildNarrativePayload(
        args.threadId,
        "I could not process that request right now. Try again in a moment.",
      );
      await this.logRun({
        ...args,
        status: CoPilotInteractionStatus.ERROR,
        latencyMs: Date.now() - started,
        errorCode: "GEMINI_ERROR",
      });
      return { payload, billable: false };
    }
  }

  private async handleSlotValues(
    args: RunCreatorMessageArgs,
  ): Promise<CoPilotChatPayload | null> {
    const merged = await this.slotSessions.mergeSlotValues(
      args.threadId,
      args.slotValues ?? {},
    );
    if (!merged) {
      return null;
    }

    if (merged.missingSlots.length > 0) {
      const partial = this.intents.buildSlotFillingPayload({
        narrativeText: "I still need a few details to update your Media Kit.",
        intentWorkspaceContext: merged.intentWorkspaceContext as "MEDIA_KIT_UPDATE",
        stagedPayload: merged.stagedPayload,
        missingSlots: merged.missingSlots,
      });
      return this.buildPayloadFromPartial(args.threadId, partial);
    }

    const idempotencyKey = randomUUID();
    await this.slotSessions.upsertSession({
      threadId: args.threadId,
      intentWorkspaceContext: merged.intentWorkspaceContext,
      stagedPayload: merged.stagedPayload,
      missingSlots: [],
      idempotencyKey,
    });

    const widget = this.intents.buildExecutionWidget({
      intentKind: "MEDIA_KIT_UPDATE",
      stagedPayload: merged.stagedPayload,
      idempotencyKey,
    });

    return this.buildPayloadFromPartial(args.threadId, {
      formatType: "INTERACTIVE_EXECUTION_WIDGET",
      narrativeText:
        "Review these Media Kit changes. Confirm to save or discard to cancel.",
      executionWidget: widget,
    });
  }

  private async handleWriteIntent(
    args: RunCreatorMessageArgs,
    writeIntent: Extract<
      ReturnType<CreatorCoPilotIntentService["detectWriteIntent"]>,
      { kind: "MEDIA_KIT_UPDATE" }
    >,
  ): Promise<CoPilotChatPayload> {
    if (writeIntent.missingSlots.length > 0) {
      await this.slotSessions.upsertSession({
        threadId: args.threadId,
        intentWorkspaceContext: writeIntent.kind,
        stagedPayload: writeIntent.stagedPayload,
        missingSlots: writeIntent.missingSlots,
      });
      const partial = this.intents.buildSlotFillingPayload({
        narrativeText:
          "I can update your Media Kit. Fill in the missing fields below.",
        intentWorkspaceContext: writeIntent.kind,
        stagedPayload: writeIntent.stagedPayload,
        missingSlots: writeIntent.missingSlots,
      });
      return this.buildPayloadFromPartial(args.threadId, partial);
    }

    const idempotencyKey = randomUUID();
    await this.slotSessions.upsertSession({
      threadId: args.threadId,
      intentWorkspaceContext: writeIntent.kind,
      stagedPayload: writeIntent.stagedPayload,
      missingSlots: [],
      idempotencyKey,
    });

    const widget = this.intents.buildExecutionWidget({
      intentKind: writeIntent.kind,
      stagedPayload: writeIntent.stagedPayload,
      idempotencyKey,
    });

    return this.buildPayloadFromPartial(args.threadId, {
      formatType: "INTERACTIVE_EXECUTION_WIDGET",
      narrativeText:
        "Here is your staged Media Kit update. Confirm to apply or discard.",
      executionWidget: widget,
    });
  }

  private async generateNarrative(
    args: RunCreatorMessageArgs,
    context: Awaited<
      ReturnType<CreatorCoPilotToolsService["getCreatorReadContext"]>
    >,
  ): Promise<string> {
    const raw = await this.gemini.generateJson({
      systemInstruction: CREATOR_COPILOT_SYSTEM_PROMPT,
      userText: [
        `SCOPE: ${args.scopeContext}`,
        `CANONICAL_STATS: ${JSON.stringify(context.canonicalStats)}`,
        `CREATOR_CONTEXT: ${JSON.stringify(context)}`,
        `RECENT_TURNS: ${JSON.stringify(args.history.slice(-8))}`,
        `USER_MESSAGE: ${args.userText}`,
      ].join("\n\n"),
      responseSchema: zodToGeminiResponseSchema(GeminiCoPilotOutputSchema),
    });
    const parsed = GeminiCoPilotOutputSchema.parse(raw);
    return parsed.narrativeText;
  }

  private buildNarrativePayload(
    threadId: string,
    narrativeText: string,
  ): CoPilotChatPayload {
    return this.buildPayloadFromPartial(threadId, {
      formatType: "CONVERSATIONAL_NARRATIVE",
      narrativeText,
    });
  }

  private buildPayloadFromPartial(
    threadId: string,
    partial: {
      formatType: CoPilotChatPayload["formatType"];
      narrativeText: string;
      slotFillingData?: CoPilotChatPayload["slotFillingData"];
      executionWidget?: CoPilotChatPayload["executionWidget"];
    },
  ): CoPilotChatPayload {
    const messageId = randomUUID();
    const payload = {
      messageId,
      threadId,
      timestamp: new Date().toISOString(),
      ...partial,
    };
    return CoPilotChatPayloadSchema.parse(payload);
  }

  private async logRun(args: {
    creatorProfileId: string;
    userId: string;
    threadId: string;
    scopeContext: CreatorCoPilotScopeContext;
    status: CoPilotInteractionStatus;
    latencyMs: number;
    toolsInvoked?: string[];
    errorCode?: string;
    intentKey?: string;
  }) {
    await this.prisma.creatorCoPilotInteractionLog.create({
      data: {
        creatorProfileId: args.creatorProfileId,
        userId: args.userId,
        threadId: args.threadId,
        scopeContext: args.scopeContext,
        intentKey: args.intentKey,
        modelId: this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash"),
        toolsInvoked: args.toolsInvoked ?? [],
        status: args.status,
        latencyMs: args.latencyMs,
        errorCode: args.errorCode,
      },
    });
  }
}

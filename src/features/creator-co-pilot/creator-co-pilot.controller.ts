import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  CoPilotFeedbackRating,
  CoPilotFormatType,
  CreatorCoPilotScopeContext,
} from "@prisma/client";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorSettingsAccessService } from "../creator-settings/services/creator-settings-access.service";
import { ZodValidationPipe } from "../creator-onboarding/pipes/zod-validation.pipe";
import { CREATOR_COPILOT_WELCOME_NARRATIVE } from "./integrations/creator-copilot-system-prompt";
import {
  ConfirmCreatorCoPilotHitlSchema,
  CreateCreatorCoPilotThreadSchema,
  DiscardCreatorCoPilotHitlSchema,
  ListCreatorCoPilotThreadsQuerySchema,
  PatchCreatorCoPilotThreadSchema,
  PostCreatorCoPilotMessageSchema,
  SubmitCreatorCoPilotFeedbackSchema,
} from "./schemas/thread.schema";
import type { CoPilotChatPayload } from "./schemas/thread.schema";
import { CreatorCoPilotHitlService } from "./services/creator-co-pilot-hitl.service";
import { CreatorCoPilotOrchestratorService } from "./services/creator-co-pilot-orchestrator.service";
import { CreatorCoPilotThreadService } from "./services/creator-co-pilot-thread.service";
import { CreatorCoPilotUsageService } from "./services/creator-co-pilot-usage.service";
import { CreatorCoPilotFeedbackService } from "./services/creator-co-pilot-feedback.service";

@Controller("api/v1/creator/co-pilot")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorCoPilotController {
  constructor(
    private readonly access: CreatorSettingsAccessService,
    private readonly threads: CreatorCoPilotThreadService,
    private readonly orchestrator: CreatorCoPilotOrchestratorService,
    private readonly usage: CreatorCoPilotUsageService,
    private readonly feedback: CreatorCoPilotFeedbackService,
    private readonly hitl: CreatorCoPilotHitlService,
  ) {}

  @Get("usage")
  async getUsage(@Req() req: RequestWithAuthUser) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    return { usage: await this.usage.getUsageSnapshot(profile.id) };
  }

  @Post("threads")
  async createThread(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(CreateCreatorCoPilotThreadSchema))
    body: { title?: string; scopeContext?: CreatorCoPilotScopeContext },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    const thread = await this.threads.createThread({
      creatorProfileId: profile.id,
      userId: req.user.id,
      title: body.title,
      scopeContext: body.scopeContext,
      welcomeNarrative: CREATOR_COPILOT_WELCOME_NARRATIVE,
    });
    const messages = await this.threads.listMessages(profile.id, thread.id);
    return {
      thread: this.serializeThread(thread),
      messages: messages ?? [],
    };
  }

  @Get("threads")
  async listThreads(
    @Req() req: RequestWithAuthUser,
    @Query(new ZodValidationPipe(ListCreatorCoPilotThreadsQuerySchema))
    query: { limit?: number; includeArchived?: boolean },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    const rows = await this.threads.listThreads(profile.id, query);
    return { threads: rows.map((row) => this.serializeThread(row)) };
  }

  @Get("threads/:threadId")
  async getThread(
    @Req() req: RequestWithAuthUser,
    @Param("threadId") threadId: string,
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    const thread = await this.threads.getThread(profile.id, threadId);
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    const messages = await this.threads.listMessages(profile.id, threadId);
    return {
      thread: this.serializeThread(thread),
      messages: messages ?? [],
    };
  }

  @Patch("threads/:threadId")
  async patchThread(
    @Req() req: RequestWithAuthUser,
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(PatchCreatorCoPilotThreadSchema))
    body: { title?: string; archived?: boolean },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    const thread = await this.threads.patchThread(profile.id, threadId, body);
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    return { thread: this.serializeThread(thread) };
  }

  @Post("threads/:threadId/messages")
  async postMessage(
    @Req() req: RequestWithAuthUser,
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(PostCreatorCoPilotMessageSchema))
    body: {
      text: string;
      scopeContext?: CreatorCoPilotScopeContext;
      slotValues?: Record<string, string>;
    },
  ) {
    return this.handleMessage(req, threadId, body);
  }

  @Post("threads/:threadId/messages/stream")
  async streamMessage(
    @Req() req: RequestWithAuthUser,
    @Param("threadId") threadId: string,
    @Body(new ZodValidationPipe(PostCreatorCoPilotMessageSchema))
    body: {
      text: string;
      scopeContext?: CreatorCoPilotScopeContext;
      slotValues?: Record<string, string>;
    },
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      const result = await this.handleMessage(req, threadId, body, {
        onNarrativeDelta: (text) => {
          res.write(
            `event: narrative_delta\ndata: ${JSON.stringify({ text })}\n\n`,
          );
        },
      });
      res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stream failed";
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      res.end();
    }
  }

  @Post("hitl/confirm")
  async confirmHitl(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(ConfirmCreatorCoPilotHitlSchema))
    body: { threadId: string; idempotencyKey: string },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    return this.hitl.confirmStaged({
      creatorProfileId: profile.id,
      userId: req.user.id,
      threadId: body.threadId,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("hitl/discard")
  async discardHitl(
    @Req() req: RequestWithAuthUser,
    @Body(new ZodValidationPipe(DiscardCreatorCoPilotHitlSchema))
    body: { threadId: string; idempotencyKey: string },
  ) {
    await this.access.resolveCreatorProfile(req.user);
    return this.hitl.discardStaged({
      threadId: body.threadId,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("messages/:messageId/feedback")
  async submitFeedback(
    @Req() req: RequestWithAuthUser,
    @Param("messageId") messageId: string,
    @Body(new ZodValidationPipe(SubmitCreatorCoPilotFeedbackSchema))
    body: {
      threadId: string;
      rating: "THUMBS_UP" | "THUMBS_DOWN";
      reason?: string;
    },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    return this.feedback.submit({
      creatorProfileId: profile.id,
      userId: req.user.id,
      messageId,
      threadId: body.threadId,
      rating:
        body.rating === "THUMBS_UP"
          ? CoPilotFeedbackRating.THUMBS_UP
          : CoPilotFeedbackRating.THUMBS_DOWN,
      reason: body.reason,
    });
  }

  private async handleMessage(
    req: RequestWithAuthUser,
    threadId: string,
    body: {
      text: string;
      scopeContext?: CreatorCoPilotScopeContext;
      slotValues?: Record<string, string>;
    },
    stream?: { onNarrativeDelta: (text: string) => void },
  ) {
    const profile = await this.access.resolveCreatorProfile(req.user);
    await this.usage.assertCanRun(profile.id);

    const thread = await this.threads.getThread(profile.id, threadId);
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }

    const userMessage = await this.threads.appendUserMessage({
      creatorProfileId: profile.id,
      threadId,
      text: body.text,
      scopeContext: body.scopeContext,
    });
    if (!userMessage) {
      throw new NotFoundException("Thread not found");
    }

    const prior = await this.threads.listMessages(profile.id, threadId);
    const history = (prior ?? []).map((row) => ({
      role: row.role as "USER" | "ASSISTANT",
      text: row.textContent ?? "",
    }));

    const { payload } = await this.orchestrator.runMessage({
      creatorProfileId: profile.id,
      userId: req.user.id,
      authUser: req.user,
      threadId,
      userText: body.text,
      scopeContext: body.scopeContext ?? thread.scopeContext,
      history,
      slotValues: body.slotValues,
    });

    if (stream && payload.narrativeText) {
      await this.emitNarrativeChunks(payload.narrativeText, stream.onNarrativeDelta);
    }

    await this.threads.appendAssistantMessage({
      threadId,
      payload: payload as unknown as Record<string, unknown>,
      narrativeText: payload.narrativeText,
      formatType: payload.formatType as CoPilotFormatType,
    });

    return { message: payload };
  }

  private async emitNarrativeChunks(
    narrativeText: string,
    onDelta: (text: string) => void,
  ) {
    const parts = narrativeText.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      onDelta(part);
    }
  }

  private serializeThread(thread: {
    id: string;
    title: string;
    scopeContext: CreatorCoPilotScopeContext;
    archivedAt: Date | null;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      threadId: thread.id,
      title: thread.title,
      scopeContext: thread.scopeContext,
      status: thread.archivedAt ? "ARCHIVED" : "ACTIVE",
      lastMessageAt: thread.lastMessageAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
  }
}

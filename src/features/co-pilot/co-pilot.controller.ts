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

import { CoPilotFeedbackRating, CoPilotScopeContext } from "@prisma/client";

import { ThrottlerGuard } from "@nestjs/throttler";

import { randomUUID } from "crypto";

import type { Response } from "express";



import type { RequestWithAuthUser } from "../auth/auth.controller";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";

import { COPILOT_WELCOME_NARRATIVE } from "./integrations/copilot-system-prompt";

import { ZodValidationPipe } from "./pipes/zod-validation.pipe";

import {

  ConfirmHitlSchema,

  CreateCoPilotThreadSchema,

  DiscardHitlSchema,

  ListCoPilotThreadsQuerySchema,

  PatchCoPilotThreadSchema,

  PostCoPilotMessageSchema,

  SubmitCoPilotFeedbackSchema,

} from "./schemas/thread.schema";

import type { CoPilotChatPayload } from "./schemas/copilot-payload.schema";
import {
  mapCampaignListValidationError,
  validationChecklistToPayloadFields,
} from "./modules/uce-campaign-list/campaign-list-validation";
import { CoPilotFeedbackService } from "./services/co-pilot-feedback.service";
import { CoPilotHitlService } from "./services/co-pilot-hitl.service";
import { CoPilotBrandCentreJobService } from "./services/co-pilot-brand-centre-job.service";

import {

  CoPilotOrchestratorService,

  type RunMessageArgs,

} from "./services/co-pilot-orchestrator.service";

import { CoPilotThreadService } from "./services/co-pilot-thread.service";

import { CoPilotUsageService } from "./services/co-pilot-usage.service";



@Controller("api/v1/co-pilot")

@UseGuards(ThrottlerGuard, JwtAuthGuard)

export class CoPilotController {

  constructor(

    private readonly auth: BrandCentreAuthService,

    private readonly threads: CoPilotThreadService,

    private readonly orchestrator: CoPilotOrchestratorService,

    private readonly hitl: CoPilotHitlService,

    private readonly brandCentreJobs: CoPilotBrandCentreJobService,

    private readonly usage: CoPilotUsageService,

    private readonly feedback: CoPilotFeedbackService,

  ) {}



  @Get("usage")

  async getUsage(@Req() req: RequestWithAuthUser) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const snapshot = await this.usage.getUsageSnapshot(brandProfileId);

    return { usage: snapshot };

  }



  @Post("threads")

  async createThread(

    @Req() req: RequestWithAuthUser,

    @Body(new ZodValidationPipe(CreateCoPilotThreadSchema))

    body: ReturnType<typeof CreateCoPilotThreadSchema.parse>,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const thread = await this.threads.createThread({

      brandProfileId,

      userId: req.user.id,

      title: body.title,

      scopeContext: body.scopeContext ?? CoPilotScopeContext.BRAND_CENTRE,

      welcomePayload: {

        formatType: "CONVERSATIONAL_NARRATIVE",

        narrativeText: COPILOT_WELCOME_NARRATIVE,

      },

    });



    const messages = await this.threads.listMessages(brandProfileId, thread.id);



    return {

      thread: this.serializeThread(thread),

      messages: messages ?? [],

    };

  }



  @Get("threads")

  async listThreads(

    @Req() req: RequestWithAuthUser,

    @Query(new ZodValidationPipe(ListCoPilotThreadsQuerySchema))

    query: ReturnType<typeof ListCoPilotThreadsQuerySchema.parse>,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const rows = await this.threads.listThreads(brandProfileId, query);

    return { threads: rows.map((row) => this.serializeThread(row)) };

  }



  @Get("threads/:threadId")

  async getThread(

    @Req() req: RequestWithAuthUser,

    @Param("threadId") threadId: string,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const thread = await this.threads.getThreadForBrand(brandProfileId, threadId);

    if (!thread) {

      throw new NotFoundException("Thread not found");

    }

    const messages = await this.threads.listMessages(brandProfileId, threadId);

    return {

      thread: this.serializeThread(thread),

      messages: messages ?? [],

    };

  }



  @Patch("threads/:threadId")

  async patchThread(

    @Req() req: RequestWithAuthUser,

    @Param("threadId") threadId: string,

    @Body(new ZodValidationPipe(PatchCoPilotThreadSchema))

    body: ReturnType<typeof PatchCoPilotThreadSchema.parse>,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const updated = await this.threads.patchThread(brandProfileId, threadId, {
      title: body.title,
      archived:
        body.archived ??
        (body.status === "ARCHIVED"
          ? true
          : body.status === "ACTIVE"
            ? false
            : undefined),
    });

    if (!updated) {

      throw new NotFoundException("Thread not found");

    }

    return { thread: this.serializeThread(updated) };

  }



  @Get("threads/:threadId/messages")

  async listMessages(

    @Req() req: RequestWithAuthUser,

    @Param("threadId") threadId: string,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const messages = await this.threads.listMessages(brandProfileId, threadId);

    if (!messages) {

      throw new NotFoundException("Thread not found");

    }

    return { messages };

  }



  @Post("threads/:threadId/messages")

  async postMessage(

    @Req() req: RequestWithAuthUser,

    @Param("threadId") threadId: string,

    @Body(new ZodValidationPipe(PostCoPilotMessageSchema))

    body: ReturnType<typeof PostCoPilotMessageSchema.parse>,

  ) {

    return this.handleMessage(req, threadId, body);

  }



  @Post("threads/:threadId/messages/stream")

  async streamMessage(

    @Req() req: RequestWithAuthUser,

    @Param("threadId") threadId: string,

    @Body(new ZodValidationPipe(PostCoPilotMessageSchema))

    body: ReturnType<typeof PostCoPilotMessageSchema.parse>,

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



  @Post("messages/:messageId/feedback")

  async submitFeedback(

    @Req() req: RequestWithAuthUser,

    @Param("messageId") messageId: string,

    @Body(new ZodValidationPipe(SubmitCoPilotFeedbackSchema))

    body: ReturnType<typeof SubmitCoPilotFeedbackSchema.parse>,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const row = await this.feedback.submitFeedback({

      brandProfileId,

      userId: req.user.id,

      threadId: body.threadId,

      messageId,

      rating:

        body.rating === "THUMBS_UP"

          ? CoPilotFeedbackRating.THUMBS_UP

          : CoPilotFeedbackRating.THUMBS_DOWN,

      reason: body.reason,

    });

    return {

      ok: true,

      feedbackId: row.id,

      rating: row.rating,

    };

  }



  @Post("hitl/confirm")

  async confirmHitl(

    @Req() req: RequestWithAuthUser,

    @Body(new ZodValidationPipe(ConfirmHitlSchema))

    body: ReturnType<typeof ConfirmHitlSchema.parse>,

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    const result = await this.hitl.confirmStaged({

      brandProfileId,

      userId: req.user.id,

      threadId: body.threadId,

      idempotencyKey: body.idempotencyKey,

    });



    if (result.validationBlocked && result.validationChecklist) {

      const followUpPayload: CoPilotChatPayload = {

        messageId: randomUUID(),

        threadId: body.threadId,

        timestamp: new Date().toISOString(),

        formatType: "VALIDATION_CHECKLIST",

        narrativeText: result.message ?? result.validationChecklist.title,

        validationChecklistData: result.validationChecklist,

      };

      await this.threads.appendAssistantMessage({

        threadId: body.threadId,

        payload: followUpPayload,

        formatType: followUpPayload.formatType,

        narrativeText: followUpPayload.narrativeText,

      });

      return {

        ok: true,

        validationBlocked: true,

        message: followUpPayload.narrativeText,

        result,

        followUpPayload,

      };

    }



    const message =

      result.message ??

      result.hitlResolution?.summary ??

      "Action confirmed.";



    return {
      ok: true,
      result,
      message,
      hitlResolution: result.hitlResolution,
      pendingBrandCentreJobId: result.pendingBrandCentreJobId,
    };

  }



  @Post("hitl/confirm/stream")

  async confirmHitlStream(

    @Req() req: RequestWithAuthUser,

    @Body(new ZodValidationPipe(ConfirmHitlSchema))

    body: ReturnType<typeof ConfirmHitlSchema.parse>,

    @Res() res: Response,

  ) {

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");

    res.setHeader("Cache-Control", "no-cache, no-transform");

    res.setHeader("Connection", "keep-alive");

    res.flushHeaders?.();



    try {

      const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

      const result = await this.hitl.confirmStaged({

        brandProfileId,

        userId: req.user.id,

        threadId: body.threadId,

        idempotencyKey: body.idempotencyKey,

      });



      if (result.validationBlocked && result.validationChecklist) {

        const followUpPayload: CoPilotChatPayload = {

          messageId: randomUUID(),

          threadId: body.threadId,

          timestamp: new Date().toISOString(),

          formatType: "VALIDATION_CHECKLIST",

          narrativeText: result.message ?? result.validationChecklist.title,

          validationChecklistData: result.validationChecklist,

        };

        try {

          await this.threads.appendAssistantMessage({

            threadId: body.threadId,

            payload: followUpPayload,

            formatType: followUpPayload.formatType,

            narrativeText: followUpPayload.narrativeText,

          });

        } catch {

          // Still stream the checklist — don't remap persist failures as INTERNAL_ERROR.

        }

        res.write(

          `event: follow_up\ndata: ${JSON.stringify({ payload: followUpPayload })}\n\n`,

        );

        res.write(

          `event: done\ndata: ${JSON.stringify({ ok: true, validationBlocked: true, result })}\n\n`,

        );

        res.end();

        return;

      }



      res.write(

        `event: hitl_confirmed\ndata: ${JSON.stringify({

          hitlResolution: result.hitlResolution,

          pendingBrandCentreJobId: result.pendingBrandCentreJobId,

        })}\n\n`,

      );



      if (result.pendingBrandCentreJobId) {

        for await (const event of this.brandCentreJobs.pollJobEvents(

          result.pendingBrandCentreJobId,

        )) {

          if (event.type === "QUEUED" || event.type === "RUNNING") {

            res.write(

              `event: job_status\ndata: ${JSON.stringify({ message: event.message })}\n\n`,

            );

          }

        }



        const narrative = await this.hitl.buildAsyncFollowUpNarrative({

          brandProfileId,

          jobId: result.pendingBrandCentreJobId,

        });

        const followUpPayload: CoPilotChatPayload = {

          messageId: randomUUID(),

          threadId: body.threadId,

          timestamp: new Date().toISOString(),

          formatType: "CONVERSATIONAL_NARRATIVE",

          narrativeText: narrative,

        };

        await this.threads.appendAssistantMessage({

          threadId: body.threadId,

          payload: followUpPayload,

          formatType: followUpPayload.formatType,

          narrativeText: followUpPayload.narrativeText,

        });

        res.write(

          `event: follow_up\ndata: ${JSON.stringify({ payload: followUpPayload })}\n\n`,

        );

      } else if (result.followUpChecklist) {

        const followUpPayload: CoPilotChatPayload = {

          messageId: randomUUID(),

          threadId: body.threadId,

          timestamp: new Date().toISOString(),

          formatType: "VALIDATION_CHECKLIST",

          narrativeText: result.message ?? result.followUpChecklist.title,

          validationChecklistData: result.followUpChecklist,

        };

        await this.threads.appendAssistantMessage({

          threadId: body.threadId,

          payload: followUpPayload,

          formatType: followUpPayload.formatType,

          narrativeText: followUpPayload.narrativeText,

        });

        res.write(

          `event: follow_up\ndata: ${JSON.stringify({ payload: followUpPayload })}\n\n`,

        );

      }



      res.write(`event: done\ndata: ${JSON.stringify({ ok: true, result })}\n\n`);

      res.end();

    } catch (err) {

      // Prefer a checklist follow-up over a raw SSE error toast (incl. 500s).
      const mapped = mapCampaignListValidationError({
        err,
        action: "UNKNOWN",
      });
      const fields = validationChecklistToPayloadFields(mapped);
      const followUpPayload: CoPilotChatPayload = {
        messageId: randomUUID(),
        threadId: body.threadId,
        timestamp: new Date().toISOString(),
        formatType: "VALIDATION_CHECKLIST",
        narrativeText: fields.narrativeText,
        validationChecklistData: {
          ...fields.validationChecklistData,
          idempotencyKey: body.idempotencyKey,
        },
      };

      try {
        await this.threads.appendAssistantMessage({
          threadId: body.threadId,
          payload: followUpPayload,
          formatType: followUpPayload.formatType,
          narrativeText: followUpPayload.narrativeText,
        });
      } catch {
        /* best-effort */
      }

      res.write(
        `event: follow_up\ndata: ${JSON.stringify({ payload: followUpPayload })}\n\n`,
      );
      res.write(
        `event: done\ndata: ${JSON.stringify({ ok: true, validationBlocked: true })}\n\n`,
      );
      res.end();

    }

  }



  @Post("hitl/discard")

  async discardHitl(

    @Req() req: RequestWithAuthUser,

    @Body(new ZodValidationPipe(DiscardHitlSchema))

    body: ReturnType<typeof DiscardHitlSchema.parse>,

  ) {

    await this.auth.resolveBrandProfileId(req.user);

    const discardResult = await this.hitl.discardStaged({

      threadId: body.threadId,

      idempotencyKey: body.idempotencyKey,

    });

    return discardResult;

  }



  private async handleMessage(

    req: RequestWithAuthUser,

    threadId: string,

    body: ReturnType<typeof PostCoPilotMessageSchema.parse>,

    stream?: { onNarrativeDelta: (text: string) => void },

  ) {

    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);

    await this.usage.assertCanRun(brandProfileId);



    const thread = await this.threads.getThreadForBrand(brandProfileId, threadId);

    if (!thread) {

      throw new NotFoundException("Thread not found");

    }



    const existingMessages =

      (await this.threads.listMessages(brandProfileId, threadId)) ?? [];

    const scopeContext =

      body.scopeContext ?? thread.scopeContext ?? CoPilotScopeContext.BRAND_CENTRE;



    const userRow = await this.threads.appendUserMessage({

      brandProfileId,

      threadId,

      text: body.text,

      scopeContext,

    });

    if (!userRow) {

      throw new NotFoundException("Thread not found");

    }



    const runArgs: RunMessageArgs = {

      brandProfileId,

      userId: req.user.id,

      authUser: req.user,

      threadId,

      userText: body.text,

      scopeContext,

      slotValues: body.slotValues,

      history: existingMessages

        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")

        .map((m) => ({

          role: m.role as "USER" | "ASSISTANT",

          text: m.textContent ?? "",

        })),

    };



    const { payload, billable } = await this.orchestrator.runMessage(runArgs);



    if (billable) {

      await this.usage.incrementRun(brandProfileId);

    }



    if (

      stream &&

      this.orchestrator.shouldStreamPayload(payload) &&

      payload.formatType !== "SLOT_FILLING_CLARIFICATION" &&

      payload.formatType !== "INTERACTIVE_EXECUTION_WIDGET"

    ) {

      await this.emitNarrativeChunks(payload.narrativeText, stream.onNarrativeDelta);

    }



    const assistantRow = await this.threads.appendAssistantMessage({

      threadId,

      payload: payload as unknown as Record<string, unknown>,

      formatType: payload.formatType,

      narrativeText: payload.narrativeText,

    });



    return {

      userMessage: this.threads.serializeMessage(userRow),

      assistantMessage: {

        ...this.threads.serializeMessage(assistantRow),

        payload,

      },

    };

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

    scopeContext: CoPilotScopeContext;

    lastMessageAt: Date;

    archivedAt: Date | null;

    createdAt: Date;

  }) {

    return {

      threadId: thread.id,

      title: thread.title,

      scopeContext: thread.scopeContext,

      lastMessageAt: thread.lastMessageAt.toISOString(),

      archivedAt: thread.archivedAt?.toISOString() ?? null,

      status: thread.archivedAt ? ("ARCHIVED" as const) : ("ACTIVE" as const),

      createdAt: thread.createdAt.toISOString(),

    };

  }

}



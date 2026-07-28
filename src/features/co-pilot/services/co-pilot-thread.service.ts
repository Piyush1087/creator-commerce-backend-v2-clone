import { Injectable, BadRequestException } from "@nestjs/common";
import {
  CoPilotFormatType,
  CoPilotInteractionStatus,
  CoPilotScopeContext,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";

type LogRunArgs = {
  brandProfileId: string;
  userId: string;
  threadId?: string;
  messageId?: string;
  scopeContext: CoPilotScopeContext;
  modelId: string;
  toolsInvoked: string[];
  status: CoPilotInteractionStatus;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
  intentKey?: string;
};

@Injectable()
export class CoPilotInteractionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logRun(args: LogRunArgs) {
    return this.prisma.coPilotInteractionLog.create({
      data: {
        brandProfileId: args.brandProfileId,
        userId: args.userId,
        threadId: args.threadId,
        messageId: args.messageId,
        scopeContext: args.scopeContext,
        intentKey: args.intentKey,
        modelId: args.modelId,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        toolsInvoked: args.toolsInvoked,
        status: args.status,
        latencyMs: args.latencyMs,
        errorCode: args.errorCode,
      },
    });
  }
}

export type SerializedCoPilotMessage = {
  id: string;
  threadId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  textContent: string | null;
  payload: Record<string, unknown> | null;
  formatType: string | null;
  createdAt: string;
};

@Injectable()
export class CoPilotThreadService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(args: {
    brandProfileId: string;
    userId: string;
    title?: string;
    scopeContext?: CoPilotScopeContext;
    welcomePayload?: Record<string, unknown>;
  }) {
    const now = new Date();
    const title = args.title?.trim() || "New conversation";

    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.coPilotThread.create({
        data: {
          brandProfileId: args.brandProfileId,
          createdByUserId: args.userId,
          title,
          scopeContext: args.scopeContext ?? CoPilotScopeContext.BRAND_CENTRE,
          lastMessageAt: now,
        },
      });

      if (args.welcomePayload) {
        const messageId = randomUUID();
        const payload = {
          ...args.welcomePayload,
          messageId,
          threadId: thread.id,
          timestamp: new Date().toISOString(),
        };
        await tx.coPilotMessage.create({
          data: {
            threadId: thread.id,
            role: "ASSISTANT",
            textContent: String(
              (payload as Record<string, unknown>).narrativeText ?? "",
            ),
            payloadJson: payload as Prisma.InputJsonValue,
            formatType: "CONVERSATIONAL_NARRATIVE",
          },
        });
      }

      return thread;
    });
  }

  async listThreads(
    brandProfileId: string,
    args: { limit?: number; includeArchived?: boolean },
  ) {
    const limit = args.limit ?? 30;
    return this.prisma.coPilotThread.findMany({
      where: {
        brandProfileId,
        ...(args.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
    });
  }

  async getThreadForBrand(
    brandProfileId: string,
    threadId: string,
    options?: { includeArchived?: boolean },
  ) {
    return this.prisma.coPilotThread.findFirst({
      where: {
        id: threadId,
        brandProfileId,
        ...(options?.includeArchived ? {} : { archivedAt: null }),
      },
    });
  }

  async archiveThread(brandProfileId: string, threadId: string) {
    return this.patchThread(brandProfileId, threadId, { archived: true });
  }

  async patchThread(
    brandProfileId: string,
    threadId: string,
    data: { title?: string; archived?: boolean },
  ) {
    const existing = await this.getThreadForBrand(brandProfileId, threadId);
    if (!existing) {
      return null;
    }

    return this.prisma.coPilotThread.update({
      where: { id: threadId },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.archived === true
          ? { archivedAt: new Date() }
          : data.archived === false
            ? { archivedAt: null }
            : {}),
      },
    });
  }

  async listMessages(brandProfileId: string, threadId: string) {
    const thread = await this.getThreadForBrand(brandProfileId, threadId);
    if (!thread) {
      return null;
    }

    const rows = await this.prisma.coPilotMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => this.serializeMessage(row));
  }

  async appendUserMessage(args: {
    brandProfileId: string;
    threadId: string;
    text: string;
    scopeContext?: CoPilotScopeContext;
  }) {
    const thread = await this.getThreadForBrand(args.brandProfileId, args.threadId);
    if (!thread) {
      return null;
    }
    if (thread.archivedAt) {
      throw new BadRequestException("This conversation has been archived.");
    }

    const now = new Date();
    const shouldRetitle =
      thread.title === "New conversation" || thread.title.startsWith("Brand Centre");

    return this.prisma.$transaction(async (tx) => {
      const userMessage = await tx.coPilotMessage.create({
        data: {
          threadId: args.threadId,
          role: "USER",
          textContent: args.text,
        },
      });

      await tx.coPilotThread.update({
        where: { id: args.threadId },
        data: {
          lastMessageAt: now,
          ...(args.scopeContext ? { scopeContext: args.scopeContext } : {}),
          ...(shouldRetitle
            ? { title: this.deriveTitleFromPrompt(args.text) }
            : {}),
        },
      });

      return userMessage;
    });
  }

  async appendAssistantMessage(args: {
    threadId: string;
    payload: Record<string, unknown>;
    formatType: string;
    narrativeText: string;
  }) {
    const tryCreate = (formatType: string) =>
      this.prisma.coPilotMessage.create({
        data: {
          threadId: args.threadId,
          role: "ASSISTANT",
          textContent: args.narrativeText,
          payloadJson: args.payload as Prisma.InputJsonValue,
          formatType: formatType as CoPilotFormatType,
        },
      });

    let message;
    try {
      message = await tryCreate(args.formatType);
    } catch (err) {
      // Local/dev DBs may not have newer enum values yet (e.g. VALIDATION_CHECKLIST).
      // Persist with a safe format so chat still works; payload JSON keeps the full shape.
      if (
        args.formatType !== "CONVERSATIONAL_NARRATIVE" &&
        this.isUnknownFormatTypeError(err)
      ) {
        message = await tryCreate("CONVERSATIONAL_NARRATIVE");
      } else {
        throw err;
      }
    }

    await this.prisma.coPilotThread.update({
      where: { id: args.threadId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  private isUnknownFormatTypeError(err: unknown): boolean {
    const text = err instanceof Error ? err.message : String(err ?? "");
    return (
      /invalid input value for enum/i.test(text) ||
      /CoPilotFormatType/i.test(text) ||
      /VALIDATION_CHECKLIST/i.test(text)
    );
  }

  async findHitlResolution(
    threadId: string,
    idempotencyKey: string,
  ): Promise<{
    status: "CONFIRMED" | "DISCARDED";
    resolvedAt: string;
    summary?: string;
    campaignId?: string;
    campaignName?: string;
    plannerCardId?: string;
    brandCentreJobId?: string;
  } | null> {
    const messages = await this.prisma.coPilotMessage.findMany({
      where: {
        threadId,
        role: "ASSISTANT",
        formatType: "INTERACTIVE_EXECUTION_WIDGET",
      },
    });

    for (const row of messages) {
      if (!row.payloadJson || typeof row.payloadJson !== "object") {
        continue;
      }
      const payload = row.payloadJson as Record<string, unknown>;
      const widget = payload.executionWidget as
        | Record<string, unknown>
        | undefined;
      if (!widget || widget.idempotencyKey !== idempotencyKey) {
        continue;
      }
      const resolution = widget.resolution as
        | {
            status: "CONFIRMED" | "DISCARDED";
            resolvedAt: string;
            summary?: string;
            campaignId?: string;
            campaignName?: string;
            plannerCardId?: string;
            brandCentreJobId?: string;
          }
        | undefined;
      return resolution ?? null;
    }

    return null;
  }

  async persistHitlResolution(
    threadId: string,
    idempotencyKey: string,
    resolution: {
      status: "CONFIRMED" | "DISCARDED";
      resolvedAt: string;
      summary?: string;
      campaignId?: string;
      campaignName?: string;
      plannerCardId?: string;
      brandCentreJobId?: string;
    },
  ): Promise<string | null> {
    const messages = await this.prisma.coPilotMessage.findMany({
      where: {
        threadId,
        role: "ASSISTANT",
        formatType: "INTERACTIVE_EXECUTION_WIDGET",
      },
    });

    for (const row of messages) {
      if (!row.payloadJson || typeof row.payloadJson !== "object") {
        continue;
      }
      const payload = row.payloadJson as Record<string, unknown>;
      const widget = payload.executionWidget as
        | Record<string, unknown>
        | undefined;
      if (!widget || widget.idempotencyKey !== idempotencyKey) {
        continue;
      }

      const updatedPayload = {
        ...payload,
        executionWidget: {
          ...widget,
          resolution,
        },
      };

      await this.prisma.coPilotMessage.update({
        where: { id: row.id },
        data: {
          payloadJson: updatedPayload as Prisma.InputJsonValue,
        },
      });

      return row.id;
    }

    return null;
  }

  serializeMessage(row: {
    id: string;
    threadId: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    textContent: string | null;
    payloadJson: Prisma.JsonValue;
    formatType: string | null;
    createdAt: Date;
  }): SerializedCoPilotMessage {
    return {
      id: row.id,
      threadId: row.threadId,
      role: row.role,
      textContent: row.textContent,
      payload:
        row.payloadJson && typeof row.payloadJson === "object"
          ? (row.payloadJson as Record<string, unknown>)
          : null,
      formatType: row.formatType,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private deriveTitleFromPrompt(text: string): string {
    const trimmed = text.trim().replace(/\s+/g, " ");
    if (trimmed.length <= 72) {
      return trimmed;
    }
    return `${trimmed.slice(0, 69)}…`;
  }
}

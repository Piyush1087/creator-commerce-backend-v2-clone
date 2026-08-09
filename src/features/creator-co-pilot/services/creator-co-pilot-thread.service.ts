import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CoPilotFormatType,
  CoPilotInteractionStatus,
  CreatorCoPilotScopeContext,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class CreatorCoPilotThreadService {
  constructor(private readonly prisma: PrismaService) {}

  async createThread(args: {
    creatorProfileId: string;
    userId: string;
    title?: string;
    scopeContext?: CreatorCoPilotScopeContext;
    welcomeNarrative?: string;
  }) {
    const now = new Date();
    const title = args.title?.trim() || "New conversation";

    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.creatorCoPilotThread.create({
        data: {
          creatorProfileId: args.creatorProfileId,
          createdByUserId: args.userId,
          title,
          scopeContext:
            args.scopeContext ?? CreatorCoPilotScopeContext.COMMAND_CENTER,
          lastMessageAt: now,
        },
      });

      if (args.welcomeNarrative) {
        const messageId = randomUUID();
        const payload = {
          messageId,
          threadId: thread.id,
          timestamp: now.toISOString(),
          formatType: "CONVERSATIONAL_NARRATIVE",
          narrativeText: args.welcomeNarrative,
        };
        await tx.creatorCoPilotMessage.create({
          data: {
            threadId: thread.id,
            role: "ASSISTANT",
            textContent: args.welcomeNarrative,
            payloadJson: payload as Prisma.InputJsonValue,
            formatType: CoPilotFormatType.CONVERSATIONAL_NARRATIVE,
          },
        });
      }

      return thread;
    });
  }

  async listThreads(
    creatorProfileId: string,
    args: { limit?: number; includeArchived?: boolean },
  ) {
    return this.prisma.creatorCoPilotThread.findMany({
      where: {
        creatorProfileId,
        ...(args.includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { lastMessageAt: "desc" },
      take: args.limit ?? 30,
    });
  }

  async getThread(creatorProfileId: string, threadId: string) {
    return this.prisma.creatorCoPilotThread.findFirst({
      where: { id: threadId, creatorProfileId, archivedAt: null },
    });
  }

  async patchThread(
    creatorProfileId: string,
    threadId: string,
    data: { title?: string; archived?: boolean },
  ) {
    const existing = await this.getThread(creatorProfileId, threadId);
    if (!existing && data.archived !== true) {
      return null;
    }
    return this.prisma.creatorCoPilotThread.update({
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

  async listMessages(creatorProfileId: string, threadId: string) {
    const thread = await this.getThread(creatorProfileId, threadId);
    if (!thread) {
      return null;
    }
    const rows = await this.prisma.creatorCoPilotMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      threadId: row.threadId,
      role: row.role,
      textContent: row.textContent,
      payload: row.payloadJson as Record<string, unknown> | null,
      formatType: row.formatType,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async appendUserMessage(args: {
    creatorProfileId: string;
    threadId: string;
    text: string;
    scopeContext?: CreatorCoPilotScopeContext;
  }) {
    const thread = await this.getThread(args.creatorProfileId, args.threadId);
    if (!thread) {
      return null;
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.creatorCoPilotMessage.create({
        data: {
          threadId: args.threadId,
          role: "USER",
          textContent: args.text,
        },
      });
      await tx.creatorCoPilotThread.update({
        where: { id: args.threadId },
        data: {
          lastMessageAt: now,
          ...(args.scopeContext ? { scopeContext: args.scopeContext } : {}),
        },
      });
      return message;
    });
  }

  async appendAssistantMessage(args: {
    threadId: string;
    payload: Record<string, unknown>;
    narrativeText: string;
    formatType?: CoPilotFormatType;
  }) {
    const formatType =
      args.formatType ?? CoPilotFormatType.CONVERSATIONAL_NARRATIVE;
    await this.prisma.creatorCoPilotMessage.create({
      data: {
        threadId: args.threadId,
        role: "ASSISTANT",
        textContent: args.narrativeText,
        payloadJson: args.payload as Prisma.InputJsonValue,
        formatType,
      },
    });
    await this.prisma.creatorCoPilotThread.update({
      where: { id: args.threadId },
      data: { lastMessageAt: new Date() },
    });
  }

  async findHitlResolution(
    threadId: string,
    idempotencyKey: string,
  ): Promise<{
    status: "CONFIRMED" | "DISCARDED";
    resolvedAt: string;
    summary?: string;
  } | null> {
    const messages = await this.prisma.creatorCoPilotMessage.findMany({
      where: {
        threadId,
        role: "ASSISTANT",
        formatType: CoPilotFormatType.INTERACTIVE_EXECUTION_WIDGET,
      },
    });

    for (const row of messages) {
      const payload = row.payloadJson as Record<string, unknown> | null;
      const widget = payload?.executionWidget as
        | { idempotencyKey?: string; resolution?: { status: string; resolvedAt: string; summary?: string } }
        | undefined;
      if (widget?.idempotencyKey !== idempotencyKey || !widget.resolution) {
        continue;
      }
      return {
        status: widget.resolution.status as "CONFIRMED" | "DISCARDED",
        resolvedAt: widget.resolution.resolvedAt,
        summary: widget.resolution.summary,
      };
    }
    return null;
  }
}

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { addHours } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import type { SlotFillingData } from "../../co-pilot/schemas/copilot-payload.schema";

const SLOT_TTL_HOURS = 24;

@Injectable()
export class CreatorCoPilotSlotSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSession(threadId: string) {
    return this.prisma.creatorCoPilotSlotSession.findUnique({
      where: { threadId },
    });
  }

  async upsertSession(args: {
    threadId: string;
    intentWorkspaceContext: string;
    stagedPayload: Record<string, unknown>;
    missingSlots: SlotFillingData["missingSlots"];
    idempotencyKey?: string;
  }) {
    const expiresAt = addHours(new Date(), SLOT_TTL_HOURS);
    const payload = args.idempotencyKey
      ? { ...args.stagedPayload, idempotencyKey: args.idempotencyKey }
      : args.stagedPayload;

    return this.prisma.creatorCoPilotSlotSession.upsert({
      where: { threadId: args.threadId },
      create: {
        threadId: args.threadId,
        intentWorkspaceContext: args.intentWorkspaceContext,
        stagedPayload: payload as Prisma.InputJsonValue,
        missingSlots: args.missingSlots as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        intentWorkspaceContext: args.intentWorkspaceContext,
        stagedPayload: payload as Prisma.InputJsonValue,
        missingSlots: args.missingSlots as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  async mergeSlotValues(
    threadId: string,
    slotValues: Record<string, string>,
  ): Promise<{
    intentWorkspaceContext: string;
    stagedPayload: Record<string, unknown>;
    missingSlots: SlotFillingData["missingSlots"];
  } | null> {
    const session = await this.getActiveSession(threadId);
    if (!session) {
      return null;
    }

    const staged = {
      ...(session.stagedPayload as Record<string, unknown>),
      ...slotValues,
    };
    const missing = (
      session.missingSlots as SlotFillingData["missingSlots"]
    ).filter((slot) => !String(staged[slot.fieldName] ?? "").trim());

    await this.upsertSession({
      threadId,
      intentWorkspaceContext: session.intentWorkspaceContext,
      stagedPayload: staged,
      missingSlots: missing,
    });

    return {
      intentWorkspaceContext: session.intentWorkspaceContext,
      stagedPayload: staged,
      missingSlots: missing,
    };
  }

  async clearSession(threadId: string) {
    await this.prisma.creatorCoPilotSlotSession.deleteMany({
      where: { threadId },
    });
  }
}

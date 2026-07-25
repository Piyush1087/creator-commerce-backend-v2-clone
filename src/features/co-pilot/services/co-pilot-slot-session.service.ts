import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { addHours } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import type { SlotFillingData } from "../schemas/copilot-payload.schema";
import {
  parseSelectOptionId,
  parseSelectOptionLabel,
} from "../utils/co-pilot-leak-planner.util";

const SLOT_TTL_HOURS = 24;

@Injectable()
export class CoPilotSlotSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSession(threadId: string) {
    return this.prisma.coPilotSlotSession.findUnique({
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

    return this.prisma.coPilotSlotSession.upsert({
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

    const staged: Record<string, unknown> = {
      ...(session.stagedPayload as Record<string, unknown>),
      ...slotValues,
    };

    // Normalize `uuid::Label` pickers into bare ids (+ friendly labels).
    for (const key of ["leak_id", "planner_card_id", "campaign_id"] as const) {
      if (staged[key] == null || String(staged[key]).trim() === "") {
        continue;
      }
      const raw = String(staged[key]);
      const id = parseSelectOptionId(raw);
      const label = parseSelectOptionLabel(raw);
      staged[key] = id;
      if (key === "leak_id" && label && label !== id) {
        staged.leak_title = label;
      }
      if (key === "planner_card_id" && label && label !== id) {
        staged.planner_card_label = label;
      }
      if (key === "campaign_id" && label && label !== id) {
        staged.campaign_name = label;
      }
    }

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
    await this.prisma.coPilotSlotSession.deleteMany({ where: { threadId } });
  }
}

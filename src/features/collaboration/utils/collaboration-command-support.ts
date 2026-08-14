import { BadRequestException } from "@nestjs/common";
import {
  CollaborationActorClass,
  CollaborationEventKind,
  Prisma,
} from "@prisma/client";
import type { z } from "zod";

import { commandConflict } from "../errors/collaboration-command.error";

export function parseCommand<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}

export function requestFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

export async function replayOrThrow(
  tx: Prisma.TransactionClient,
  collaborationId: string,
  commandId: string,
  eventType: string,
  fingerprint: string,
): Promise<boolean> {
  const event = await tx.collaborationEvent.findFirst({
    where: { collaborationId, commandId },
  });
  if (!event) return false;
  const payload = event.payload as { requestFingerprint?: string } | null;
  if (
    event.eventType !== eventType ||
    payload?.requestFingerprint !== fingerprint
  ) {
    commandConflict(
      "COMMAND_ID_REUSED",
      "Command id was already used for a different request",
      event.aggregateVersion,
    );
  }
  return true;
}

export function assertExpectedVersion(actual: number, expected: number): void {
  if (actual !== expected) {
    commandConflict(
      "STALE_AGGREGATE_VERSION",
      "Collaboration aggregate version is stale",
      actual,
    );
  }
}

export async function appendCommandEvent(
  tx: Prisma.TransactionClient,
  input: {
    collaborationId: string;
    eventType: string;
    actorClass: CollaborationActorClass;
    actorUserId?: string;
    commandId: string;
    aggregateVersion: number;
    requestFingerprint: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx.collaborationEvent.create({
    data: {
      collaborationId: input.collaborationId,
      kind: CollaborationEventKind.DOMAIN,
      eventType: input.eventType,
      actorClass: input.actorClass,
      actorUserId: input.actorUserId,
      commandId: input.commandId,
      aggregateVersion: input.aggregateVersion,
      payload: {
        requestFingerprint: input.requestFingerprint,
        ...input.payload,
      } as Prisma.InputJsonValue,
    },
  });
}

import { BadRequestException, ConflictException } from "@nestjs/common";
import type {
  ApplicationCommandType,
  Prisma,
  UceApplicationStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";

export const applicationSelectionSchema = z
  .object({
    campaignAssetId: z.string().uuid(),
    briefId: z.string().uuid(),
  })
  .strict();

export function commandIdentity(key: unknown, request: Record<string, string>) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{22,128}$/.test(key)) {
    throw new BadRequestException({
      code: "APPLICATION_IDEMPOTENCY_KEY_REQUIRED",
    });
  }
  const digest = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  return {
    idempotencyKeyDigest: digest(key),
    requestFingerprint: digest(
      JSON.stringify(
        Object.keys(request)
          .sort()
          .map((name) => [name, request[name]]),
      ),
    ),
  };
}

export type CommandIdentity = ReturnType<typeof commandIdentity>;

export function blocksApplicationReapply(status: UceApplicationStatus) {
  return (
    status === "PENDING" ||
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "SUPERSEDED"
  );
}

export async function replayCommand(
  tx: Prisma.TransactionClient,
  commandType: ApplicationCommandType,
  actorUserId: string,
  authoritySubjectId: string,
  identity: CommandIdentity,
) {
  const receipt = await tx.applicationCommandReceipt.findUnique({
    where: {
      commandType_actorUserId_authoritySubjectId_idempotencyKeyDigest: {
        commandType,
        actorUserId,
        authoritySubjectId,
        idempotencyKeyDigest: identity.idempotencyKeyDigest,
      },
    },
    include: { transition: true },
  });
  if (!receipt) return null;
  if (receipt.requestFingerprint !== identity.requestFingerprint)
    throw new ConflictException({ code: "APPLICATION_IDEMPOTENCY_KEY_REUSED" });
  return {
    applicationId: receipt.applicationId,
    transitionId: receipt.transitionId,
    status: receipt.transition.toStatus,
    statusVersion: receipt.transition.applicationVersion,
    occurredAt: receipt.transition.occurredAt.toISOString(),
  };
}

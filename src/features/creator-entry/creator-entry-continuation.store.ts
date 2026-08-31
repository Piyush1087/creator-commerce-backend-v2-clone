import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatorEntryContinuationIntent } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";

export const hashCreatorEntryContinuationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export type CreatorEntryContinuationStatus =
  | "AVAILABLE"
  | "EXPIRED"
  | "CONSUMED";

/** Persistence-only Campaign handoff store. Campaign resolution and claim belong to I5. */
@Injectable()
export class CreatorEntryContinuationStore {
  constructor(private readonly prisma: PrismaService) {}

  async createResolvedCampaignApplyContinuation(args: {
    campaignId: string;
    boundUserId?: string | null;
    expiresAt: Date;
  }): Promise<{ continuationId: string; opaqueToken: string }> {
    if (args.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        "Continuation expiry must be in the future.",
      );
    }
    const opaqueToken = randomBytes(32).toString("base64url");
    const continuation = await this.prisma.creatorEntryContinuation.create({
      data: {
        tokenDigest: hashCreatorEntryContinuationToken(opaqueToken),
        intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
        campaignId: args.campaignId,
        boundUserId: args.boundUserId ?? null,
        expiresAt: args.expiresAt,
      },
      select: { id: true },
    });
    return { continuationId: continuation.id, opaqueToken };
  }

  async lookupByOpaqueToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const continuation = await this.prisma.creatorEntryContinuation.findUnique({
      where: { tokenDigest: hashCreatorEntryContinuationToken(token) },
    });
    if (!continuation) return null;
    const status: CreatorEntryContinuationStatus = continuation.consumedAt
      ? "CONSUMED"
      : continuation.expiresAt.getTime() <= Date.now()
        ? "EXPIRED"
        : "AVAILABLE";
    return { ...continuation, status };
  }
}

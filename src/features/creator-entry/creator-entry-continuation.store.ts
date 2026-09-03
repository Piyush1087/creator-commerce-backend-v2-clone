import { BadRequestException, Injectable } from "@nestjs/common";
import { CreatorEntryContinuationIntent } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";

export const hashCreatorEntryContinuationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const isCreatorEntryContinuationToken = (token: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(token);

export type CreatorEntryContinuationStatus =
  | "AVAILABLE"
  | "EXPIRED"
  | "CONSUMED";

export type CreatorEntryContinuationClaimResult =
  | { outcome: "NOT_FOUND" }
  | { outcome: "EXPIRED" }
  | { outcome: "IDENTITY_CONFLICT" }
  | {
      outcome: "BOUND" | "CONSUMED";
      campaignId: string;
      expiresAt: Date;
      consumedAt: Date | null;
    };

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

  async lookupByOpaqueToken(token: string, now = new Date()) {
    if (!isCreatorEntryContinuationToken(token)) return null;
    const continuation = await this.prisma.creatorEntryContinuation.findUnique({
      where: { tokenDigest: hashCreatorEntryContinuationToken(token) },
    });
    if (!continuation) return null;
    const status: CreatorEntryContinuationStatus = continuation.consumedAt
      ? "CONSUMED"
      : continuation.expiresAt.getTime() <= now.getTime()
        ? "EXPIRED"
        : "AVAILABLE";
    return { ...continuation, status };
  }

  /** Atomic NULL -> User binding; the database trigger remains the final guard. */
  async bindForAuthenticatedUser(args: {
    opaqueToken: string;
    userId: string;
    now: Date;
  }): Promise<CreatorEntryContinuationClaimResult> {
    if (!isCreatorEntryContinuationToken(args.opaqueToken)) {
      return { outcome: "NOT_FOUND" };
    }
    const tokenDigest = hashCreatorEntryContinuationToken(args.opaqueToken);
    await this.prisma.creatorEntryContinuation.updateMany({
      where: {
        tokenDigest,
        intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
        boundUserId: null,
        consumedAt: null,
        expiresAt: { gt: args.now },
      },
      data: { boundUserId: args.userId },
    });
    return this.classifyForUser(tokenDigest, args.userId, args.now);
  }

  /** Atomic one-time consume; a same-User retry returns the persisted handoff. */
  async consumeForBoundUser(args: {
    opaqueToken: string;
    userId: string;
    now: Date;
  }): Promise<CreatorEntryContinuationClaimResult> {
    if (!isCreatorEntryContinuationToken(args.opaqueToken)) {
      return { outcome: "NOT_FOUND" };
    }
    const tokenDigest = hashCreatorEntryContinuationToken(args.opaqueToken);
    await this.prisma.creatorEntryContinuation.updateMany({
      where: {
        tokenDigest,
        intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
        boundUserId: args.userId,
        consumedAt: null,
        expiresAt: { gt: args.now },
      },
      data: { consumedAt: args.now },
    });
    return this.classifyForUser(tokenDigest, args.userId, args.now);
  }

  private async classifyForUser(
    tokenDigest: string,
    userId: string,
    now: Date,
  ): Promise<CreatorEntryContinuationClaimResult> {
    const continuation = await this.prisma.creatorEntryContinuation.findUnique({
      where: { tokenDigest },
      select: {
        intent: true,
        campaignId: true,
        boundUserId: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
    if (
      !continuation ||
      continuation.intent !== CreatorEntryContinuationIntent.CAMPAIGN_APPLY
    ) {
      return { outcome: "NOT_FOUND" };
    }
    if (continuation.boundUserId && continuation.boundUserId !== userId) {
      return { outcome: "IDENTITY_CONFLICT" };
    }
    if (continuation.consumedAt && continuation.boundUserId === userId) {
      return {
        outcome: "CONSUMED",
        campaignId: continuation.campaignId,
        expiresAt: continuation.expiresAt,
        consumedAt: continuation.consumedAt,
      };
    }
    if (continuation.expiresAt.getTime() <= now.getTime()) {
      return { outcome: "EXPIRED" };
    }
    if (continuation.boundUserId !== userId) {
      return { outcome: "IDENTITY_CONFLICT" };
    }
    return {
      outcome: "BOUND",
      campaignId: continuation.campaignId,
      expiresAt: continuation.expiresAt,
      consumedAt: null,
    };
  }
}

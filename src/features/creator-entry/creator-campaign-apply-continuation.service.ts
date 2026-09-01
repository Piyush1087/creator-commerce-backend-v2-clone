import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreatorEntryContinuationIntent } from "@prisma/client";

import type { AuthUser } from "../auth/types/auth-user";
import { CreatorCanonicalContextService } from "./creator-canonical-context.service";
import {
  type CreatorEntryContinuationClaimResult,
  CreatorEntryContinuationStore,
  isCreatorEntryContinuationToken,
} from "./creator-entry-continuation.store";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";

export const CREATOR_CAMPAIGN_CONTINUATION_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CreatorCampaignApplyContinuationService {
  constructor(
    private readonly store: CreatorEntryContinuationStore,
    private readonly contexts: CreatorCanonicalContextService,
    private readonly state: CreatorEntryStateService,
  ) {}

  async issueResolvedCampaign(
    campaignId: string,
    now = new Date(),
  ): Promise<{
    intent: CreatorEntryContinuationIntent;
    continuationToken: string;
    expiresAt: Date;
  }> {
    const expiresAt = new Date(
      now.getTime() + CREATOR_CAMPAIGN_CONTINUATION_TTL_MS,
    );
    const issued = await this.store.createResolvedCampaignApplyContinuation({
      campaignId,
      boundUserId: null,
      expiresAt,
    });
    return {
      intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
      continuationToken: issued.opaqueToken,
      expiresAt,
    };
  }

  async resolve(user: AuthUser, continuationToken: string, now = new Date()) {
    if (!isCreatorEntryContinuationToken(continuationToken)) {
      this.assertAvailable({ outcome: "NOT_FOUND" });
    }
    await this.contexts.resolve(user.id);
    const binding = await this.store.bindForAuthenticatedUser({
      opaqueToken: continuationToken,
      userId: user.id,
      now,
    });
    if (binding.outcome === "CONSUMED") {
      return this.readyHandoff(binding.campaignId);
    }
    this.assertAvailable(binding);

    const entryState = await this.state.read(user);
    if (!entryState.canEnterCreatorPlatform) {
      return {
        status: "PENDING_CREATOR_ENTRY" as const,
        intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
        nextAction: entryState.nextAction,
      };
    }

    const consumed = await this.store.consumeForBoundUser({
      opaqueToken: continuationToken,
      userId: user.id,
      now: new Date(),
    });
    this.assertAvailable(consumed, true);
    return this.readyHandoff(consumed.campaignId);
  }

  private assertAvailable(
    result: CreatorEntryContinuationClaimResult,
    acceptConsumed = false,
  ): asserts result is Extract<
    CreatorEntryContinuationClaimResult,
    { outcome: "BOUND" | "CONSUMED" }
  > {
    if (result.outcome === "NOT_FOUND") {
      throw new NotFoundException({
        code: CREATOR_ENTRY_ERROR.CREATOR_ENTRY_CONTINUATION_NOT_FOUND,
        message: "Campaign continuation was not found or is invalid.",
      });
    }
    if (result.outcome === "EXPIRED") {
      throw new GoneException({
        code: CREATOR_ENTRY_ERROR.CREATOR_ENTRY_CONTINUATION_EXPIRED,
        message: "Campaign continuation has expired.",
      });
    }
    if (result.outcome === "IDENTITY_CONFLICT") {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.CREATOR_ENTRY_CONTINUATION_IDENTITY_CONFLICT,
        message: "Campaign continuation belongs to another identity.",
      });
    }
    if (result.outcome === "CONSUMED" && !acceptConsumed) return;
  }

  private readyHandoff(campaignId: string) {
    return {
      status: "READY_TO_RETURN" as const,
      intent: CreatorEntryContinuationIntent.CAMPAIGN_APPLY,
      nextAction: "RETURN_TO_ORIGINATING_CAMPAIGN" as const,
      campaign: { campaignId },
    };
  }
}

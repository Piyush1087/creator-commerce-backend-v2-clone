import { Injectable } from "@nestjs/common";
import {
  InstagramOAuthIntent,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
} from "@prisma/client";

import { ProviderOAuthTransactionService } from "./provider-oauth-transaction.service";

type CreatorOAuthIntent =
  | typeof InstagramOAuthIntent.INITIAL_CONNECT
  | typeof InstagramOAuthIntent.RECONNECT;

export type CreatorOAuthTransactionContext = {
  creatorProfileId: string;
  initiatedByUserId: string;
  redirectUri: string;
  intent: CreatorOAuthIntent;
  expectedGeneration?: number;
  expectedProviderAccountId?: string | null;
};

/** Persistence/security adapter only; provider exchange and public endpoints belong to I3. */
@Injectable()
export class CreatorInstagramOAuthTransactionService {
  constructor(private readonly transactions: ProviderOAuthTransactionService) {}

  issue(context: CreatorOAuthTransactionContext): Promise<string> {
    return this.transactions.issue({
      ...context,
      provider: ProviderOAuthProvider.INSTAGRAM,
      subjectType: ProviderOAuthSubjectType.CREATOR,
    });
  }

  consume(context: CreatorOAuthTransactionContext, state: string) {
    return this.transactions.consume(
      {
        ...context,
        provider: ProviderOAuthProvider.INSTAGRAM,
        subjectType: ProviderOAuthSubjectType.CREATOR,
      },
      state,
    );
  }
}

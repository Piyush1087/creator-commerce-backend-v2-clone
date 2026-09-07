import { Injectable } from "@nestjs/common";
import {
  BrandRole,
  InstagramOAuthIntent,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
} from "@prisma/client";
import {
  hashProviderOAuthState,
  PROVIDER_OAUTH_TRANSACTION_TTL_MS,
  ProviderOAuthTransactionService,
} from "../../provider-oauth/provider-oauth-transaction.service";

export const INSTAGRAM_SETTINGS_STATE_TTL_MS =
  PROVIDER_OAUTH_TRANSACTION_TTL_MS;
export const hashInstagramSettingsState = hashProviderOAuthState;

type AttemptContext = {
  brandProfileId: string;
  initiatedByUserId: string;
  redirectUri: string;
  intent?: InstagramOAuthIntent;
  initiatedByRole?: BrandRole;
  expectedGeneration?: number;
  expectedProviderAccountId?: string | null;
};

/** Durable authenticated Brand Instagram OAuth attempt store. */
@Injectable()
export class BrandInstagramOAuthStateService {
  constructor(private readonly transactions: ProviderOAuthTransactionService) {}

  async issue(context: AttemptContext): Promise<string> {
    return this.transactions.issue({
      ...context,
      provider: ProviderOAuthProvider.INSTAGRAM,
      subjectType: ProviderOAuthSubjectType.BRAND,
      intent: context.intent ?? InstagramOAuthIntent.INITIAL_CONNECT,
      initiatedByRole: context.initiatedByRole ?? BrandRole.BRAND_OWNER,
    });
  }

  async consume(context: AttemptContext, state: string) {
    return this.transactions.consume(
      {
        ...context,
        provider: ProviderOAuthProvider.INSTAGRAM,
        subjectType: ProviderOAuthSubjectType.BRAND,
        intent: context.intent ?? InstagramOAuthIntent.INITIAL_CONNECT,
        initiatedByRole: context.initiatedByRole ?? BrandRole.BRAND_OWNER,
      },
      state,
    );
  }
}

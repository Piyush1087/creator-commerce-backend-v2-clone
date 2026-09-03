import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
  SocialNetworkProvider,
  type CreatorSocialIntegration,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../shared/crypto/field-encryption.util";
import type { AuthUser } from "../auth/types/auth-user";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
  type InstagramMeProfile,
} from "../instagram/instagram-graph.client";
import type { InstagramProviderErrorClass } from "../instagram/instagram-provider-error";
import {
  InstagramOAuthClient,
  InstagramOAuthExchangeError,
  type InstagramTokenExchangeResult,
} from "../instagram/instagram-oauth.client";
import { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
import {
  type CanonicalCreatorContext,
  CreatorCanonicalContextService,
} from "./creator-canonical-context.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CREATOR_ENTRY_ERROR } from "./creator-entry.types";
import {
  CREATOR_INSTAGRAM_BASIC_PERMISSION,
  CREATOR_INSTAGRAM_INSIGHTS_PERMISSION,
  normalizeCreatorInstagramPermissions,
  resolveCreatorInstagramRedirectUri,
} from "./creator-instagram-authority";
import type { CreatorInstagramCompleteDto } from "./dto/creator-entry.dto";

type CapabilityEvidence = {
  tokenScopePermissions: string[];
  basic: ProviderCapabilityState;
  insights: ProviderCapabilityState;
  health: ProviderAuthorizationHealth;
  reasonCode: string | null;
};

@Injectable()
export class CreatorInstagramContinuityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: CreatorInstagramOAuthTransactionService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly state: CreatorEntryStateService,
    private readonly contexts: CreatorCanonicalContextService,
  ) {}

  async revalidate(user: AuthUser) {
    const creator = await this.contexts.resolve(user.id);
    const integration = await this.requireIntegration(creator);
    if (this.isExplicitlyDisconnected(integration)) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_RECONNECT_REQUIRED,
        message: "Instagram was explicitly disconnected. Start a reconnect.",
      });
    }

    const now = new Date();
    if (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) {
      await this.persistExpired(integration);
      return {
        revalidated: false as const,
        state: await this.state.read(user),
      };
    }

    const accessToken = decryptField(integration.oauthAccessTokenEncrypted);
    let me: InstagramMeProfile;
    try {
      me = await this.graph.fetchMe(accessToken);
    } catch (error) {
      await this.applyProviderFailure(integration, error);
      if (this.isRetryable(error)) throw this.retryRequired();
      return {
        revalidated: false as const,
        state: await this.state.read(user),
      };
    }

    if (me.userId !== integration.nativePlatformUserId) {
      throw this.identityConflict();
    }

    if (!this.isProfessional(me.accountType)) {
      await this.updateRevalidation(integration, me, {
        tokenScopePermissions: integration.tokenScopePermissions,
        basic: ProviderCapabilityState.UNAVAILABLE,
        insights: ProviderCapabilityState.UNKNOWN,
        health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        reasonCode: "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED",
      });
      return {
        revalidated: false as const,
        state: await this.state.read(user),
      };
    }

    const evidence = await this.revalidationCapabilities(
      accessToken,
      integration,
    );
    await this.updateRevalidation(integration, me, evidence);
    return {
      revalidated:
        evidence.basic === ProviderCapabilityState.AVAILABLE &&
        evidence.health === ProviderAuthorizationHealth.USABLE,
      state: await this.state.read(user),
    };
  }

  async authorizeReconnect(user: AuthUser) {
    const creator = await this.contexts.resolve(user.id);
    const integration = await this.requireIntegration(creator);
    if (
      !this.isExplicitlyDisconnected(integration) &&
      integration.tokenStateCondition === OAuthTokenStatus.ACTIVE &&
      integration.authorizationHealth === ProviderAuthorizationHealth.USABLE &&
      integration.basicAuthorizationCapability ===
        ProviderCapabilityState.AVAILABLE
    ) {
      throw new ConflictException({
        code: "INSTAGRAM_RECONNECT_NOT_REQUIRED",
        message: "The current Instagram authorization is already usable.",
      });
    }

    const redirectUri = resolveCreatorInstagramRedirectUri();
    const state = await this.transactions.issue({
      creatorProfileId: creator.creatorProfileId,
      initiatedByUserId: creator.userId,
      redirectUri,
      intent: InstagramOAuthIntent.RECONNECT,
      expectedGeneration: integration.authorizationGeneration,
      expectedProviderAccountId: integration.nativePlatformUserId,
    });
    return {
      authorizationUrl: this.oauth.buildAuthorizeUrl(redirectUri, state),
    };
  }

  async completeReconnect(user: AuthUser, input: CreatorInstagramCompleteDto) {
    const creator = await this.contexts.resolve(user.id);
    const redirectUri = resolveCreatorInstagramRedirectUri();
    const attempt = await this.transactions.consume(
      {
        creatorProfileId: creator.creatorProfileId,
        initiatedByUserId: creator.userId,
        redirectUri,
        intent: InstagramOAuthIntent.RECONNECT,
      },
      input.state,
    );
    const integration = await this.requireIntegration(creator);
    this.assertReconnectAttempt(attempt, creator, redirectUri, integration);

    if (input.error) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_AUTHORIZATION_DENIED,
        message: "Instagram authorization was denied. Start a new attempt.",
      });
    }
    if (!input.code || input.errorDescription) {
      throw new BadRequestException({
        code: "INVALID_INSTAGRAM_AUTHORIZATION_RESPONSE",
        message: "Provide either an Instagram authorization code or denial.",
      });
    }

    const token = await this.exchangeCode(input.code, redirectUri);
    const me = await this.fetchStableIdentity(token.accessToken);
    this.assertProfessionalAccount(me.accountType);
    if (me.userId !== attempt.expectedProviderAccountId) {
      throw this.identityConflict();
    }
    const evidence = await this.reconnectCapabilities(token);
    await this.promoteReconnect({
      creator,
      integration,
      expectedGeneration: attempt.expectedGeneration,
      expectedProviderAccountId: attempt.expectedProviderAccountId!,
      token,
      me,
      evidence,
    });
    return { connected: true as const, state: await this.state.read(user) };
  }

  private async requireIntegration(
    creator: CanonicalCreatorContext,
  ): Promise<CreatorSocialIntegration> {
    const integration = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.creatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
    });
    if (!integration?.nativePlatformUserId.trim()) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_NOT_CONNECTED,
        message: "An existing stable Instagram identity is required.",
      });
    }
    return integration;
  }

  private isExplicitlyDisconnected(integration: CreatorSocialIntegration) {
    return Boolean(
      integration.disconnectedAt ||
      integration.tokenStateCondition === OAuthTokenStatus.REVOKED ||
      integration.authorizationHealth ===
        ProviderAuthorizationHealth.DISCONNECTED,
    );
  }

  private async revalidationCapabilities(
    accessToken: string,
    integration: CreatorSocialIntegration,
  ): Promise<CapabilityEvidence> {
    try {
      return this.evidenceFromPermissions(
        await this.graph.fetchGrantedPermissions(accessToken),
      );
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
      const classification =
        error.classification as InstagramProviderErrorClass;
      if (classification === "PROVIDER_ACCESS_BLOCKED") {
        return {
          tokenScopePermissions: integration.tokenScopePermissions,
          basic: ProviderCapabilityState.AVAILABLE,
          insights: ProviderCapabilityState.UNKNOWN,
          health: ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
          reasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
        };
      }
      if (
        classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
        classification === "PERMISSION_LOSS"
      ) {
        return {
          tokenScopePermissions: integration.tokenScopePermissions,
          basic: ProviderCapabilityState.UNAVAILABLE,
          insights: ProviderCapabilityState.UNKNOWN,
          health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
          reasonCode: "INSTAGRAM_PERMISSION_REVALIDATION_REQUIRED",
        };
      }
      return {
        tokenScopePermissions: integration.tokenScopePermissions,
        basic: ProviderCapabilityState.AVAILABLE,
        insights: ProviderCapabilityState.UNKNOWN,
        health: ProviderAuthorizationHealth.USABLE,
        reasonCode: null,
      };
    }
  }

  private async reconnectCapabilities(
    token: InstagramTokenExchangeResult,
  ): Promise<CapabilityEvidence> {
    try {
      return this.evidenceFromPermissions(
        await this.graph.fetchGrantedPermissions(token.accessToken),
      );
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
      const permissions = normalizeCreatorInstagramPermissions(
        token.permissions,
      );
      if (error.classification === "PROVIDER_ACCESS_BLOCKED") {
        return {
          tokenScopePermissions: permissions,
          basic: ProviderCapabilityState.AVAILABLE,
          insights: ProviderCapabilityState.UNKNOWN,
          health: ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
          reasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
        };
      }
      if (
        error.classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
        error.classification === "PERMISSION_LOSS"
      ) {
        return {
          tokenScopePermissions: permissions,
          basic: ProviderCapabilityState.UNAVAILABLE,
          insights: ProviderCapabilityState.UNKNOWN,
          health: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
          reasonCode: "INSTAGRAM_PERMISSION_REVALIDATION_REQUIRED",
        };
      }
      return {
        tokenScopePermissions: permissions,
        basic: ProviderCapabilityState.AVAILABLE,
        insights: ProviderCapabilityState.UNKNOWN,
        health: ProviderAuthorizationHealth.USABLE,
        reasonCode: null,
      };
    }
  }

  private evidenceFromPermissions(values: string[]): CapabilityEvidence {
    const permissions = normalizeCreatorInstagramPermissions(values);
    const hasBasic = permissions.includes(CREATOR_INSTAGRAM_BASIC_PERMISSION);
    return {
      tokenScopePermissions: permissions,
      basic: hasBasic
        ? ProviderCapabilityState.AVAILABLE
        : ProviderCapabilityState.UNAVAILABLE,
      insights: permissions.includes(CREATOR_INSTAGRAM_INSIGHTS_PERMISSION)
        ? ProviderCapabilityState.AVAILABLE
        : ProviderCapabilityState.UNAVAILABLE,
      health: hasBasic
        ? ProviderAuthorizationHealth.USABLE
        : ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      reasonCode: hasBasic
        ? null
        : "INSTAGRAM_BUSINESS_BASIC_PERMISSION_MISSING",
    };
  }

  private async updateRevalidation(
    integration: CreatorSocialIntegration,
    me: InstagramMeProfile,
    evidence: CapabilityEvidence,
  ): Promise<void> {
    const now = new Date();
    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: integration.id,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
        nativePlatformUserId: integration.nativePlatformUserId,
        disconnectedAt: null,
      },
      data: {
        channelHandleString: me.username,
        channelDisplayTitle: me.name,
        verifiedAvatarUrl: me.profilePictureUrl,
        mediaCountCache: me.mediaCount,
        professionalAccountType: me.accountType,
        lastMetadataSyncAt: now,
        tokenScopePermissions: evidence.tokenScopePermissions,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        basicAuthorizationCapability: evidence.basic,
        insightsCapability: evidence.insights,
        authorizationHealth: evidence.health,
        authorizationHealthReasonCode: evidence.reasonCode,
        lastAuthorizationValidatedAt: now,
      },
    });
    if (update.count !== 1) throw this.staleAttempt();
  }

  private async persistExpired(
    integration: CreatorSocialIntegration,
  ): Promise<void> {
    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: integration.id,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
        disconnectedAt: null,
      },
      data: {
        tokenStateCondition: OAuthTokenStatus.EXPIRED,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        authorizationHealthReasonCode: "TOKEN_EXPIRED",
        lastAuthorizationValidatedAt: new Date(),
      },
    });
    if (update.count !== 1) throw this.staleAttempt();
  }

  private async applyProviderFailure(
    integration: CreatorSocialIntegration,
    error: unknown,
  ): Promise<void> {
    const classification = this.providerClassification(error);
    if (classification === "PROVIDER_ACCESS_BLOCKED") {
      await this.updateFailure(integration, {
        authorizationHealth:
          ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
        authorizationHealthReasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
      });
      return;
    }
    if (
      classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
      classification === "PERMISSION_LOSS"
    ) {
      await this.updateFailure(integration, {
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        authorizationHealthReasonCode:
          "INSTAGRAM_AUTHORIZATION_REVALIDATION_REQUIRED",
      });
    }
  }

  private async updateFailure(
    integration: CreatorSocialIntegration,
    data: {
      basicAuthorizationCapability?: ProviderCapabilityState;
      insightsCapability?: ProviderCapabilityState;
      authorizationHealth: ProviderAuthorizationHealth;
      authorizationHealthReasonCode: string;
    },
  ): Promise<void> {
    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: integration.id,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
        disconnectedAt: null,
      },
      data: { ...data, lastAuthorizationValidatedAt: new Date() },
    });
    if (update.count !== 1) throw this.staleAttempt();
  }

  private assertReconnectAttempt(
    attempt: {
      provider: ProviderOAuthProvider;
      subjectType: ProviderOAuthSubjectType;
      creatorProfileId: string | null;
      initiatedByUserId: string;
      redirectUri: string;
      intent: InstagramOAuthIntent;
      expectedGeneration: number;
      expectedProviderAccountId: string | null;
    },
    creator: CanonicalCreatorContext,
    redirectUri: string,
    integration: CreatorSocialIntegration,
  ): void {
    if (
      attempt.provider !== ProviderOAuthProvider.INSTAGRAM ||
      attempt.subjectType !== ProviderOAuthSubjectType.CREATOR ||
      attempt.creatorProfileId !== creator.creatorProfileId ||
      attempt.initiatedByUserId !== creator.userId ||
      attempt.redirectUri !== redirectUri ||
      attempt.intent !== InstagramOAuthIntent.RECONNECT ||
      attempt.expectedGeneration !== integration.authorizationGeneration ||
      attempt.expectedProviderAccountId !== integration.nativePlatformUserId
    ) {
      throw this.staleAttempt();
    }
  }

  private async promoteReconnect(args: {
    creator: CanonicalCreatorContext;
    integration: CreatorSocialIntegration;
    expectedGeneration: number;
    expectedProviderAccountId: string;
    token: InstagramTokenExchangeResult;
    me: InstagramMeProfile;
    evidence: CapabilityEvidence;
  }): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + args.token.expiresInSeconds * 1000,
    );
    await this.prisma.$transaction(async (tx) => {
      await this.contexts.assertInTransaction(tx, args.creator);
      const update = await tx.creatorSocialIntegration.updateMany({
        where: {
          id: args.integration.id,
          creatorProfileId: args.creator.creatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: args.expectedProviderAccountId,
          authorizationGeneration: args.expectedGeneration,
          credentialVersion: args.integration.credentialVersion,
        },
        data: {
          oauthAccessTokenEncrypted: encryptField(args.token.accessToken),
          tokenScopePermissions: args.evidence.tokenScopePermissions,
          tokenStateCondition: OAuthTokenStatus.ACTIVE,
          tokenExpiresAt: expiresAt,
          tokenIssuedAt: now,
          tokenRefreshedAt: null,
          channelHandleString: args.me.username,
          channelDisplayTitle: args.me.name,
          verifiedAvatarUrl: args.me.profilePictureUrl,
          mediaCountCache: args.me.mediaCount,
          professionalAccountType: args.me.accountType,
          lastMetadataSyncAt: now,
          basicAuthorizationCapability: args.evidence.basic,
          insightsCapability: args.evidence.insights,
          authorizationHealth: args.evidence.health,
          authorizationHealthReasonCode: args.evidence.reasonCode,
          lastAuthorizationValidatedAt: now,
          disconnectedAt: null,
          authorizationGeneration: { increment: 1 },
          credentialVersion: { increment: 1 },
        },
      });
      if (update.count !== 1) throw this.staleAttempt();
    });
  }

  private async exchangeCode(code: string, redirectUri: string) {
    try {
      return await this.oauth.exchangeAuthorizationCode(code, redirectUri);
    } catch (error) {
      throw this.providerFailure(error);
    }
  }

  private async fetchStableIdentity(accessToken: string) {
    try {
      return await this.graph.fetchMe(accessToken);
    } catch (error) {
      throw this.providerFailure(error);
    }
  }

  private assertProfessionalAccount(
    accountType: InstagramProfessionalAccountType,
  ): void {
    if (accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED,
        message: "A Professional Instagram account is required.",
      });
    }
    if (!this.isProfessional(accountType)) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROFESSIONAL_ACCOUNT_REVALIDATION_REQUIRED,
        message: "Instagram Professional account type could not be verified.",
      });
    }
  }

  private isProfessional(accountType: InstagramProfessionalAccountType) {
    return (
      accountType === InstagramProfessionalAccountType.BUSINESS ||
      accountType === InstagramProfessionalAccountType.CREATOR
    );
  }

  private providerFailure(error: unknown): Error {
    const classification = this.providerClassification(error);
    if (classification === "PROVIDER_ACCESS_BLOCKED") {
      return new BadRequestException({
        code: CREATOR_ENTRY_ERROR.PROVIDER_ACCESS_BLOCKED,
        message: "Instagram access is blocked by the provider.",
      });
    }
    if (
      classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
      classification === "PERMISSION_LOSS"
    ) {
      return new BadRequestException({
        code: "INSTAGRAM_AUTHORIZATION_RESTART_REQUIRED",
        message: "Instagram authorization must be restarted.",
      });
    }
    return this.retryRequired();
  }

  private providerClassification(error: unknown): InstagramProviderErrorClass {
    if (
      error instanceof InstagramProviderRequestError ||
      error instanceof InstagramOAuthExchangeError
    ) {
      return error.classification;
    }
    return "UNKNOWN";
  }

  private isRetryable(error: unknown): boolean {
    const classification = this.providerClassification(error);
    return classification === "TRANSIENT" || classification === "UNKNOWN";
  }

  private retryRequired() {
    return new ServiceUnavailableException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROVIDER_RETRY_REQUIRED,
      message: "Instagram is temporarily unavailable. Retry revalidation.",
    });
  }

  private identityConflict() {
    return new ConflictException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_IDENTITY_CONFLICT,
      message: "Instagram returned a different stable identity.",
    });
  }

  private staleAttempt() {
    return new ConflictException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_AUTHORIZATION_STALE,
      message: "Instagram connection state changed. Start a new attempt.",
    });
  }
}

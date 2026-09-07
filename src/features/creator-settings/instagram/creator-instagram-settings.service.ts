import { evaluateInstagramOpportunity } from "../../../shared/creator/instagram-opportunity-capability";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
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

import { PrismaService } from "../../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import type { CreatorInstagramCompleteDto } from "../../creator-entry/dto/creator-entry.dto";
import {
  CREATOR_INSTAGRAM_BASIC_PERMISSION,
  CREATOR_INSTAGRAM_INSIGHTS_PERMISSION,
  normalizeCreatorInstagramPermissions,
  resolveCreatorInstagramRedirectUri,
} from "../../creator-entry/creator-instagram-authority";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
  type InstagramMeProfile,
} from "../../instagram/instagram-graph.client";
import type { InstagramProviderErrorClass } from "../../instagram/instagram-provider-error";
import {
  InstagramOAuthClient,
  InstagramOAuthExchangeError,
  type InstagramTokenExchangeResult,
} from "../../instagram/instagram-oauth.client";
import { CreatorInstagramOAuthTransactionService } from "../../provider-oauth/creator-instagram-oauth-transaction.service";
import {
  CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT,
  type CreatorInstagramSettingsActorPort,
} from "./creator-instagram-settings-actor.port";
import type {
  CreatorInstagramSettingsLifecycleState,
  CreatorInstagramSettingsReadModel,
} from "./creator-instagram-settings.types";

type CapabilityEvidence = {
  tokenScopePermissions: string[];
  basic: ProviderCapabilityState;
  insights: ProviderCapabilityState;
  health: ProviderAuthorizationHealth;
  reasonCode: string | null;
};

const INSTAGRAM = SocialNetworkProvider.INSTAGRAM;

@Injectable()
export class CreatorInstagramSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CREATOR_INSTAGRAM_SETTINGS_ACTOR_PORT)
    private readonly actors: CreatorInstagramSettingsActorPort,
    private readonly transactions: CreatorInstagramOAuthTransactionService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
  ) {}

  async read(user: AuthUser): Promise<CreatorInstagramSettingsReadModel> {
    const actor = await this.resolveActor(user, "INSTAGRAM_SETTINGS_READ");
    return this.readFor(actor);
  }

  async revalidate(user: AuthUser) {
    const actor = await this.resolveActor(user, "INSTAGRAM_SETTINGS_MANAGE");
    const integration = await this.requireIntegration(actor);
    if (this.isDisconnected(integration)) {
      throw new ConflictException({
        code: "INSTAGRAM_RECONNECT_REQUIRED",
        message: "Instagram is disconnected. Reconnect the same account.",
      });
    }

    const now = new Date();
    if (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) {
      await this.persistExpired(integration);
      return {
        revalidated: false as const,
        settings: await this.readFor(actor),
      };
    }

    const accessToken = decryptField(integration.oauthAccessTokenEncrypted);
    let me: InstagramMeProfile;
    try {
      me = await this.graph.fetchMe(accessToken);
    } catch (error) {
      await this.applyProviderFailure(integration, error);
      if (this.isRetryable(error)) throw this.providerRetryRequired();
      return {
        revalidated: false as const,
        settings: await this.readFor(actor),
      };
    }

    if (me.userId !== integration.nativePlatformUserId) {
      throw this.differentAccountBlocked();
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
        settings: await this.readFor(actor),
      };
    }

    const evidence = await this.readCapabilityEvidence(
      accessToken,
      integration.tokenScopePermissions,
    );
    await this.updateRevalidation(integration, me, evidence);
    return {
      revalidated:
        evidence.basic === ProviderCapabilityState.AVAILABLE &&
        evidence.health === ProviderAuthorizationHealth.USABLE,
      settings: await this.readFor(actor),
    };
  }

  async authorizeReconnect(user: AuthUser) {
    const actor = await this.resolveActor(user, "INSTAGRAM_SETTINGS_MANAGE");
    const integration = await this.requireIntegration(actor);
    if (this.isHealthy(integration)) {
      throw new ConflictException({
        code: "INSTAGRAM_RECONNECT_NOT_REQUIRED",
        message: "The current Instagram authorization is already healthy.",
      });
    }

    const redirectUri = resolveCreatorInstagramRedirectUri();
    const state = await this.transactions.issue({
      creatorProfileId: actor.subjectCreatorProfileId,
      initiatedByUserId: actor.actorUserId,
      redirectUri,
      intent: InstagramOAuthIntent.RECONNECT,
      expectedGeneration: integration.authorizationGeneration,
      expectedProviderAccountId: integration.nativePlatformUserId,
    });
    return {
      authorizationUrl: this.oauth.buildAuthorizeUrl(redirectUri, state),
      flow: "SAME_ID_RECONNECT" as const,
    };
  }

  async completeReconnect(user: AuthUser, input: CreatorInstagramCompleteDto) {
    const actor = await this.resolveActor(user, "INSTAGRAM_SETTINGS_MANAGE");
    const redirectUri = resolveCreatorInstagramRedirectUri();
    const attempt = await this.transactions.consume(
      {
        creatorProfileId: actor.subjectCreatorProfileId,
        initiatedByUserId: actor.actorUserId,
        redirectUri,
        intent: InstagramOAuthIntent.RECONNECT,
      },
      input.state,
    );
    const integration = await this.requireIntegration(actor);
    this.assertReconnectAttempt(attempt, actor, redirectUri, integration);

    if (input.error) {
      throw new BadRequestException({
        code: "INSTAGRAM_AUTHORIZATION_DENIED",
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
    this.assertProfessional(me.accountType);
    if (me.userId !== attempt.expectedProviderAccountId) {
      throw this.differentAccountBlocked();
    }
    const evidence = await this.reconnectCapabilityEvidence(token);

    const currentActor = await this.resolveActor(
      user,
      "INSTAGRAM_SETTINGS_MANAGE",
    );
    this.assertSameActorSubject(actor, currentActor);
    await this.promoteReconnect({
      actor,
      integration,
      expectedGeneration: attempt.expectedGeneration,
      expectedProviderAccountId: attempt.expectedProviderAccountId!,
      token,
      me,
      evidence,
    });
    return { connected: true as const, settings: await this.readFor(actor) };
  }

  async disconnect(user: AuthUser) {
    const actor = await this.resolveActor(user, "INSTAGRAM_SETTINGS_MANAGE");
    const integration = await this.requireIntegration(actor);
    if (this.isDisconnected(integration)) {
      return {
        disconnected: true as const,
        settings: await this.readFor(actor),
      };
    }

    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: integration.id,
        creatorProfileId: actor.subjectCreatorProfileId,
        platformNetwork: INSTAGRAM,
        nativePlatformUserId: integration.nativePlatformUserId,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
      },
      data: {
        tokenStateCondition: OAuthTokenStatus.REVOKED,
        authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
        authorizationHealthReasonCode: "USER_DISCONNECTED",
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNAVAILABLE,
        disconnectedAt: new Date(),
        authorizationGeneration: { increment: 1 },
        credentialVersion: { increment: 1 },
      },
    });
    if (update.count !== 1) throw this.staleAttempt();
    return { disconnected: true as const, settings: await this.readFor(actor) };
  }

  private async resolveActor(
    user: AuthUser,
    action: "INSTAGRAM_SETTINGS_READ" | "INSTAGRAM_SETTINGS_MANAGE",
  ): Promise<CreatorWorkspaceActorContext> {
    const actor = await this.actors.resolve(user);
    if (actor.actorUserId !== user.id) {
      throw new ForbiddenException("Creator actor context mismatch.");
    }
    if (
      (actor.actorRole !== "OWNER" && actor.actorRole !== "MANAGER") ||
      !actor.allowedActions.includes(action)
    ) {
      throw new ForbiddenException(
        "Your Creator Team role cannot access Instagram Settings.",
      );
    }
    return actor;
  }

  private async readFor(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorInstagramSettingsReadModel> {
    const integration = await this.findIntegration(
      actor.subjectCreatorProfileId,
    );
    if (!integration) {
      return {
        platform: "INSTAGRAM",
        lifecycleState: "NOT_CONNECTED",
        identity: {
          retained: false,
          handle: null,
          displayTitle: null,
          avatarUrl: null,
        },
        authorization: {
          health: "NOT_CONNECTED",
          reasonCode: null,
          basicCapability: "NOT_CONNECTED",
          insightsCapability: "NOT_CONNECTED",
          tokenExpiresAt: null,
          lastValidatedAt: null,
          lastMetadataSyncAt: null,
        },
        allowedActions: {
          initialConnect:
            actor.actorRole === "OWNER" || actor.actorRole === "MANAGER",
          revalidate: false,
          sameIdReconnect: false,
          disconnect: false,
        },
        recovery: this.recoveryPolicy(),
      };
    }

    const lifecycleState = this.lifecycleState(integration);
    const disconnected = this.isDisconnected(integration);
    return {
      platform: "INSTAGRAM",
      lifecycleState,
      identity: {
        retained: Boolean(integration.nativePlatformUserId.trim()),
        handle: integration.channelHandleString || null,
        displayTitle: integration.channelDisplayTitle,
        avatarUrl: integration.verifiedAvatarUrl,
      },
      authorization: {
        health: integration.authorizationHealth,
        reasonCode: integration.authorizationHealthReasonCode,
        basicCapability: integration.basicAuthorizationCapability,
        insightsCapability: integration.insightsCapability,
        tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
        lastValidatedAt:
          integration.lastAuthorizationValidatedAt?.toISOString() ?? null,
        lastMetadataSyncAt:
          integration.lastMetadataSyncAt?.toISOString() ?? null,
      },
      allowedActions: {
        initialConnect: false,
        revalidate: !disconnected,
        sameIdReconnect: !this.isHealthy(integration),
        disconnect: !disconnected,
      },
      recovery: this.recoveryPolicy(),
    };
  }

  private recoveryPolicy() {
    return {
      settingsAvailable: true as const,
      permanentIdentityRequired: true as const,
      differentAccountRequiresManualReview: true as const,
    };
  }

  private findIntegration(creatorProfileId: string) {
    return this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId,
          platformNetwork: INSTAGRAM,
        },
      },
    });
  }

  private async requireIntegration(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorSocialIntegration> {
    const integration = await this.findIntegration(
      actor.subjectCreatorProfileId,
    );
    if (!integration?.nativePlatformUserId.trim()) {
      throw new NotFoundException({
        code: "INSTAGRAM_NOT_CONNECTED",
        message: "An existing stable Instagram identity is required.",
      });
    }
    return integration;
  }

  private lifecycleState(
    integration: CreatorSocialIntegration,
  ): CreatorInstagramSettingsLifecycleState {
    return evaluateInstagramOpportunity(integration, new Date()).lifecycleState;
  }

  private isHealthy(integration: CreatorSocialIntegration): boolean {
    return evaluateInstagramOpportunity(integration, new Date())
      .usableForOpportunity;
  }

  private isDisconnected(integration: CreatorSocialIntegration): boolean {
    return Boolean(
      integration.disconnectedAt ||
      integration.tokenStateCondition === OAuthTokenStatus.REVOKED ||
      integration.authorizationHealth ===
        ProviderAuthorizationHealth.DISCONNECTED,
    );
  }

  private async readCapabilityEvidence(
    accessToken: string,
    fallbackPermissions: string[],
  ): Promise<CapabilityEvidence> {
    try {
      return this.evidenceFromPermissions(
        await this.graph.fetchGrantedPermissions(accessToken),
      );
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
      return this.evidenceFromPermissionFailure(
        error.classification as InstagramProviderErrorClass,
        fallbackPermissions,
      );
    }
  }

  private async reconnectCapabilityEvidence(
    token: InstagramTokenExchangeResult,
  ): Promise<CapabilityEvidence> {
    try {
      return this.evidenceFromPermissions(
        await this.graph.fetchGrantedPermissions(token.accessToken),
      );
    } catch (error) {
      if (!(error instanceof InstagramPermissionEvidenceError)) throw error;
      return this.evidenceFromPermissionFailure(
        error.classification as InstagramProviderErrorClass,
        normalizeCreatorInstagramPermissions(token.permissions),
      );
    }
  }

  private evidenceFromPermissionFailure(
    classification: InstagramProviderErrorClass,
    permissions: string[],
  ): CapabilityEvidence {
    if (classification === "PROVIDER_ACCESS_BLOCKED") {
      return {
        tokenScopePermissions: permissions,
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
        nativePlatformUserId: integration.nativePlatformUserId,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
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
    actor: CreatorWorkspaceActorContext,
    redirectUri: string,
    integration: CreatorSocialIntegration,
  ): void {
    if (
      attempt.provider !== ProviderOAuthProvider.INSTAGRAM ||
      attempt.subjectType !== ProviderOAuthSubjectType.CREATOR ||
      attempt.creatorProfileId !== actor.subjectCreatorProfileId ||
      attempt.initiatedByUserId !== actor.actorUserId ||
      attempt.redirectUri !== redirectUri ||
      attempt.intent !== InstagramOAuthIntent.RECONNECT ||
      attempt.expectedGeneration !== integration.authorizationGeneration ||
      attempt.expectedProviderAccountId !== integration.nativePlatformUserId
    ) {
      throw this.staleAttempt();
    }
  }

  private assertSameActorSubject(
    before: CreatorWorkspaceActorContext,
    after: CreatorWorkspaceActorContext,
  ): void {
    if (
      before.actorUserId !== after.actorUserId ||
      before.actorMembershipId !== after.actorMembershipId ||
      before.actorRole !== after.actorRole ||
      before.workspaceId !== after.workspaceId ||
      before.organizationId !== after.organizationId ||
      before.subjectCreatorProfileId !== after.subjectCreatorProfileId ||
      before.subjectOwnerUserId !== after.subjectOwnerUserId
    ) {
      throw this.staleAttempt();
    }
  }

  private async promoteReconnect(args: {
    actor: CreatorWorkspaceActorContext;
    integration: CreatorSocialIntegration;
    expectedGeneration: number;
    expectedProviderAccountId: string;
    token: InstagramTokenExchangeResult;
    me: InstagramMeProfile;
    evidence: CapabilityEvidence;
  }): Promise<void> {
    const now = new Date();
    const tokenExpiresAt = new Date(
      now.getTime() + args.token.expiresInSeconds * 1000,
    );
    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: args.integration.id,
        creatorProfileId: args.actor.subjectCreatorProfileId,
        platformNetwork: INSTAGRAM,
        nativePlatformUserId: args.expectedProviderAccountId,
        authorizationGeneration: args.expectedGeneration,
        credentialVersion: args.integration.credentialVersion,
      },
      data: {
        oauthAccessTokenEncrypted: encryptField(args.token.accessToken),
        tokenScopePermissions: args.evidence.tokenScopePermissions,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        tokenExpiresAt,
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
  }

  private async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<InstagramTokenExchangeResult> {
    try {
      return await this.oauth.exchangeAuthorizationCode(code, redirectUri);
    } catch (error) {
      throw this.providerFailure(error);
    }
  }

  private async fetchStableIdentity(
    accessToken: string,
  ): Promise<InstagramMeProfile> {
    try {
      return await this.graph.fetchMe(accessToken);
    } catch (error) {
      throw this.providerFailure(error);
    }
  }

  private assertProfessional(
    accountType: InstagramProfessionalAccountType,
  ): void {
    if (accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED",
        message: "A Professional Instagram account is required.",
      });
    }
    if (!this.isProfessional(accountType)) {
      throw new BadRequestException({
        code: "INSTAGRAM_PROFESSIONAL_ACCOUNT_REVALIDATION_REQUIRED",
        message: "Instagram Professional account type could not be verified.",
      });
    }
  }

  private isProfessional(
    accountType: InstagramProfessionalAccountType,
  ): boolean {
    return (
      accountType === InstagramProfessionalAccountType.BUSINESS ||
      accountType === InstagramProfessionalAccountType.CREATOR
    );
  }

  private providerFailure(error: unknown): Error {
    const classification = this.providerClassification(error);
    if (classification === "PROVIDER_ACCESS_BLOCKED") {
      return new BadRequestException({
        code: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
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
    return this.providerRetryRequired();
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

  private providerRetryRequired() {
    return new ServiceUnavailableException({
      code: "INSTAGRAM_PROVIDER_RETRY_REQUIRED",
      message: "Instagram is temporarily unavailable. Retry from Settings.",
    });
  }

  private differentAccountBlocked() {
    return new ConflictException({
      code: "INSTAGRAM_DIFFERENT_ACCOUNT_BLOCKED",
      lifecycleState: "DIFFERENT_ACCOUNT_BLOCKED",
      manualReviewRequired: true,
      message:
        "A different Instagram account cannot replace the permanent identity. Contact support for manual review.",
    });
  }

  private staleAttempt() {
    return new ConflictException({
      code: "INSTAGRAM_AUTHORIZATION_STALE",
      message: "Instagram connection state changed. Start a new attempt.",
    });
  }
}

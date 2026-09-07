import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  Prisma,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
  SocialNetworkProvider,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { encryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
  type InstagramMeProfile,
} from "../instagram/instagram-graph.client";
import {
  InstagramOAuthExchangeError,
  InstagramOAuthClient,
  type InstagramTokenExchangeResult,
} from "../instagram/instagram-oauth.client";
import { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
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

type InitialConnectContext = {
  authUser: AuthUser;
  actorUserId: string;
  actorMembershipId: string;
  workspaceId: string;
  organizationId: string;
  subjectCreatorProfileId: string;
  subjectOwnerUserId: string;
};

@Injectable()
export class CreatorInstagramConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: CreatorInstagramOAuthTransactionService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly state: CreatorEntryStateService,
    private readonly workspaceActors: CreatorWorkspaceActorService,
  ) {}

  async authorize(user: AuthUser) {
    const creator = await this.resolveInitialConnectContext(user);
    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.subjectCreatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
      select: { nativePlatformUserId: true },
    });
    if (existing) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_RECOVERY_FLOW_REQUIRED,
        message: "An Instagram identity already exists. Use the recovery flow.",
      });
    }

    const redirectUri = resolveCreatorInstagramRedirectUri();
    const state = await this.transactions.issue({
      creatorProfileId: creator.subjectCreatorProfileId,
      initiatedByUserId: creator.actorUserId,
      redirectUri,
      intent: InstagramOAuthIntent.INITIAL_CONNECT,
      expectedGeneration: 0,
      expectedProviderAccountId: null,
    });

    return {
      authorizationUrl: this.oauth.buildAuthorizeUrl(redirectUri, state),
    };
  }

  async complete(user: AuthUser, input: CreatorInstagramCompleteDto) {
    const creator = await this.resolveInitialConnectContext(user);
    const redirectUri = resolveCreatorInstagramRedirectUri();
    const attempt = await this.transactions.consume(
      {
        creatorProfileId: creator.subjectCreatorProfileId,
        initiatedByUserId: creator.actorUserId,
        redirectUri,
        intent: InstagramOAuthIntent.INITIAL_CONNECT,
        expectedGeneration: 0,
        expectedProviderAccountId: null,
      },
      input.state,
    );
    this.assertInitialConnectAttempt(attempt, creator, redirectUri);
    await this.assertInitialGeneration(creator, attempt.expectedGeneration);

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
    const evidence = await this.classifyCapabilities(token);
    await this.promoteInitialConnection({
      creator,
      attemptGeneration: attempt.expectedGeneration,
      token,
      me,
      evidence,
    });

    return {
      connected: true as const,
      state: await this.state.readCanonicalOwner(creator.subjectOwnerUserId),
    };
  }

  private assertInitialConnectAttempt(
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
    creator: InitialConnectContext,
    redirectUri: string,
  ): void {
    if (
      attempt.provider !== ProviderOAuthProvider.INSTAGRAM ||
      attempt.subjectType !== ProviderOAuthSubjectType.CREATOR ||
      attempt.creatorProfileId !== creator.subjectCreatorProfileId ||
      attempt.initiatedByUserId !== creator.actorUserId ||
      attempt.redirectUri !== redirectUri ||
      attempt.intent !== InstagramOAuthIntent.INITIAL_CONNECT ||
      attempt.expectedGeneration !== 0 ||
      attempt.expectedProviderAccountId !== null
    ) {
      throw this.staleAttempt();
    }
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

  private async assertInitialGeneration(
    creator: InitialConnectContext,
    expectedGeneration: number,
  ): Promise<void> {
    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.subjectCreatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
      select: { authorizationGeneration: true },
    });
    if (expectedGeneration !== 0 || existing) throw this.staleAttempt();
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

  private assertProfessionalAccount(
    accountType: InstagramProfessionalAccountType,
  ): void {
    if (accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED,
        message: "A Professional Instagram account is required.",
      });
    }
    if (
      accountType !== InstagramProfessionalAccountType.BUSINESS &&
      accountType !== InstagramProfessionalAccountType.CREATOR
    ) {
      throw new BadRequestException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROFESSIONAL_ACCOUNT_REVALIDATION_REQUIRED,
        message: "Instagram Professional account type could not be verified.",
      });
    }
  }

  private async classifyCapabilities(
    token: InstagramTokenExchangeResult,
  ): Promise<CapabilityEvidence> {
    try {
      const providerPermissions = normalizeCreatorInstagramPermissions(
        await this.graph.fetchGrantedPermissions(token.accessToken),
      );
      const hasBasic = providerPermissions.includes(
        CREATOR_INSTAGRAM_BASIC_PERMISSION,
      );
      return {
        tokenScopePermissions: providerPermissions,
        basic: hasBasic
          ? ProviderCapabilityState.AVAILABLE
          : ProviderCapabilityState.UNAVAILABLE,
        insights: providerPermissions.includes(
          CREATOR_INSTAGRAM_INSIGHTS_PERMISSION,
        )
          ? ProviderCapabilityState.AVAILABLE
          : ProviderCapabilityState.UNAVAILABLE,
        health: hasBasic
          ? ProviderAuthorizationHealth.USABLE
          : ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        reasonCode: hasBasic
          ? null
          : "INSTAGRAM_BUSINESS_BASIC_PERMISSION_MISSING",
      };
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

  private async promoteInitialConnection(args: {
    creator: InitialConnectContext;
    attemptGeneration: number;
    token: InstagramTokenExchangeResult;
    me: InstagramMeProfile;
    evidence: CapabilityEvidence;
  }): Promise<void> {
    const now = new Date();
    const encryptedToken = encryptField(args.token.accessToken);
    const expiresAt = new Date(
      now.getTime() + args.token.expiresInSeconds * 1000,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertInitialConnectContextInTransaction(tx, args.creator);
        const existing = await tx.creatorSocialIntegration.findUnique({
          where: {
            creatorProfileId_platformNetwork: {
              creatorProfileId: args.creator.subjectCreatorProfileId,
              platformNetwork: SocialNetworkProvider.INSTAGRAM,
            },
          },
        });
        if (existing || args.attemptGeneration !== 0) {
          throw this.staleAttempt();
        }
        const owner = await tx.creatorSocialIntegration.findUnique({
          where: {
            platformNetwork_nativePlatformUserId: {
              platformNetwork: SocialNetworkProvider.INSTAGRAM,
              nativePlatformUserId: args.me.userId,
            },
          },
          select: { creatorProfileId: true },
        });
        if (owner) throw this.identityAlreadyInUse();

        await tx.creatorSocialIntegration.create({
          data: {
            creatorProfileId: args.creator.subjectCreatorProfileId,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
            nativePlatformUserId: args.me.userId,
            channelHandleString: args.me.username,
            channelDisplayTitle: args.me.name,
            verifiedAvatarUrl: args.me.profilePictureUrl,
            oauthAccessTokenEncrypted: encryptedToken,
            oauthRefreshTokenEncrypted: null,
            tokenScopePermissions: args.evidence.tokenScopePermissions,
            tokenStateCondition: OAuthTokenStatus.ACTIVE,
            tokenExpiresAt: expiresAt,
            tokenIssuedAt: now,
            tokenRefreshedAt: null,
            authorizationGeneration: 1,
            credentialVersion: 1,
            authorizationHealth: args.evidence.health,
            authorizationHealthReasonCode: args.evidence.reasonCode,
            basicAuthorizationCapability: args.evidence.basic,
            insightsCapability: args.evidence.insights,
            lastAuthorizationValidatedAt: now,
            disconnectedAt: null,
            lastMetadataSyncAt: now,
            professionalAccountType: args.me.accountType,
            mediaCountCache: args.me.mediaCount,
          },
        });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code !== "P2002") throw error;
      const owner = await this.prisma.creatorSocialIntegration.findUnique({
        where: {
          platformNetwork_nativePlatformUserId: {
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
            nativePlatformUserId: args.me.userId,
          },
        },
        select: { creatorProfileId: true },
      });
      if (
        owner &&
        owner.creatorProfileId !== args.creator.subjectCreatorProfileId
      ) {
        throw this.identityAlreadyInUse();
      }
      throw this.staleAttempt();
    }
  }

  /**
   * COMPATIBILITY_RECONCILIATION_ONLY.
   *
   * C-01's initial connection originally coupled actor User and Owner subject.
   * C-05 resolves the direct Team User actor while retaining the canonical
   * Owner CreatorProfile as provider subject. The same resolver preserves the
   * previous Owner path through its canonical Owner reconciliation.
   */
  private async resolveInitialConnectContext(
    user: AuthUser,
  ): Promise<InitialConnectContext> {
    const actor = await this.workspaceActors.resolve(user);
    this.assertInitialConnectActor(actor, user.id);
    return {
      authUser: user,
      actorUserId: actor.actorUserId,
      actorMembershipId: actor.actorMembershipId,
      workspaceId: actor.workspaceId,
      organizationId: actor.organizationId,
      subjectCreatorProfileId: actor.subjectCreatorProfileId,
      subjectOwnerUserId: actor.subjectOwnerUserId,
    };
  }

  private async assertInitialConnectContextInTransaction(
    tx: Prisma.TransactionClient,
    expected: InitialConnectContext,
  ): Promise<void> {
    const current = await this.workspaceActors.resolveInTransaction(
      tx,
      expected.authUser,
      expected.workspaceId,
    );
    this.assertInitialConnectActor(current, expected.actorUserId);
    if (
      current.actorMembershipId !== expected.actorMembershipId ||
      current.organizationId !== expected.organizationId ||
      current.subjectCreatorProfileId !== expected.subjectCreatorProfileId ||
      current.subjectOwnerUserId !== expected.subjectOwnerUserId
    ) {
      throw this.staleAttempt();
    }
  }

  private assertInitialConnectActor(
    actor: CreatorWorkspaceActorContext,
    authenticatedUserId: string,
  ): void {
    if (
      actor.actorUserId !== authenticatedUserId ||
      (actor.actorRole !== "OWNER" && actor.actorRole !== "MANAGER") ||
      !actor.allowedActions.includes("INSTAGRAM_SETTINGS_MANAGE")
    ) {
      throw new ForbiddenException(
        "Your Creator Team role cannot connect Instagram.",
      );
    }
  }

  private providerFailure(error: unknown): Error {
    const classification =
      error instanceof InstagramProviderRequestError
        ? error.classification
        : error instanceof InstagramOAuthExchangeError
          ? error.classification
          : "UNKNOWN";
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
    return new ServiceUnavailableException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_PROVIDER_RETRY_REQUIRED,
      message: "Instagram is temporarily unavailable. Start a new attempt.",
    });
  }

  private staleAttempt(): ConflictException {
    return new ConflictException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_AUTHORIZATION_STALE,
      message: "Instagram connection state changed. Start a new attempt.",
    });
  }

  private identityAlreadyInUse(): ConflictException {
    return new ConflictException({
      code: CREATOR_ENTRY_ERROR.INSTAGRAM_IDENTITY_ALREADY_IN_USE,
      message: "This Instagram identity is already connected.",
    });
  }
}

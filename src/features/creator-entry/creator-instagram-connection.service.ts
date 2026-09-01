import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CreatorTeamRole,
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  OrganizationKind,
  Prisma,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { encryptField } from "../../shared/crypto/field-encryption.util";
import type { AuthUser } from "../auth/types/auth-user";
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
import type { CreatorInstagramCompleteDto } from "./dto/creator-entry.dto";

const CREATOR_INSTAGRAM_REDIRECT_URIS = new Set([
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback",
  "https://dashboard.thecreatorshop.in/creator-marketplace/callback",
]);

const BASIC_PERMISSION = "instagram_business_basic";
const INSIGHTS_PERMISSION = "instagram_business_manage_insights";

type CanonicalCreatorContext = {
  userId: string;
  creatorProfileId: string;
};

type CapabilityEvidence = {
  tokenScopePermissions: string[];
  basic: ProviderCapabilityState;
  insights: ProviderCapabilityState;
  health: ProviderAuthorizationHealth;
  reasonCode: string | null;
};

@Injectable()
export class CreatorInstagramConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: CreatorInstagramOAuthTransactionService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly state: CreatorEntryStateService,
  ) {}

  async authorize(user: AuthUser) {
    const creator = await this.resolveCanonicalCreator(user.id);
    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.creatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
      select: { nativePlatformUserId: true },
    });
    if (existing) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.INSTAGRAM_RECOVERY_FLOW_REQUIRED,
        message:
          "An Instagram identity already exists. Use the recovery flow when it becomes available.",
      });
    }

    const redirectUri = this.resolveRedirectUri();
    const state = await this.transactions.issue({
      creatorProfileId: creator.creatorProfileId,
      initiatedByUserId: creator.userId,
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
    const creator = await this.resolveCanonicalCreator(user.id);
    const redirectUri = this.resolveRedirectUri();
    const attempt = await this.transactions.consume(
      {
        creatorProfileId: creator.creatorProfileId,
        initiatedByUserId: creator.userId,
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
      state: await this.state.read(user),
    };
  }

  private async resolveCanonicalCreator(
    userId: string,
  ): Promise<CanonicalCreatorContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        creatorProfile: {
          include: {
            ownedWorkspaces: {
              include: {
                members: {
                  where: {
                    isActive: true,
                    securityRole: CreatorTeamRole.OWNER,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user || user.role !== UserRole.CREATOR) {
      throw new ConflictException({
        code: CREATOR_ENTRY_ERROR.ACCOUNT_CONTEXT_CONFLICT,
        message: "Creator account context is required.",
      });
    }
    if (!this.isCanonicalCreator(user)) {
      throw new ConflictException({
        code: "CONTEXT_RECOVERY_REQUIRED",
        message: "Creator account context requires recovery.",
      });
    }
    return { userId: user.id, creatorProfileId: user.creatorProfile!.id };
  }

  private isCanonicalCreator(user: {
    authState: UserAuthState;
    organizationId: string | null;
    organization: { kind: OrganizationKind } | null;
    creatorProfile: {
      id: string;
      ownedWorkspaces: Array<{
        ownerProfileId: string;
        organizationId: string;
        members: Array<{ assignedProfileId: string | null }>;
      }>;
    } | null;
  }): boolean {
    const profile = user.creatorProfile;
    const workspaces = profile?.ownedWorkspaces ?? [];
    const workspace = workspaces[0];
    return Boolean(
      user.authState === UserAuthState.ACTIVE &&
      user.organizationId &&
      user.organization?.kind === OrganizationKind.CREATOR &&
      profile &&
      workspaces.length === 1 &&
      workspace.ownerProfileId === profile.id &&
      workspace.organizationId === user.organizationId &&
      workspace.members.length === 1 &&
      workspace.members[0].assignedProfileId === profile.id,
    );
  }

  private resolveRedirectUri(): string {
    const value = process.env.CREATOR_INSTAGRAM_REDIRECT_URI?.trim();
    if (!value || !CREATOR_INSTAGRAM_REDIRECT_URIS.has(value)) {
      throw new BadRequestException({
        code: "CREATOR_INSTAGRAM_REDIRECT_URI_INVALID",
        message: "Creator Instagram authorization is not configured.",
      });
    }
    return value;
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
    creator: CanonicalCreatorContext,
    redirectUri: string,
  ): void {
    if (
      attempt.provider !== ProviderOAuthProvider.INSTAGRAM ||
      attempt.subjectType !== ProviderOAuthSubjectType.CREATOR ||
      attempt.creatorProfileId !== creator.creatorProfileId ||
      attempt.initiatedByUserId !== creator.userId ||
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
    creator: CanonicalCreatorContext,
    expectedGeneration: number,
  ): Promise<void> {
    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.creatorProfileId,
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
      const providerPermissions = normalizePermissions(
        await this.graph.fetchGrantedPermissions(token.accessToken),
      );
      const hasBasic = providerPermissions.includes(BASIC_PERMISSION);
      return {
        tokenScopePermissions: providerPermissions,
        basic: hasBasic
          ? ProviderCapabilityState.AVAILABLE
          : ProviderCapabilityState.UNAVAILABLE,
        insights: providerPermissions.includes(INSIGHTS_PERMISSION)
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
      const permissions = normalizePermissions(token.permissions);
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
    creator: CanonicalCreatorContext;
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
        await this.assertCanonicalCreatorInTransaction(tx, args.creator);
        const existing = await tx.creatorSocialIntegration.findUnique({
          where: {
            creatorProfileId_platformNetwork: {
              creatorProfileId: args.creator.creatorProfileId,
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
            creatorProfileId: args.creator.creatorProfileId,
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
      if (owner && owner.creatorProfileId !== args.creator.creatorProfileId) {
        throw this.identityAlreadyInUse();
      }
      throw this.staleAttempt();
    }
  }

  private async assertCanonicalCreatorInTransaction(
    tx: Prisma.TransactionClient,
    expected: CanonicalCreatorContext,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: expected.userId },
      include: {
        organization: true,
        creatorProfile: {
          include: {
            ownedWorkspaces: {
              include: {
                members: {
                  where: {
                    isActive: true,
                    securityRole: CreatorTeamRole.OWNER,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (
      !user ||
      user.role !== UserRole.CREATOR ||
      user.creatorProfile?.id !== expected.creatorProfileId ||
      !this.isCanonicalCreator(user)
    ) {
      throw this.staleAttempt();
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

function normalizePermissions(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))]
    .filter(Boolean)
    .sort();
}

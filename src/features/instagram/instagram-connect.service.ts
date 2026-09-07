import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  Prisma,
  SocialNetworkProvider,
} from "@prisma/client";
import { addSeconds } from "date-fns";

import type { AuthUser } from "../auth/types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import {
  encryptField,
  decryptField,
} from "../../shared/crypto/field-encryption.util";
import { CreatorSettingsAccessService } from "../creator-settings/services/creator-settings-access.service";
import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramOAuthClient } from "./instagram-oauth.client";

export type InstagramConnectResult = {
  nativePlatformUserId: string;
  username: string;
  accountType: InstagramProfessionalAccountType;
  followersCount: number;
};

@Injectable()
export class InstagramConnectService {
  private readonly logger = new Logger(InstagramConnectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: InstagramOAuthClient,
    private readonly graph: InstagramGraphClient,
    private readonly access: CreatorSettingsAccessService,
  ) {}

  async connectForUser(
    user: AuthUser,
    args: { code: string; redirectUri: string; expectedHandle?: string },
  ): Promise<InstagramConnectResult> {
    const profile = await this.access.resolveCreatorProfile(user);
    const tokenResult = await this.oauth.exchangeAuthorizationCode(
      args.code,
      args.redirectUri,
    );
    const me = await this.graph.fetchMe(tokenResult.accessToken);

    if (me.accountType === InstagramProfessionalAccountType.PERSONAL) {
      throw new BadRequestException({
        code: "PERSONAL_ACCOUNT",
        message:
          "Personal Instagram accounts cannot connect. Switch to a Creator or Business account.",
      });
    }

    const duplicate = await this.prisma.creatorSocialIntegration.findFirst({
      where: {
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: me.userId,
        NOT: { creatorProfileId: profile.id },
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
      },
    });
    if (duplicate) {
      throw new ConflictException({
        code: "DUPLICATE_META_ID",
        message: "This Instagram profile is already linked to another account.",
      });
    }

    if (
      args.expectedHandle &&
      normalize(args.expectedHandle) !== normalize(me.username)
    ) {
      this.logger.warn(
        `Handle mismatch expected=${args.expectedHandle} actual=${me.username}`,
      );
    }

    const now = new Date();
    const expiresAt = addSeconds(now, tokenResult.expiresInSeconds);
    const encryptedToken = encryptField(tokenResult.accessToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.creatorSocialIntegration.upsert({
        where: {
          creatorProfileId_platformNetwork: {
            creatorProfileId: profile.id,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
          },
        },
        create: {
          creatorProfileId: profile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: me.userId,
          channelHandleString: me.username,
          channelDisplayTitle: me.name,
          verifiedAvatarUrl: me.profilePictureUrl,
          oauthAccessTokenEncrypted: encryptedToken,
          tokenScopePermissions: [
            "instagram_graph_user_profile",
            "instagram_graph_user_media",
          ],
          tokenStateCondition: OAuthTokenStatus.ACTIVE,
          tokenExpiresAt: expiresAt,
          tokenIssuedAt: now,
          authorizationGeneration: 1,
          credentialVersion: 1,
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
          basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
          insightsCapability: ProviderCapabilityState.UNKNOWN,
          lastAuthorizationValidatedAt: now,
          professionalAccountType: me.accountType,
          mediaCountCache: me.mediaCount,
          lastMetadataSyncAt: new Date(),
        },
        update: {
          nativePlatformUserId: me.userId,
          channelHandleString: me.username,
          channelDisplayTitle: me.name,
          verifiedAvatarUrl: me.profilePictureUrl,
          oauthAccessTokenEncrypted: encryptedToken,
          tokenStateCondition: OAuthTokenStatus.ACTIVE,
          tokenExpiresAt: expiresAt,
          tokenRefreshedAt: now,
          authorizationGeneration: { increment: 1 },
          credentialVersion: { increment: 1 },
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
          authorizationHealthReasonCode: null,
          basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
          insightsCapability: ProviderCapabilityState.UNKNOWN,
          lastAuthorizationValidatedAt: now,
          disconnectedAt: null,
          professionalAccountType: me.accountType,
          mediaCountCache: me.mediaCount,
          lastMetadataSyncAt: new Date(),
        },
      });

      await tx.creatorProfile.update({
        where: { id: profile.id },
        data: {
          instagramHandle: me.username,
          displayName: me.name ?? me.username,
          avatarUrl: me.profilePictureUrl,
          followerCount: me.followersCount,
        },
      });
    });

    return {
      nativePlatformUserId: me.userId,
      username: me.username,
      accountType: me.accountType,
      followersCount: me.followersCount,
    };
  }

  async getActiveAccessTokenForUser(userId: string): Promise<string> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new BadRequestException("Creator profile not found.");
    }

    const integration = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: profile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
    });

    if (
      !integration ||
      integration.tokenStateCondition !== OAuthTokenStatus.ACTIVE
    ) {
      throw new BadRequestException("Instagram is not connected.");
    }

    return decryptField(integration.oauthAccessTokenEncrypted);
  }
}

function normalize(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

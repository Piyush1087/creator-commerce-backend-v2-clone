import { Injectable, Logger } from "@nestjs/common";
import {
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  type CreatorSocialIntegration,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../shared/crypto/field-encryption.util";
import type { InstagramProviderErrorClass } from "../instagram/instagram-provider-error";
import {
  InstagramOAuthClient,
  InstagramTokenRefreshError,
} from "../instagram/instagram-oauth.client";
import {
  INSTAGRAM_LONG_LIVED_TOKEN_REFRESH_MIN_AGE_MS,
  INSTAGRAM_LONG_LIVED_TOKEN_REFRESH_WINDOW_MS,
} from "../instagram/instagram-token-lifecycle.constants";

export const CREATOR_INSTAGRAM_REFRESH_MIN_AGE_MS =
  INSTAGRAM_LONG_LIVED_TOKEN_REFRESH_MIN_AGE_MS;
export const CREATOR_INSTAGRAM_REFRESH_WINDOW_MS =
  INSTAGRAM_LONG_LIVED_TOKEN_REFRESH_WINDOW_MS;
export const CREATOR_INSTAGRAM_REFRESH_BATCH_SIZE = 50;

type RefreshCounters = {
  scanned: number;
  refreshed: number;
  expired: number;
  reauthorizationRequired: number;
  providerBlocked: number;
  retryableFailures: number;
};

@Injectable()
export class CreatorInstagramTokenRefreshService {
  private readonly logger = new Logger(
    CreatorInstagramTokenRefreshService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: InstagramOAuthClient,
  ) {}

  async refreshDueTokens(now = new Date()): Promise<RefreshCounters> {
    const candidates = await this.prisma.creatorSocialIntegration.findMany({
      where: {
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: { not: "" },
        disconnectedAt: null,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        tokenExpiresAt: {
          lte: new Date(now.getTime() + CREATOR_INSTAGRAM_REFRESH_WINDOW_MS),
        },
        OR: [
          { tokenExpiresAt: { lte: now } },
          {
            tokenExpiresAt: { gt: now },
            tokenIssuedAt: {
              lte: new Date(
                now.getTime() - CREATOR_INSTAGRAM_REFRESH_MIN_AGE_MS,
              ),
            },
          },
        ],
      },
      orderBy: { tokenExpiresAt: "asc" },
      take: CREATOR_INSTAGRAM_REFRESH_BATCH_SIZE,
    });
    const result: RefreshCounters = {
      scanned: candidates.length,
      refreshed: 0,
      expired: 0,
      reauthorizationRequired: 0,
      providerBlocked: 0,
      retryableFailures: 0,
    };

    for (const integration of candidates) {
      try {
        const outcome = await this.refreshOne(integration, now);
        result[outcome] += 1;
      } catch {
        result.retryableFailures += 1;
        this.logger.error(
          `creator.instagram.refresh_failed integrationId=${integration.id} generation=${integration.authorizationGeneration} credentialVersion=${integration.credentialVersion}`,
        );
      }
    }
    return result;
  }

  private async refreshOne(
    integration: CreatorSocialIntegration,
    now: Date,
  ): Promise<keyof Omit<RefreshCounters, "scanned">> {
    if (!integration.tokenExpiresAt || integration.tokenExpiresAt <= now) {
      const updated = await this.updateFenced(integration, {
        tokenStateCondition: OAuthTokenStatus.EXPIRED,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        authorizationHealthReasonCode: "TOKEN_EXPIRED",
        lastAuthorizationValidatedAt: now,
      });
      return updated ? "expired" : "retryableFailures";
    }

    const accessToken = decryptField(integration.oauthAccessTokenEncrypted);
    try {
      const token = await this.oauth.refreshLongLivedToken(accessToken);
      const authorizationHealth =
        integration.authorizationHealth ===
        ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED
          ? ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED
          : integration.basicAuthorizationCapability ===
              ProviderCapabilityState.AVAILABLE
            ? ProviderAuthorizationHealth.USABLE
            : ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED;
      const reasonCode =
        authorizationHealth === ProviderAuthorizationHealth.USABLE
          ? null
          : authorizationHealth ===
              ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED
            ? (integration.authorizationHealthReasonCode ??
              "INSTAGRAM_PROVIDER_ACCESS_BLOCKED")
            : "INSTAGRAM_BASIC_CAPABILITY_UNAVAILABLE";
      const updated = await this.updateFenced(integration, {
        oauthAccessTokenEncrypted: encryptField(token.accessToken),
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        tokenExpiresAt: new Date(now.getTime() + token.expiresInSeconds * 1000),
        tokenIssuedAt: now,
        tokenRefreshedAt: now,
        credentialVersion: { increment: 1 },
        authorizationHealth,
        authorizationHealthReasonCode: reasonCode,
      });
      return updated ? "refreshed" : "retryableFailures";
    } catch (error) {
      const classification = this.classification(error);
      if (
        classification === "AUTHORIZATION_REVALIDATION_REQUIRED" ||
        classification === "PERMISSION_LOSS"
      ) {
        const updated = await this.updateFenced(integration, {
          basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
          insightsCapability: ProviderCapabilityState.UNKNOWN,
          authorizationHealth:
            ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
          authorizationHealthReasonCode:
            "INSTAGRAM_AUTHORIZATION_REVALIDATION_REQUIRED",
        });
        return updated ? "reauthorizationRequired" : "retryableFailures";
      }
      if (classification === "PROVIDER_ACCESS_BLOCKED") {
        const updated = await this.updateFenced(integration, {
          authorizationHealth:
            ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
          authorizationHealthReasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
        });
        return updated ? "providerBlocked" : "retryableFailures";
      }
      this.logger.warn(
        `creator.instagram.refresh_retry integrationId=${integration.id} classification=${classification} generation=${integration.authorizationGeneration} credentialVersion=${integration.credentialVersion}`,
      );
      return "retryableFailures";
    }
  }

  private async updateFenced(
    integration: CreatorSocialIntegration,
    data: Parameters<
      PrismaService["creatorSocialIntegration"]["updateMany"]
    >[0]["data"],
  ): Promise<boolean> {
    const result = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: integration.id,
        authorizationGeneration: integration.authorizationGeneration,
        credentialVersion: integration.credentialVersion,
        nativePlatformUserId: integration.nativePlatformUserId,
        disconnectedAt: null,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
      },
      data,
    });
    return result.count === 1;
  }

  private classification(error: unknown): InstagramProviderErrorClass {
    return error instanceof InstagramTokenRefreshError
      ? error.classification
      : "UNKNOWN";
  }
}

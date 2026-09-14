import { Injectable } from "@nestjs/common";
import {
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { decryptField } from "../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import type { CreatorAudienceConsumer } from "./contracts/creator-audience-v0.contract";

export type CreatorAudienceFenceProjection = Readonly<{
  integrationId: string | null;
  providerAccountId: string | null;
  authorizationGeneration: number | null;
  sourceStatus: CreatorAudienceConsumer["sourceStatus"];
  authorized: boolean;
}>;

export type CreatorAudienceCredentialFence = Readonly<{
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  accessToken: string;
}>;

@Injectable()
export class CreatorAudienceCredentialFenceService {
  constructor(private readonly prisma: PrismaService) {}

  async project(
    actor: CreatorWorkspaceActorContext,
  ): Promise<CreatorAudienceFenceProjection> {
    const integration = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: actor.subjectCreatorProfileId,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
    });
    if (!integration?.nativePlatformUserId.trim()) {
      return {
        integrationId: null,
        providerAccountId: null,
        authorizationGeneration: null,
        sourceStatus: "DISCONNECTED",
        authorized: false,
      };
    }
    const exactIdentity =
      integration.creatorProfileId === actor.subjectCreatorProfileId;
    const active =
      exactIdentity &&
      !integration.disconnectedAt &&
      integration.tokenStateCondition === OAuthTokenStatus.ACTIVE &&
      (!integration.tokenExpiresAt || integration.tokenExpiresAt > new Date());
    const professional =
      integration.professionalAccountType ===
        InstagramProfessionalAccountType.BUSINESS ||
      integration.professionalAccountType ===
        InstagramProfessionalAccountType.CREATOR;
    const basic =
      integration.basicAuthorizationCapability ===
      ProviderCapabilityState.AVAILABLE;
    const insights =
      integration.insightsCapability === ProviderCapabilityState.AVAILABLE;
    const health = integration.authorizationHealth;
    const authorized =
      active &&
      professional &&
      basic &&
      insights &&
      health === ProviderAuthorizationHealth.USABLE;
    let sourceStatus: CreatorAudienceConsumer["sourceStatus"] = "CONNECTED";
    if (!active || health === ProviderAuthorizationHealth.DISCONNECTED) {
      sourceStatus = "DISCONNECTED";
    } else if (
      health === ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED ||
      integration.tokenStateCondition === OAuthTokenStatus.EXPIRED
    ) {
      sourceStatus = "REAUTH_REQUIRED";
    } else if (health === ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED) {
      sourceStatus = "PROVIDER_FAILURE";
    } else if (
      integration.insightsCapability === ProviderCapabilityState.UNKNOWN
    ) {
      sourceStatus = "CAPABILITY_UNKNOWN";
    } else if (!insights || !basic || !professional) {
      sourceStatus = "CAPABILITY_PARTIAL";
    }
    return {
      integrationId: integration.id,
      providerAccountId: integration.nativePlatformUserId,
      authorizationGeneration: integration.authorizationGeneration,
      sourceStatus,
      authorized,
    };
  }

  async acquire(
    actor: CreatorWorkspaceActorContext,
    expected: Readonly<{
      integrationId: string;
      providerAccountId: string;
      authorizationGeneration: number;
    }>,
  ): Promise<CreatorAudienceCredentialFence> {
    const projected = await this.project(actor);
    if (
      !projected.authorized ||
      projected.integrationId !== expected.integrationId ||
      projected.providerAccountId !== expected.providerAccountId ||
      projected.authorizationGeneration !== expected.authorizationGeneration
    ) {
      throw new Error("CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED");
    }
    const integration = await this.prisma.creatorSocialIntegration.findUnique({
      where: { id: expected.integrationId },
      select: { oauthAccessTokenEncrypted: true },
    });
    if (!integration) throw new Error("CREATOR_AUDIENCE_INTEGRATION_MISSING");
    return {
      ...expected,
      accessToken: decryptField(integration.oauthAccessTokenEncrypted),
    };
  }
}

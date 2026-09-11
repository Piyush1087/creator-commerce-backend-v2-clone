import { Inject, Injectable } from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { decryptField } from "../../../shared/crypto/field-encryption.util";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramAudienceBreakdown,
  type InstagramAudiencePopulation,
  type InstagramAudienceTimeframe,
  type InstagramIntelligenceProviderReadClient,
} from "../../instagram/instagram-intelligence-provider.types";

export type InstagramIntelligenceReadCommand =
  | { kind: "PROFILE" }
  | { kind: "MEDIA_INVENTORY"; windowEnd: Date }
  | { kind: "MEDIA_INSIGHTS"; mediaId: string; mediaType: string }
  | {
      kind: "AUDIENCE_INSIGHTS";
      population: InstagramAudiencePopulation;
      breakdown: InstagramAudienceBreakdown;
      timeframe: InstagramAudienceTimeframe;
    }
  | { kind: "CAROUSEL_CHILDREN"; mediaId: string };

export class InstagramIntelligenceReadFenceError extends Error {
  constructor(
    readonly code:
      | "INTEGRATION_NOT_FOUND"
      | "PROVIDER_MISMATCH"
      | "BRAND_MISMATCH"
      | "ACCOUNT_MISMATCH"
      | "GENERATION_MISMATCH"
      | "INTEGRATION_INACTIVE"
      | "AUTHORIZATION_UNAVAILABLE"
      | "IDENTITY_UNVERIFIED"
      | "CAPABILITY_UNAVAILABLE"
      | "CREDENTIAL_UNAVAILABLE",
  ) {
    super(`Instagram intelligence read denied: ${code}`);
  }
}

@Injectable()
export class InstagramIntelligenceConnectionReadService {
  constructor(private readonly prisma: PrismaService) {}

  async read(brandProfileId: string) {
    const integration = await this.prisma.brandIntegration.findFirst({
      where: {
        brandProfileId,
        provider: BrandIntegrationProvider.INSTAGRAM,
      },
      select: NON_SECRET_CONNECTION_SELECT,
    });
    if (!integration) return null;
    return {
      integrationId: integration.id,
      brandProfileId: integration.brandProfileId,
      provider: integration.provider,
      handle: integration.currentPlatformHandle,
      status: integration.status,
      isActive: integration.isActive,
      providerAccountId: integration.providerAccountId,
      identityVerification: integration.identityVerification,
      authorizationHealth: integration.authorizationHealth,
      firstPartyProfileCapability: integration.firstPartyProfileCapability,
      firstPartyInsightsCapability: integration.firstPartyInsightsCapability,
      syncHealth: integration.syncHealth,
      humanActionRequired: integration.humanActionRequired,
      authorizationGeneration: integration.authorizationGeneration,
      credentialVersion: integration.credentialVersion,
      tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    };
  }
}

@Injectable()
export class InstagramIntelligenceAuthorizedReadService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    private readonly provider: InstagramIntelligenceProviderReadClient,
  ) {}

  async execute(input: {
    brandProfileId: string;
    integrationId: string;
    expectedProviderAccountId: string;
    expectedAuthorizationGeneration: number;
    command: InstagramIntelligenceReadCommand;
  }) {
    const integration = await this.prisma.brandIntegration.findUnique({
      where: { id: input.integrationId },
      select: AUTHORIZED_CONNECTION_SELECT,
    });
    if (!integration)
      throw new InstagramIntelligenceReadFenceError("INTEGRATION_NOT_FOUND");
    if (integration.provider !== BrandIntegrationProvider.INSTAGRAM) {
      throw new InstagramIntelligenceReadFenceError("PROVIDER_MISMATCH");
    }
    if (integration.brandProfileId !== input.brandProfileId) {
      throw new InstagramIntelligenceReadFenceError("BRAND_MISMATCH");
    }
    if (
      !integration.providerAccountId ||
      integration.identityVerification !==
        InstagramIdentityVerification.VERIFIED
    ) {
      throw new InstagramIntelligenceReadFenceError("IDENTITY_UNVERIFIED");
    }
    if (integration.providerAccountId !== input.expectedProviderAccountId) {
      throw new InstagramIntelligenceReadFenceError("ACCOUNT_MISMATCH");
    }
    if (
      integration.authorizationGeneration !==
      input.expectedAuthorizationGeneration
    ) {
      throw new InstagramIntelligenceReadFenceError("GENERATION_MISMATCH");
    }
    if (!integration.isActive) {
      throw new InstagramIntelligenceReadFenceError("INTEGRATION_INACTIVE");
    }
    if (
      (integration.status !== BrandIntegrationStatus.CONNECTED &&
        integration.status !== BrandIntegrationStatus.PARTIALLY_CONNECTED) ||
      (integration.authorizationHealth !==
        InstagramAuthorizationHealth.CONNECTED_FULL &&
        integration.authorizationHealth !==
          InstagramAuthorizationHealth.PARTIALLY_CONNECTED)
    ) {
      throw new InstagramIntelligenceReadFenceError(
        "AUTHORIZATION_UNAVAILABLE",
      );
    }
    const requiredCapability =
      input.command.kind === "MEDIA_INSIGHTS" ||
      input.command.kind === "AUDIENCE_INSIGHTS"
        ? integration.firstPartyInsightsCapability
        : integration.firstPartyProfileCapability;
    if (requiredCapability !== InstagramCapabilityState.YES) {
      throw new InstagramIntelligenceReadFenceError("CAPABILITY_UNAVAILABLE");
    }
    if (!integration.accessTokenEncrypted) {
      throw new InstagramIntelligenceReadFenceError("CREDENTIAL_UNAVAILABLE");
    }

    // Decryption occurs only after every Settings-owned identity, generation,
    // authorization and capability fence succeeds. The plaintext never leaves this scope.
    const credential = {
      accessToken: decryptField(integration.accessTokenEncrypted),
      providerAccountId: integration.providerAccountId,
    };
    const lineage = {
      integrationId: integration.id,
      brandProfileId: integration.brandProfileId,
      providerAccountId: integration.providerAccountId,
      authorizationGeneration: integration.authorizationGeneration,
      credentialVersion: integration.credentialVersion,
    };

    switch (input.command.kind) {
      case "PROFILE":
        return { lineage, result: await this.provider.readProfile(credential) };
      case "MEDIA_INVENTORY":
        return {
          lineage,
          result: await this.provider.readMediaInventory(
            credential,
            input.command.windowEnd,
          ),
        };
      case "MEDIA_INSIGHTS":
        return {
          lineage,
          result: await this.provider.readMediaInsights(
            credential,
            input.command.mediaId,
            input.command.mediaType,
          ),
        };
      case "AUDIENCE_INSIGHTS":
        return {
          lineage,
          result: await this.provider.readAudienceInsights(
            credential,
            input.command.population,
            input.command.breakdown,
            input.command.timeframe,
          ),
        };
      case "CAROUSEL_CHILDREN":
        return {
          lineage,
          result: await this.provider.readCarouselChildren(
            credential,
            input.command.mediaId,
          ),
        };
    }
  }
}

const NON_SECRET_CONNECTION_SELECT = {
  id: true,
  brandProfileId: true,
  provider: true,
  currentPlatformHandle: true,
  status: true,
  isActive: true,
  providerAccountId: true,
  identityVerification: true,
  authorizationHealth: true,
  firstPartyProfileCapability: true,
  firstPartyInsightsCapability: true,
  syncHealth: true,
  humanActionRequired: true,
  authorizationGeneration: true,
  credentialVersion: true,
  tokenExpiresAt: true,
} as const;

const AUTHORIZED_CONNECTION_SELECT = {
  ...NON_SECRET_CONNECTION_SELECT,
  accessTokenEncrypted: true,
} as const;

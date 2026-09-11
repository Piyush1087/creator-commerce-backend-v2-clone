import { Injectable } from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { decryptField } from "../../../shared/crypto/field-encryption.util";
import { InstagramContainedImageAcquisitionService } from "../../instagram/media/instagram-contained-image-acquisition.service";
import type { InstagramContainedImageAcquisitionResult } from "../../instagram/media/instagram-image-acquisition.types";
import { InstagramIntelligenceReadFenceError } from "./instagram-intelligence-provider-read.service";

@Injectable()
export class InstagramIntelligenceAuthorizedImageAcquisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acquisition: InstagramContainedImageAcquisitionService,
  ) {}

  async acquire(input: {
    brandProfileId: string;
    integrationId: string;
    expectedProviderAccountId: string;
    expectedAuthorizationGeneration: number;
    mediaId: string;
    now?: () => Date;
    signal?: AbortSignal;
  }): Promise<InstagramContainedImageAcquisitionResult> {
    const integration = await this.prisma.brandIntegration.findUnique({
      where: { id: input.integrationId },
      select: {
        id: true,
        brandProfileId: true,
        provider: true,
        status: true,
        isActive: true,
        providerAccountId: true,
        identityVerification: true,
        authorizationHealth: true,
        firstPartyProfileCapability: true,
        authorizationGeneration: true,
        accessTokenEncrypted: true,
      },
    });
    if (!integration) {
      throw new InstagramIntelligenceReadFenceError("INTEGRATION_NOT_FOUND");
    }
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
    if (
      integration.firstPartyProfileCapability !== InstagramCapabilityState.YES
    ) {
      throw new InstagramIntelligenceReadFenceError("CAPABILITY_UNAVAILABLE");
    }
    if (!integration.accessTokenEncrypted) {
      throw new InstagramIntelligenceReadFenceError("CREDENTIAL_UNAVAILABLE");
    }

    return this.acquisition.acquire({
      credential: {
        accessToken: decryptField(integration.accessTokenEncrypted),
        providerAccountId: integration.providerAccountId,
      },
      mediaId: input.mediaId,
      isolationScope: input.brandProfileId,
      ...(input.now ? { now: input.now } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }
}

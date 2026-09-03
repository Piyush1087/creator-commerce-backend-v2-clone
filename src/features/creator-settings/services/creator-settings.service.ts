import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorSettingsAccessService } from "./creator-settings-access.service";

/**
 * COMPATIBILITY_RECONCILIATION_ONLY.
 *
 * This class is deliberately not registered or exported by
 * CreatorSettingsModule. It remains only for the existing C-01 database
 * continuity fixture, whose direct disconnect simulates a historical Owner
 * runtime. All live C-05 routes use the canonical actor-aware services.
 */
@Injectable()
export class CreatorSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CreatorSettingsAccessService,
  ) {}

  async disconnectSocialIntegration(
    user: AuthUser,
    platform: SocialNetworkProvider,
  ) {
    if (platform !== SocialNetworkProvider.INSTAGRAM) {
      throw new BadRequestException(
        "Only Instagram is supported in Creator Settings MVP.",
      );
    }
    const profile = await this.access.resolveCreatorProfile(user);
    const workspace = await this.access.resolveWorkspace(
      profile.id,
      user.email,
    );
    const role = await this.access.resolveWorkspaceRole(
      workspace.id,
      user,
      profile.id,
    );

    if (this.access.isAssistantReadOnly(role)) {
      throw new ForbiddenException(
        "Assistant profiles cannot disconnect social channels.",
      );
    }

    const existing = await this.prisma.creatorSocialIntegration.findUnique({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: profile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
    });
    if (!existing) throw new NotFoundException("Social integration not found");

    const update = await this.prisma.creatorSocialIntegration.updateMany({
      where: {
        id: existing.id,
        authorizationGeneration: existing.authorizationGeneration,
        credentialVersion: existing.credentialVersion,
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
    if (update.count !== 1) {
      throw new BadRequestException(
        "Instagram connection changed. Refresh Settings and try again.",
      );
    }
    return { disconnected: true, platform };
  }
}

import { Injectable } from "@nestjs/common";
import {
  CreatorTeamRole,
  OrganizationKind,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../auth/types/auth-user";
import type {
  CreatorEntryAccountContext,
  CreatorEntryNextAction,
} from "./creator-entry.types";

@Injectable()
export class CreatorEntryStateService {
  constructor(private readonly prisma: PrismaService) {}

  async read(authUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
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
            socialIntegrations: {
              where: { platformNetwork: SocialNetworkProvider.INSTAGRAM },
            },
          },
        },
      },
    });

    if (!user || user.role !== UserRole.CREATOR) {
      return this.nonReady(
        "ACCOUNT_CONTEXT_CONFLICT",
        "RESOLVE_ACCOUNT_CONTEXT",
      );
    }

    const profile = user.creatorProfile;
    const workspaces = profile?.ownedWorkspaces ?? [];
    const workspace = workspaces[0];
    const canonical =
      user.authState === UserAuthState.ACTIVE &&
      user.organizationId !== null &&
      user.organization?.kind === OrganizationKind.CREATOR &&
      profile !== null &&
      workspaces.length === 1 &&
      workspace.organizationId === user.organizationId &&
      workspace.members.length === 1 &&
      workspace.members[0].assignedProfileId === profile.id;

    if (!canonical) {
      return this.nonReady(
        "CONTEXT_RECOVERY_REQUIRED",
        "RECOVER_CREATOR_CONTEXT",
      );
    }

    const integration = profile.socialIntegrations[0];
    const identityConnected = Boolean(
      integration &&
      integration.nativePlatformUserId.trim() &&
      integration.tokenStateCondition === OAuthTokenStatus.ACTIVE &&
      !integration.disconnectedAt,
    );
    const basicAuthorization =
      integration?.basicAuthorizationCapability ??
      ProviderCapabilityState.UNKNOWN;
    const insightsCapability =
      integration?.insightsCapability ?? ProviderCapabilityState.UNKNOWN;
    const authorizationHealth =
      integration?.authorizationHealth ?? ProviderAuthorizationHealth.UNKNOWN;
    const canEnterCreatorPlatform =
      identityConnected &&
      basicAuthorization === ProviderCapabilityState.AVAILABLE &&
      authorizationHealth === ProviderAuthorizationHealth.USABLE;

    return {
      accountContext: "CREATOR_READY" as CreatorEntryAccountContext,
      onboardingStatus: canEnterCreatorPlatform ? "READY" : "INCOMPLETE",
      canEnterCreatorPlatform,
      nextAction: (canEnterCreatorPlatform
        ? "CREATOR_WORKSPACE_ENTRY"
        : "CONNECT_INSTAGRAM") as CreatorEntryNextAction,
      instagram: {
        identityConnection: identityConnected
          ? ("CONNECTED" as const)
          : ("NOT_CONNECTED" as const),
        basicAuthorization,
        insightsCapability,
        authorizationHealth,
      },
    };
  }

  private nonReady(
    accountContext: CreatorEntryAccountContext,
    nextAction: CreatorEntryNextAction,
  ) {
    return {
      accountContext,
      onboardingStatus: "INCOMPLETE" as const,
      canEnterCreatorPlatform: false,
      nextAction,
      instagram: {
        identityConnection: "NOT_CONNECTED" as const,
        basicAuthorization: ProviderCapabilityState.UNKNOWN,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        authorizationHealth: ProviderAuthorizationHealth.UNKNOWN,
      },
    };
  }
}

import { Injectable } from "@nestjs/common";
import {
  CreatorTeamRole,
  OrganizationKind,
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
    return this.readCanonicalOwner(authUser.id);
  }

  /**
   * C-05 subject/actor compatibility seam. A Team actor may complete an
   * Owner-subject provider operation, while Creator Entry state remains the
   * canonical Owner subject's state.
   */
  async readCanonicalOwner(subjectOwnerUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: subjectOwnerUserId },
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
    const basicAuthorization =
      integration?.basicAuthorizationCapability ??
      ProviderCapabilityState.UNKNOWN;
    const insightsCapability =
      integration?.insightsCapability ?? ProviderCapabilityState.UNKNOWN;
    const authorizationHealth =
      integration?.authorizationHealth ?? ProviderAuthorizationHealth.UNKNOWN;
    const hasStableProviderIdentity = Boolean(
      integration?.nativePlatformUserId.trim(),
    );
    const explicitlyDisconnected = Boolean(
      integration &&
      (integration.disconnectedAt ||
        authorizationHealth === ProviderAuthorizationHealth.DISCONNECTED),
    );
    const identityConnection = !hasStableProviderIdentity
      ? ("NOT_CONNECTED" as const)
      : explicitlyDisconnected
        ? ("DISCONNECTED" as const)
        : ("CONNECTED" as const);
    const canEnterCreatorPlatform =
      identityConnection === "CONNECTED" &&
      basicAuthorization === ProviderCapabilityState.AVAILABLE &&
      authorizationHealth === ProviderAuthorizationHealth.USABLE;
    const nextAction = this.nextInstagramAction({
      canEnterCreatorPlatform,
      identityConnection,
      basicAuthorization,
      authorizationHealth,
    });

    return {
      accountContext: "CREATOR_READY" as CreatorEntryAccountContext,
      onboardingStatus: canEnterCreatorPlatform ? "COMPLETE" : "INCOMPLETE",
      canEnterCreatorPlatform,
      nextAction,
      instagram: {
        identityConnection,
        basicAuthorization,
        insightsCapability,
        authorizationHealth,
      },
    };
  }

  private nextInstagramAction(input: {
    canEnterCreatorPlatform: boolean;
    identityConnection: "NOT_CONNECTED" | "DISCONNECTED" | "CONNECTED";
    basicAuthorization: ProviderCapabilityState;
    authorizationHealth: ProviderAuthorizationHealth;
  }): CreatorEntryNextAction {
    if (input.canEnterCreatorPlatform) return "CREATOR_WORKSPACE_ENTRY";
    if (input.identityConnection === "NOT_CONNECTED") {
      return "CONNECT_INSTAGRAM";
    }
    if (input.identityConnection === "DISCONNECTED") {
      return "RECONNECT_INSTAGRAM";
    }
    if (
      input.authorizationHealth === ProviderAuthorizationHealth.UNKNOWN ||
      input.authorizationHealth ===
        ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED
    ) {
      return "REVALIDATE_INSTAGRAM";
    }
    if (
      input.authorizationHealth ===
        ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED ||
      input.basicAuthorization === ProviderCapabilityState.UNAVAILABLE
    ) {
      return "RECONNECT_INSTAGRAM";
    }
    return "REVALIDATE_INSTAGRAM";
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

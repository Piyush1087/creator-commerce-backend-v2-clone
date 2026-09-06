import { Injectable } from "@nestjs/common";
import {
  BrandIntegrationProvider,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandSettingsAccessService } from "./brand-settings-access.service";

const ALL_INSTAGRAM_CAPABILITIES = [
  "PROFILE",
  "INSIGHTS",
  "BUSINESS_DISCOVERY",
  "CREATOR_DISCOVERY",
] as const;

type ProductProviderCapability = (typeof ALL_INSTAGRAM_CAPABILITIES)[number];

@Injectable()
export class BrandProviderReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandSettingsAccessService,
  ) {}

  async read(user: AuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(user);
    this.access.assertInstagramAction(membership.role, "READ");

    const integration = await this.prisma.brandIntegration.findFirst({
      where: {
        brandProfileId,
        provider: BrandIntegrationProvider.INSTAGRAM,
      },
      select: {
        authorizationHealth: true,
        firstPartyProfileCapability: true,
        firstPartyInsightsCapability: true,
        businessDiscoveryCapability: true,
        creatorMarketplaceCapability: true,
        humanActionRequired: true,
        isActive: true,
      },
    });

    const provider = this.mapInstagram(integration);
    return {
      contractVersion: "1.0" as const,
      brandId: brandProfileId,
      observedAt: new Date().toISOString(),
      providers: [provider],
      limitations:
        integration?.authorizationHealth ===
        InstagramAuthorizationHealth.UNKNOWN
          ? [
              "Instagram readiness is unavailable because canonical authorization health is unknown.",
            ]
          : [],
    };
  }

  private mapInstagram(
    integration: {
      authorizationHealth: InstagramAuthorizationHealth;
      firstPartyProfileCapability: InstagramCapabilityState;
      firstPartyInsightsCapability: InstagramCapabilityState;
      businessDiscoveryCapability: InstagramCapabilityState;
      creatorMarketplaceCapability: InstagramCapabilityState;
      humanActionRequired: boolean;
      isActive: boolean;
    } | null,
  ) {
    const affected = integration
      ? this.affectedCapabilities(integration)
      : [...ALL_INSTAGRAM_CAPABILITIES];
    const health = integration?.authorizationHealth;

    if (!integration || !integration.isActive || health === "DISCONNECTED") {
      return {
        provider: "INSTAGRAM" as const,
        state: "NOT_CONNECTED" as const,
        reasonCode: "INSTAGRAM_NOT_CONNECTED",
        affectedProductCapabilities: [...ALL_INSTAGRAM_CAPABILITIES],
        humanActionRequired: integration?.humanActionRequired ?? false,
        recoveryDestinationId: "SETTINGS_INTEGRATIONS" as const,
        freshness: "UNKNOWN" as const,
      };
    }
    if (health === "CONNECTED_FULL") {
      return {
        provider: "INSTAGRAM" as const,
        state: "READY" as const,
        reasonCode: "INSTAGRAM_READY",
        affectedProductCapabilities: [] as ProductProviderCapability[],
        humanActionRequired: false,
        recoveryDestinationId: null,
        freshness: "CURRENT" as const,
      };
    }
    if (health === "PARTIALLY_CONNECTED") {
      return {
        provider: "INSTAGRAM" as const,
        state: "LIMITED" as const,
        reasonCode: "INSTAGRAM_CAPABILITIES_LIMITED",
        affectedProductCapabilities: affected,
        humanActionRequired: integration.humanActionRequired,
        recoveryDestinationId: integration.humanActionRequired
          ? ("SETTINGS_INTEGRATIONS" as const)
          : null,
        freshness: "CURRENT" as const,
      };
    }
    if (health === "NEEDS_REVALIDATION") {
      return {
        provider: "INSTAGRAM" as const,
        state: integration.humanActionRequired
          ? ("ACTION_REQUIRED" as const)
          : ("LIMITED" as const),
        reasonCode: integration.humanActionRequired
          ? "INSTAGRAM_REVALIDATION_REQUIRED"
          : "INSTAGRAM_REVALIDATION_PENDING",
        affectedProductCapabilities:
          affected.length > 0 ? affected : [...ALL_INSTAGRAM_CAPABILITIES],
        humanActionRequired: integration.humanActionRequired,
        recoveryDestinationId: integration.humanActionRequired
          ? ("SETTINGS_INTEGRATIONS" as const)
          : null,
        freshness: "UNKNOWN" as const,
      };
    }
    if (health === "PROVIDER_ACCESS_BLOCKED") {
      return {
        provider: "INSTAGRAM" as const,
        state: "UNAVAILABLE" as const,
        reasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
        affectedProductCapabilities: [...ALL_INSTAGRAM_CAPABILITIES],
        humanActionRequired: integration.humanActionRequired,
        recoveryDestinationId: integration.humanActionRequired
          ? ("SETTINGS_INTEGRATIONS" as const)
          : null,
        freshness: "UNKNOWN" as const,
      };
    }
    return {
      provider: "INSTAGRAM" as const,
      state: "UNAVAILABLE" as const,
      reasonCode: "INSTAGRAM_READINESS_UNKNOWN",
      affectedProductCapabilities: [...ALL_INSTAGRAM_CAPABILITIES],
      humanActionRequired: integration.humanActionRequired,
      recoveryDestinationId: integration.humanActionRequired
        ? ("SETTINGS_INTEGRATIONS" as const)
        : null,
      freshness: "UNKNOWN" as const,
    };
  }

  private affectedCapabilities(integration: {
    firstPartyProfileCapability: InstagramCapabilityState;
    firstPartyInsightsCapability: InstagramCapabilityState;
    businessDiscoveryCapability: InstagramCapabilityState;
    creatorMarketplaceCapability: InstagramCapabilityState;
  }): ProductProviderCapability[] {
    const pairs = [
      ["PROFILE", integration.firstPartyProfileCapability],
      ["INSIGHTS", integration.firstPartyInsightsCapability],
      ["BUSINESS_DISCOVERY", integration.businessDiscoveryCapability],
      ["CREATOR_DISCOVERY", integration.creatorMarketplaceCapability],
    ] as const;
    return pairs
      .filter(([, state]) => state !== InstagramCapabilityState.YES)
      .map(([capability]) => capability);
  }
}

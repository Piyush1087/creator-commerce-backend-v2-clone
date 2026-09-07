import {
  BrandRole,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  UserRole,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandSettingsAccessService } from "./brand-settings-access.service";
import { BrandProviderReadinessService } from "./brand-provider-readiness.service";

const actor: AuthUser = {
  id: "user-1",
  email: "owner@example.test",
  name: "Owner",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

function harness(
  health: InstagramAuthorizationHealth | null,
  humanActionRequired = false,
) {
  const findFirst = vi.fn().mockResolvedValue(
    health
      ? {
          authorizationHealth: health,
          firstPartyProfileCapability: InstagramCapabilityState.YES,
          firstPartyInsightsCapability: InstagramCapabilityState.NO,
          businessDiscoveryCapability: InstagramCapabilityState.YES,
          creatorMarketplaceCapability: InstagramCapabilityState.UNKNOWN,
          humanActionRequired,
          isActive: true,
        }
      : null,
  );
  const assertInstagramAction = vi.fn();
  const service = new BrandProviderReadinessService(
    { brandIntegration: { findFirst } } as unknown as PrismaService,
    {
      resolveBrandContext: vi.fn().mockResolvedValue({
        brandProfileId: "brand-1",
        membership: { role: BrandRole.CAMPAIGN_MANAGER },
      }),
      assertInstagramAction,
    } as unknown as BrandSettingsAccessService,
  );
  return { service, findFirst, assertInstagramAction };
}

describe("BrandProviderReadinessService", () => {
  it.each([
    [InstagramAuthorizationHealth.CONNECTED_FULL, false, "READY"],
    [InstagramAuthorizationHealth.PARTIALLY_CONNECTED, false, "LIMITED"],
    [InstagramAuthorizationHealth.NEEDS_REVALIDATION, true, "ACTION_REQUIRED"],
    [InstagramAuthorizationHealth.NEEDS_REVALIDATION, false, "LIMITED"],
    [InstagramAuthorizationHealth.PROVIDER_ACCESS_BLOCKED, true, "UNAVAILABLE"],
    [InstagramAuthorizationHealth.UNKNOWN, false, "UNAVAILABLE"],
    [InstagramAuthorizationHealth.DISCONNECTED, false, "NOT_CONNECTED"],
  ])("maps %s to %s product readiness", async (health, human, expected) => {
    const { service } = harness(health, human);
    const result = await service.read(actor);
    expect(result.providers[0]?.state).toBe(expected);
  });

  it("treats an absent durable integration as not connected", async () => {
    const result = await harness(null).service.read(actor);
    expect(result.providers[0]).toMatchObject({
      provider: "INSTAGRAM",
      state: "NOT_CONNECTED",
      recoveryDestinationId: "SETTINGS_INTEGRATIONS",
    });
  });

  it("reuses Settings READ policy and selects no tokens or provider IDs", async () => {
    const { service, findFirst, assertInstagramAction } = harness(
      InstagramAuthorizationHealth.CONNECTED_FULL,
    );
    await service.read(actor);
    expect(assertInstagramAction).toHaveBeenCalledWith(
      BrandRole.CAMPAIGN_MANAGER,
      "READ",
    );
    const query = JSON.stringify(findFirst.mock.calls[0]?.[0]);
    expect(query).not.toMatch(/token|accountId|appScoped|scope|expiry/iu);
  });
});

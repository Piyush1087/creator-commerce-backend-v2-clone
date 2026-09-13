import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { InstagramIntelligenceAuthorizedVideoAcquisitionService } from "./instagram-intelligence-video-acquisition.service";

const ready = {
  brandProfileId: "brand-1",
  provider: BrandIntegrationProvider.INSTAGRAM,
  status: BrandIntegrationStatus.CONNECTED,
  isActive: true,
  providerAccountId: "account-1",
  identityVerification: InstagramIdentityVerification.VERIFIED,
  authorizationHealth: InstagramAuthorizationHealth.CONNECTED_FULL,
  firstPartyProfileCapability: InstagramCapabilityState.YES,
  authorizationGeneration: 7,
};

describe("InstagramIntelligenceAuthorizedVideoAcquisitionService replay fence", () => {
  it("checks current non-secret authorization without credential or provider access", async () => {
    const fixture = createFixture(ready);
    await expect(fixture.service.assertReplayAuthorized(input())).resolves.toBe(
      undefined,
    );
    const query = fixture.prisma.brandIntegration.findUnique.mock.calls[0]![0];
    expect(query.select).not.toHaveProperty("accessTokenEncrypted");
    expect(fixture.acquisition.acquire).not.toHaveBeenCalled();
  });

  it.each([
    ["INTEGRATION_NOT_FOUND", null],
    [
      "PROVIDER_MISMATCH",
      { ...ready, provider: BrandIntegrationProvider.META_BUSINESS_SUITE },
    ],
    ["BRAND_MISMATCH", { ...ready, brandProfileId: "brand-2" }],
    [
      "IDENTITY_UNVERIFIED",
      {
        ...ready,
        identityVerification: InstagramIdentityVerification.UNVERIFIED,
      },
    ],
    ["ACCOUNT_MISMATCH", { ...ready, providerAccountId: "account-2" }],
    ["GENERATION_MISMATCH", { ...ready, authorizationGeneration: 8 }],
    ["INTEGRATION_INACTIVE", { ...ready, isActive: false }],
    [
      "AUTHORIZATION_UNAVAILABLE",
      { ...ready, status: BrandIntegrationStatus.DISCONNECTED },
    ],
    [
      "CAPABILITY_UNAVAILABLE",
      { ...ready, firstPartyProfileCapability: InstagramCapabilityState.NO },
    ],
  ])("rejects %s before replay", async (code, integration) => {
    const fixture = createFixture(integration);
    await expect(
      fixture.service.assertReplayAuthorized(input()),
    ).rejects.toThrow(code);
    expect(fixture.acquisition.acquire).not.toHaveBeenCalled();
  });
});

function createFixture(integration: typeof ready | null) {
  const prisma = {
    brandIntegration: {
      findUnique: vi.fn().mockResolvedValue(integration),
    },
  };
  const acquisition = { acquire: vi.fn() };
  return {
    prisma,
    acquisition,
    service: new InstagramIntelligenceAuthorizedVideoAcquisitionService(
      prisma as never,
      acquisition as never,
    ),
  };
}

function input() {
  return {
    brandProfileId: "brand-1",
    integrationId: "integration-1",
    expectedProviderAccountId: "account-1",
    expectedAuthorizationGeneration: 7,
  };
}

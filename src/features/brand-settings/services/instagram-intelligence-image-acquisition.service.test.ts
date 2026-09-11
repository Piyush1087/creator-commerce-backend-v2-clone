import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { InstagramIntelligenceAuthorizedImageAcquisitionService } from "./instagram-intelligence-image-acquisition.service";

const integration = {
  id: "integration-a",
  brandProfileId: "brand-a",
  provider: BrandIntegrationProvider.INSTAGRAM,
  status: BrandIntegrationStatus.CONNECTED,
  isActive: true,
  providerAccountId: "provider-a",
  identityVerification: InstagramIdentityVerification.VERIFIED,
  authorizationHealth: InstagramAuthorizationHealth.CONNECTED_FULL,
  firstPartyProfileCapability: InstagramCapabilityState.YES,
  authorizationGeneration: 4,
  accessTokenEncrypted: "synthetic-encrypted-fixture",
};

const input = {
  brandProfileId: "brand-a",
  integrationId: "integration-a",
  expectedProviderAccountId: "provider-a",
  expectedAuthorizationGeneration: 4,
  mediaId: "media-a",
};

describe("B3A Settings-owned authorized image acquisition", () => {
  it.each([
    [
      "changed account",
      { expectedProviderAccountId: "provider-b" },
      "ACCOUNT_MISMATCH",
    ],
    [
      "stale generation",
      { expectedAuthorizationGeneration: 3 },
      "GENERATION_MISMATCH",
    ],
    ["cross Brand", { brandProfileId: "brand-b" }, "BRAND_MISMATCH"],
  ])(
    "rejects %s before credential use or acquisition",
    async (_label, changed, code) => {
      const acquisition = { acquire: vi.fn() };
      const service =
        new InstagramIntelligenceAuthorizedImageAcquisitionService(
          {
            brandIntegration: {
              findUnique: vi.fn().mockResolvedValue(integration),
            },
          } as never,
          acquisition as never,
        );
      await expect(
        service.acquire({ ...input, ...changed }),
      ).rejects.toMatchObject({
        code,
      });
      expect(acquisition.acquire).not.toHaveBeenCalled();
    },
  );

  it("rejects inactive or capability-unavailable authorization before acquisition", async () => {
    for (const changed of [
      { isActive: false },
      { firstPartyProfileCapability: InstagramCapabilityState.NO },
      { accessTokenEncrypted: null },
    ]) {
      const acquisition = { acquire: vi.fn() };
      const service =
        new InstagramIntelligenceAuthorizedImageAcquisitionService(
          {
            brandIntegration: {
              findUnique: vi
                .fn()
                .mockResolvedValue({ ...integration, ...changed }),
            },
          } as never,
          acquisition as never,
        );
      await expect(service.acquire(input)).rejects.toBeDefined();
      expect(acquisition.acquire).not.toHaveBeenCalled();
    }
  });
});

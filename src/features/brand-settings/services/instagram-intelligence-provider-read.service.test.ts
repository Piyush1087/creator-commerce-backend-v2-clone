import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
} from "@prisma/client";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { encryptField } from "../../../shared/crypto/field-encryption.util";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramIntelligenceProviderReadClient,
} from "../../instagram/instagram-intelligence-provider.types";
import {
  InstagramIntelligenceAuthorizedReadService,
  InstagramIntelligenceConnectionReadService,
} from "./instagram-intelligence-provider-read.service";

describe("Settings-owned Instagram intelligence read ports", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns only a non-secret connection projection", async () => {
    const row = readyIntegration();
    const prisma = {
      brandIntegration: { findFirst: vi.fn().mockResolvedValue(row) },
    };
    const result = await new InstagramIntelligenceConnectionReadService(
      prisma as unknown as PrismaService,
    ).read("brand-1");
    expect(result).toMatchObject({
      integrationId: "integration-1",
      brandProfileId: "brand-1",
      authorizationGeneration: 7,
      credentialVersion: 3,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /accessToken|Encrypted|synthetic-secret/i,
    );
  });

  it.each([
    ["brandProfileId", "brand-2", "BRAND_MISMATCH"],
    ["providerAccountId", "account-2", "ACCOUNT_MISMATCH"],
    ["authorizationGeneration", 8, "GENERATION_MISMATCH"],
    ["isActive", false, "INTEGRATION_INACTIVE"],
    [
      "status",
      BrandIntegrationStatus.DISCONNECTED,
      "AUTHORIZATION_UNAVAILABLE",
    ],
    [
      "identityVerification",
      InstagramIdentityVerification.UNVERIFIED,
      "IDENTITY_UNVERIFIED",
    ],
    [
      "firstPartyProfileCapability",
      InstagramCapabilityState.NO,
      "CAPABILITY_UNAVAILABLE",
    ],
    ["accessTokenEncrypted", null, "CREDENTIAL_UNAVAILABLE"],
  ] as const)(
    "rejects %s before provider invocation",
    async (field, value, code) => {
      vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "synthetic-local-key");
      const provider = providerMock();
      const row = { ...readyIntegration(), [field]: value };
      const prisma = {
        brandIntegration: { findUnique: vi.fn().mockResolvedValue(row) },
      };
      const service = new InstagramIntelligenceAuthorizedReadService(
        prisma as unknown as PrismaService,
        provider,
      );
      await expect(service.execute(validInput())).rejects.toMatchObject({
        code,
      });
      expect(provider.readProfile).not.toHaveBeenCalled();
    },
  );

  it("decrypts only after every fence and returns lineage without credentials or writes", async () => {
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "synthetic-local-key");
    const provider = providerMock();
    provider.readProfile.mockResolvedValue({ availability: "AVAILABLE" });
    const row = readyIntegration();
    const prisma = {
      brandIntegration: {
        findUnique: vi.fn().mockResolvedValue(row),
        update: vi.fn(),
      },
    };
    const result = await new InstagramIntelligenceAuthorizedReadService(
      prisma as unknown as PrismaService,
      provider,
    ).execute(validInput());
    expect(provider.readProfile).toHaveBeenCalledWith({
      accessToken: "synthetic-secret",
      providerAccountId: "account-1",
    });
    expect(result.lineage).toEqual({
      integrationId: "integration-1",
      brandProfileId: "brand-1",
      providerAccountId: "account-1",
      authorizationGeneration: 7,
      credentialVersion: 3,
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
    expect(prisma.brandIntegration.update).not.toHaveBeenCalled();
  });

  it("requires insight capability for audience and media insight commands", async () => {
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "synthetic-local-key");
    const provider = providerMock();
    const prisma = {
      brandIntegration: {
        findUnique: vi.fn().mockResolvedValue({
          ...readyIntegration(),
          firstPartyInsightsCapability: InstagramCapabilityState.NO,
        }),
      },
    };
    const service = new InstagramIntelligenceAuthorizedReadService(
      prisma as unknown as PrismaService,
      provider,
    );
    await expect(
      service.execute({
        ...validInput(),
        command: { kind: "MEDIA_INSIGHTS", mediaId: "m", mediaType: "IMAGE" },
      }),
    ).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    expect(provider.readMediaInsights).not.toHaveBeenCalled();
  });

  it("resolves both ports in Nest with a replaceable no-network provider fixture", async () => {
    const provider = providerMock();
    const module = await Test.createTestingModule({
      providers: [
        InstagramIntelligenceConnectionReadService,
        InstagramIntelligenceAuthorizedReadService,
        {
          provide: PrismaService,
          useValue: {
            brandIntegration: { findFirst: vi.fn(), findUnique: vi.fn() },
          },
        },
        {
          provide: INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
          useValue: provider,
        },
      ],
    }).compile();
    expect(
      module.get(InstagramIntelligenceConnectionReadService),
    ).toBeDefined();
    expect(
      module.get(InstagramIntelligenceAuthorizedReadService),
    ).toBeDefined();
    expect(provider.readProfile).not.toHaveBeenCalled();
  });
});

function readyIntegration() {
  process.env.SETTINGS_FIELD_ENCRYPTION_KEY = "synthetic-local-key";
  return {
    id: "integration-1",
    brandProfileId: "brand-1",
    provider: BrandIntegrationProvider.INSTAGRAM,
    status: BrandIntegrationStatus.CONNECTED,
    isActive: true,
    providerAccountId: "account-1",
    identityVerification: InstagramIdentityVerification.VERIFIED,
    authorizationHealth: InstagramAuthorizationHealth.CONNECTED_FULL,
    firstPartyProfileCapability: InstagramCapabilityState.YES,
    firstPartyInsightsCapability: InstagramCapabilityState.YES,
    authorizationGeneration: 7,
    credentialVersion: 3,
    tokenExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
    accessTokenEncrypted: encryptField("synthetic-secret"),
  };
}

function validInput() {
  return {
    brandProfileId: "brand-1",
    integrationId: "integration-1",
    expectedProviderAccountId: "account-1",
    expectedAuthorizationGeneration: 7,
    command: { kind: "PROFILE" } as const,
  };
}

function providerMock() {
  return {
    readProfile: vi.fn(),
    readMediaInventory: vi.fn(),
    readMediaInsights: vi.fn(),
    readAudienceInsights: vi.fn(),
    readCarouselChildren: vi.fn(),
  } as unknown as InstagramIntelligenceProviderReadClient & {
    readProfile: ReturnType<typeof vi.fn>;
    readMediaInsights: ReturnType<typeof vi.fn>;
  };
}

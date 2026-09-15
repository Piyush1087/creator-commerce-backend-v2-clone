import { describe, expect, it, vi } from "vitest";
import {
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
} from "@prisma/client";

import type { PrismaService } from "../../prisma/prisma.service";
import { CreatorAudienceCredentialFenceService } from "./creator-audience-credential-fence.service";

const actor = {
  actorUserId: "actor",
  actorMembershipId: "membership",
  actorRole: "OWNER" as const,
  workspaceId: "workspace",
  organizationId: "organization",
  subjectCreatorProfileId: "creator",
  subjectOwnerUserId: "owner",
  allowedActions: ["INSIGHTS_AUDIENCE_READ"],
};

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: "integration",
    creatorProfileId: "creator",
    platformNetwork: SocialNetworkProvider.INSTAGRAM,
    nativePlatformUserId: "provider-account",
    oauthAccessTokenEncrypted: "not-decrypted-by-project",
    authorizationGeneration: 3,
    tokenStateCondition: OAuthTokenStatus.ACTIVE,
    tokenExpiresAt: null,
    disconnectedAt: null,
    authorizationHealth: ProviderAuthorizationHealth.USABLE,
    basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
    insightsCapability: ProviderCapabilityState.AVAILABLE,
    professionalAccountType: InstagramProfessionalAccountType.CREATOR,
    ...overrides,
  };
}

describe("Creator Audience Settings-owned credential fence", () => {
  it("projects a connected exact account without decrypting credentials", async () => {
    const findUnique = vi.fn().mockResolvedValue(integration());
    const service = new CreatorAudienceCredentialFenceService({
      creatorSocialIntegration: { findUnique },
    } as unknown as PrismaService);
    await expect(service.project(actor)).resolves.toMatchObject({
      authorized: true,
      sourceStatus: "CONNECTED",
      providerAccountId: "provider-account",
      authorizationGeneration: 3,
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0].select).not.toHaveProperty(
      "oauthAccessTokenEncrypted",
    );
    expect(
      Object.values(findUnique.mock.calls[0][0].select).every(
        (value) => value === true,
      ),
    ).toBe(true);
  });

  it.each([
    [{ disconnectedAt: new Date() }, "DISCONNECTED"],
    [
      {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      },
      "REAUTH_REQUIRED",
    ],
    [
      { insightsCapability: ProviderCapabilityState.UNAVAILABLE },
      "CAPABILITY_PARTIAL",
    ],
    [
      { insightsCapability: ProviderCapabilityState.UNKNOWN },
      "CAPABILITY_UNKNOWN",
    ],
    [
      { professionalAccountType: InstagramProfessionalAccountType.PERSONAL },
      "CAPABILITY_PARTIAL",
    ],
  ])(
    "fails closed for unavailable authorization %#",
    async (overrides, sourceStatus) => {
      const service = new CreatorAudienceCredentialFenceService({
        creatorSocialIntegration: {
          findUnique: vi.fn().mockResolvedValue(integration(overrides)),
        },
      } as unknown as PrismaService);
      await expect(service.project(actor)).resolves.toMatchObject({
        authorized: false,
        sourceStatus,
      });
    },
  );

  it("rejects stale account or generation before credential decryption", async () => {
    const service = new CreatorAudienceCredentialFenceService({
      creatorSocialIntegration: {
        findUnique: vi.fn().mockResolvedValue(integration()),
      },
    } as unknown as PrismaService);
    await expect(
      service.acquire(actor, {
        integrationId: "integration",
        providerAccountId: "other",
        authorizationGeneration: 3,
      }),
    ).rejects.toThrow("CREATOR_AUDIENCE_AUTHORIZATION_FENCE_REJECTED");
  });
});

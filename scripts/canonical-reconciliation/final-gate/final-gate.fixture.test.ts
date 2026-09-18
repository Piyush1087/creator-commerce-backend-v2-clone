import { describe, expect, it, vi } from "vitest";
import {
  OrganizationKind,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
} from "@prisma/client";

import {
  FINAL_GATE_IDENTITIES,
  FINAL_GATE_OBJECTIVES,
  FINAL_GATE_SCENARIOS,
} from "./contracts";
import { assertB05DraftHashes, assertPublishedCanonicalHashes } from "./audit";
import { requireDisposableFinalGateDatabase } from "./guard";
import { hashCanonicalCampaignDefinition } from "../../../src/features/brand-uce/services/canonical-campaign-definition";
import { CreatorEntryStateService } from "../../../src/features/creator-entry/creator-entry-state.service";
import {
  finalGateSyntheticInstagramIntegration,
  requiresConnectedInstagram,
} from "./seed";

describe("Final Gate validation-only contracts", () => {
  it("freezes six unique role identities and four canonical objectives", () => {
    expect(new Set(Object.values(FINAL_GATE_IDENTITIES)).size).toBe(6);
    expect(FINAL_GATE_OBJECTIVES).toEqual([
      "AWARENESS",
      "TRUST",
      "ASSETS",
      "ACTION",
    ]);
  });

  it("declares all twelve isolated scenario profiles", () => {
    expect(FINAL_GATE_SCENARIOS).toEqual([
      "B01",
      "B02",
      "B03",
      "B04",
      "B05",
      "B06",
      "B07",
      "B08",
      "B09",
      "B10",
      "B11",
      "B12",
    ]);
  });

  it("makes only B08 and B11 synthetic Instagram-ready for Creator entry", async () => {
    expect(requiresConnectedInstagram("B08")).toBe(true);
    expect(requiresConnectedInstagram("B11")).toBe(true);
    for (const scenario of FINAL_GATE_SCENARIOS.filter(
      (value) => value !== "B08" && value !== "B11",
    )) {
      expect(requiresConnectedInstagram(scenario)).toBe(false);
    }

    const integration = finalGateSyntheticInstagramIntegration(
      "final-gate-creator-profile",
    );
    expect(integration).toMatchObject({
      platformNetwork: SocialNetworkProvider.INSTAGRAM,
      nativePlatformUserId: "final-gate-instagram-native-id",
      oauthAccessTokenEncrypted: "validation-only-synthetic-token",
      tokenStateCondition: "ACTIVE",
      authorizationHealth: ProviderAuthorizationHealth.USABLE,
      basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
      insightsCapability: ProviderCapabilityState.AVAILABLE,
    });
    expect(JSON.stringify(integration)).not.toMatch(/https?:\/\//);

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "final-gate-creator-owner",
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          organizationId: "final-gate-creator-organization",
          organization: { kind: OrganizationKind.CREATOR },
          creatorProfile: {
            id: "final-gate-creator-profile",
            ownedWorkspaces: [
              {
                organizationId: "final-gate-creator-organization",
                members: [{ assignedProfileId: "final-gate-creator-profile" }],
              },
            ],
            socialIntegrations: [integration],
          },
        }),
      },
    };
    const state = await new CreatorEntryStateService(
      prisma as never,
    ).readCanonicalOwner("final-gate-creator-owner");

    expect(state).toMatchObject({
      accountContext: "CREATOR_READY",
      onboardingStatus: "COMPLETE",
      canEnterCreatorPlatform: true,
      nextAction: "CREATOR_WORKSPACE_ENTRY",
      instagram: {
        identityConnection: "CONNECTED",
        basicAuthorization: ProviderCapabilityState.AVAILABLE,
        insightsCapability: ProviderCapabilityState.AVAILABLE,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("fails closed without the disposable-run marker", () => {
    const marker = process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    delete process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    expect(() => requireDisposableFinalGateDatabase()).toThrow(/required/);
    if (marker) process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN = marker;
  });

  it("requires new B05 campaigns to remain unhashed DRAFTs", () => {
    const before = [];
    const after = ["1", "2", "3", "4"].map((id) => ({
      id,
      status: "DRAFT" as const,
      canonicalDefinition: { version: "2.0" },
      canonicalDefinitionHash: null,
    }));

    expect(() => assertB05DraftHashes(before, after)).not.toThrow();
    expect(() =>
      assertB05DraftHashes(before, [
        ...after.slice(0, 3),
        { ...after[3], canonicalDefinitionHash: `sha256:${"0".repeat(64)}` },
      ]),
    ).toThrow("B05_DRAFT_HASH_LIFECYCLE_MISMATCH");
  });

  it("accepts only correctly recomputed hashes for published canonical campaigns", () => {
    const canonicalDefinition = {
      version: "2.0",
      strategy: { objective: "AWARENESS" },
    };
    const valid = {
      id: "published",
      status: "PUBLISHED" as const,
      canonicalDefinition,
      canonicalDefinitionHash:
        hashCanonicalCampaignDefinition(canonicalDefinition),
    };

    expect(() => assertPublishedCanonicalHashes([valid])).not.toThrow();
    expect(() =>
      assertPublishedCanonicalHashes([
        { ...valid, canonicalDefinitionHash: null },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_INVALID");
    expect(() =>
      assertPublishedCanonicalHashes([
        { ...valid, canonicalDefinitionHash: "sha256:invalid" },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_INVALID");
    expect(() =>
      assertPublishedCanonicalHashes([
        {
          ...valid,
          canonicalDefinitionHash: `sha256:${"0".repeat(64)}`,
        },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_MISMATCH");
  });
});

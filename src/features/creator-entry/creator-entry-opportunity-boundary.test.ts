import "reflect-metadata";
import type { CreatorSocialIntegration } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { evaluateInstagramOpportunity } from "../../shared/creator/instagram-opportunity-capability";
import { CreatorEntryStateService } from "./creator-entry-state.service";

describe("C01 entry and C03 Opportunity consumer boundaries", () => {
  const now = new Date();
  const healthy = {
    nativePlatformUserId: "persisted-native-id",
    tokenStateCondition: "ACTIVE",
    tokenExpiresAt: new Date(now.getTime() + 3600000),
    disconnectedAt: null,
    authorizationHealth: "USABLE",
    basicAuthorizationCapability: "AVAILABLE",
    insightsCapability: "AVAILABLE",
  } as CreatorSocialIntegration;
  it.each([
    {
      name: "healthy",
      patch: {},
      c01: true,
      c03: true,
      identity: "CONNECTED",
      action: "CREATOR_WORKSPACE_ENTRY",
    },
    {
      name: "expired token state",
      patch: { tokenStateCondition: "EXPIRED" },
      c01: true,
      c03: false,
      identity: "CONNECTED",
      action: "CREATOR_WORKSPACE_ENTRY",
    },
    {
      name: "expired timestamp",
      patch: { tokenExpiresAt: new Date(0) },
      c01: true,
      c03: false,
      identity: "CONNECTED",
      action: "CREATOR_WORKSPACE_ENTRY",
    },
    {
      name: "disconnected",
      patch: { disconnectedAt: now },
      c01: false,
      c03: false,
      identity: "DISCONNECTED",
      action: "RECONNECT_INSTAGRAM",
    },
    {
      name: "missing identity",
      patch: { nativePlatformUserId: "" },
      c01: false,
      c03: false,
      identity: "NOT_CONNECTED",
      action: "CONNECT_INSTAGRAM",
    },
    {
      name: "Basic unavailable",
      patch: { basicAuthorizationCapability: "UNAVAILABLE" },
      c01: false,
      c03: false,
      identity: "CONNECTED",
      action: "RECONNECT_INSTAGRAM",
    },
    {
      name: "health unknown",
      patch: { authorizationHealth: "UNKNOWN" },
      c01: false,
      c03: false,
      identity: "CONNECTED",
      action: "REVALIDATE_INSTAGRAM",
    },
    {
      name: "Insights unavailable only",
      patch: { insightsCapability: "UNAVAILABLE" },
      c01: true,
      c03: true,
      identity: "CONNECTED",
      action: "CREATOR_WORKSPACE_ENTRY",
    },
  ])("$name", async ({ patch, c01, c03, identity, action }) => {
    const integration = { ...healthy, ...patch } as CreatorSocialIntegration;
    const findUnique = vi.fn().mockResolvedValue({
      id: "owner",
      role: "CREATOR",
      authState: "ACTIVE",
      organizationId: "org",
      organization: { kind: "CREATOR" },
      creatorProfile: {
        id: "profile",
        ownedWorkspaces: [
          {
            organizationId: "org",
            members: [{ assignedProfileId: "profile" }],
          },
        ],
        socialIntegrations: [integration],
      },
    });
    const result = await new CreatorEntryStateService({
      user: { findUnique },
    } as unknown as PrismaService).readCanonicalOwner("owner");
    expect(result.canEnterCreatorPlatform).toBe(c01);
    expect(result.onboardingStatus).toBe(c01 ? "COMPLETE" : "INCOMPLETE");
    expect(result.nextAction).toBe(action);
    expect(result.instagram.identityConnection).toBe(identity);
    expect(
      evaluateInstagramOpportunity(integration, now).usableForOpportunity,
    ).toBe(c03);
    expect(findUnique).toHaveBeenCalledOnce();
  });
});

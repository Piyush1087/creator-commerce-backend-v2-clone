import {
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
  SocialNetworkProvider,
  UserRole,
  type CreatorSocialIntegration,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../../shared/crypto/field-encryption.util";
import type { CreatorWorkspaceActorContext } from "../../../shared/creator/creator-workspace-actor.contract";
import type { AuthUser } from "../../auth/types/auth-user";
import {
  InstagramGraphClient,
  InstagramProviderRequestError,
  type InstagramMeProfile,
} from "../../instagram/instagram-graph.client";
import type { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import type { CreatorInstagramOAuthTransactionService } from "../../provider-oauth/creator-instagram-oauth-transaction.service";
import type { CreatorInstagramSettingsActorPort } from "./creator-instagram-settings-actor.port";
import { CreatorInstagramSettingsService } from "./creator-instagram-settings.service";

const REDIRECT_URI =
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback";
const BASIC = "instagram_business_basic";
const INSIGHTS = "instagram_business_manage_insights";

const user: AuthUser = {
  id: "actor-user",
  email: "manager@example.test",
  name: "Manager",
  role: UserRole.CREATOR,
  organizationId: "organization-1",
};

function actor(
  role: CreatorWorkspaceActorContext["actorRole"] = "MANAGER",
): CreatorWorkspaceActorContext {
  const allowedActions =
    role === "ASSISTANT"
      ? ([] as const)
      : (["INSTAGRAM_SETTINGS_READ", "INSTAGRAM_SETTINGS_MANAGE"] as const);
  return {
    actorUserId: user.id,
    actorMembershipId: "membership-1",
    actorRole: role,
    workspaceId: "workspace-1",
    organizationId: "organization-1",
    subjectCreatorProfileId: "subject-profile-1",
    subjectOwnerUserId: "owner-user-1",
    allowedActions,
  };
}

function integration(
  overrides: Partial<CreatorSocialIntegration> = {},
): CreatorSocialIntegration {
  const now = new Date("2026-09-01T10:00:00.000Z");
  return {
    id: "integration-1",
    creatorProfileId: "subject-profile-1",
    platformNetwork: SocialNetworkProvider.INSTAGRAM,
    nativePlatformUserId: "permanent-provider-user-1",
    channelHandleString: "original_handle",
    channelDisplayTitle: "Original Name",
    verifiedAvatarUrl: "https://cdn.example.test/avatar.jpg",
    oauthAccessTokenEncrypted: encryptField("existing-secret-token"),
    oauthRefreshTokenEncrypted: null,
    tokenScopePermissions: [BASIC, INSIGHTS],
    tokenStateCondition: OAuthTokenStatus.ACTIVE,
    tokenExpiresAt: new Date("2026-12-01T10:00:00.000Z"),
    tokenIssuedAt: now,
    tokenRefreshedAt: null,
    authorizationGeneration: 4,
    credentialVersion: 3,
    authorizationHealth: ProviderAuthorizationHealth.USABLE,
    authorizationHealthReasonCode: null,
    basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
    insightsCapability: ProviderCapabilityState.AVAILABLE,
    lastAuthorizationValidatedAt: now,
    disconnectedAt: null,
    lastMetadataSyncAt: now,
    professionalAccountType: InstagramProfessionalAccountType.CREATOR,
    mediaCountCache: 42,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function providerProfile(
  providerUserId = "permanent-provider-user-1",
  username = "refreshed_handle",
): InstagramMeProfile {
  return {
    userId: providerUserId,
    appScopedUserId: "app-scoped-1",
    username,
    name: "Refreshed Name",
    accountType: InstagramProfessionalAccountType.CREATOR,
    profilePictureUrl: "https://cdn.example.test/refreshed.jpg",
    followersCount: 10,
    followsCount: 5,
    mediaCount: 50,
  };
}

describe("Creator Instagram Settings facade", () => {
  let row: CreatorSocialIntegration | null;
  let currentActor: CreatorWorkspaceActorContext;
  let service: CreatorInstagramSettingsService;
  let updateMany: ReturnType<typeof vi.fn>;
  let resolveActor: ReturnType<typeof vi.fn>;
  let issue: ReturnType<typeof vi.fn>;
  let consume: ReturnType<typeof vi.fn>;
  let exchange: ReturnType<typeof vi.fn>;
  let fetchMe: ReturnType<typeof vi.fn>;
  let fetchPermissions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("CREATOR_INSTAGRAM_REDIRECT_URI", REDIRECT_URI);
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "c05-p1c-field-key");
    vi.stubEnv("INSTAGRAM_API_ID", "test-instagram-app-id");
    row = integration();
    currentActor = actor();

    updateMany = vi.fn(async (args: unknown) => {
      if (!row || typeof args !== "object" || args === null)
        return { count: 0 };
      const data = (args as { data?: Record<string, unknown> }).data ?? {};
      const next = { ...row } as CreatorSocialIntegration;
      for (const [key, value] of Object.entries(data)) {
        if (
          typeof value === "object" &&
          value !== null &&
          "increment" in value &&
          typeof (value as { increment?: unknown }).increment === "number"
        ) {
          const existing = next[key as keyof CreatorSocialIntegration];
          if (typeof existing === "number") {
            Object.assign(next, {
              [key]: existing + (value as { increment: number }).increment,
            });
          }
        } else {
          Object.assign(next, { [key]: value });
        }
      }
      row = next;
      return { count: 1 };
    });

    const prisma = {
      creatorSocialIntegration: {
        findUnique: vi.fn(async () => row),
        updateMany,
      },
    } as unknown as PrismaService;
    resolveActor = vi.fn(async () => currentActor);
    const actors = {
      resolve: resolveActor,
    } satisfies CreatorInstagramSettingsActorPort;

    issue = vi.fn(async () => "a".repeat(43));
    consume = vi.fn(async () => ({
      provider: ProviderOAuthProvider.INSTAGRAM,
      subjectType: ProviderOAuthSubjectType.CREATOR,
      creatorProfileId: "subject-profile-1",
      initiatedByUserId: user.id,
      redirectUri: REDIRECT_URI,
      intent: InstagramOAuthIntent.RECONNECT,
      expectedGeneration: 4,
      expectedProviderAccountId: "permanent-provider-user-1",
    }));
    const transactions = {
      issue,
      consume,
    } as unknown as CreatorInstagramOAuthTransactionService;

    exchange = vi.fn(async () => ({
      accessToken: "new-long-lived-token",
      expiresInSeconds: 3_600,
      permissions: [BASIC, INSIGHTS],
    }));
    const oauth = {
      buildAuthorizeUrl: vi.fn(
        (_redirectUri: string, state: string) =>
          `https://www.instagram.com/oauth/authorize?state=${state}`,
      ),
      exchangeAuthorizationCode: exchange,
    } as unknown as InstagramOAuthClient;

    fetchMe = vi.fn(async () => providerProfile());
    fetchPermissions = vi.fn(async () => [BASIC, INSIGHTS]);
    const graph = {
      fetchMe,
      fetchGrantedPermissions: fetchPermissions,
    } as unknown as InstagramGraphClient;

    service = new CreatorInstagramSettingsService(
      prisma,
      actors,
      transactions,
      oauth,
      graph,
    );
  });

  it("projects only the canonical Instagram provider without secrets or stable IDs", async () => {
    const result = await service.read(user);
    expect(result).toMatchObject({
      platform: "INSTAGRAM",
      lifecycleState: "CONNECTED_HEALTHY",
      identity: { retained: true, handle: "original_handle" },
      recovery: {
        settingsAvailable: true,
        permanentIdentityRequired: true,
        differentAccountRequiresManualReview: true,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("permanent-provider-user-1");
    expect(serialized).not.toContain("existing-secret-token");
    expect(serialized).not.toMatch(/TIKTOK|YOUTUBE|MARKETPLACE/i);
  });

  it("projects NOT_CONNECTED to the accepted C01 initial-connect path for Owner and Manager", async () => {
    row = null;
    currentActor = actor("OWNER");
    await expect(service.read(user)).resolves.toMatchObject({
      lifecycleState: "NOT_CONNECTED",
      identity: { retained: false },
      allowedActions: {
        initialConnect: true,
        sameIdReconnect: false,
      },
    });

    currentActor = actor("MANAGER");
    await expect(service.read(user)).resolves.toMatchObject({
      lifecycleState: "NOT_CONNECTED",
      allowedActions: { initialConnect: true, sameIdReconnect: false },
    });
    expect(issue).not.toHaveBeenCalled();
  });

  it.each([
    [
      "RECONNECT_REQUIRED",
      {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      },
    ],
    [
      "PROVIDER_BLOCKED_RECOVERABLE",
      {
        authorizationHealth:
          ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
      },
    ],
    [
      "DISCONNECTED_IDENTITY_RETAINED",
      {
        authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
        tokenStateCondition: OAuthTokenStatus.REVOKED,
        disconnectedAt: new Date("2026-09-01T11:00:00.000Z"),
      },
    ],
    [
      "REVALIDATION_REQUIRED",
      { authorizationHealth: ProviderAuthorizationHealth.UNKNOWN },
    ],
  ] as const)("projects truthful %s recovery state", async (state, changes) => {
    row = integration(changes);
    await expect(service.read(user)).resolves.toMatchObject({
      lifecycleState: state,
    });
  });

  it("denies an Assistant even when calling the read facade", async () => {
    currentActor = actor("ASSISTANT");
    await expect(service.read(user)).rejects.toMatchObject({ status: 403 });
    await expect(service.disconnect(user)).rejects.toMatchObject({
      status: 403,
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "MANAGER"] as const)(
    "binds %s reconnect state to actor, subject, generation, and permanent identity",
    async (role) => {
      currentActor = actor(role);
      row = integration({
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      await expect(service.authorizeReconnect(user)).resolves.toMatchObject({
        flow: "SAME_ID_RECONNECT",
      });
      expect(issue).toHaveBeenCalledWith({
        creatorProfileId: "subject-profile-1",
        initiatedByUserId: user.id,
        redirectUri: REDIRECT_URI,
        intent: InstagramOAuthIntent.RECONNECT,
        expectedGeneration: 4,
        expectedProviderAccountId: "permanent-provider-user-1",
      });
    },
  );

  it("disconnects while retaining the permanent identity and encrypted credential fence", async () => {
    const stableId = row!.nativePlatformUserId;
    const encrypted = row!.oauthAccessTokenEncrypted;
    await expect(service.disconnect(user)).resolves.toMatchObject({
      disconnected: true,
      settings: { lifecycleState: "DISCONNECTED_IDENTITY_RETAINED" },
    });
    expect(row).toMatchObject({
      nativePlatformUserId: stableId,
      oauthAccessTokenEncrypted: encrypted,
      tokenStateCondition: OAuthTokenStatus.REVOKED,
      authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
      authorizationGeneration: 5,
      credentialVersion: 4,
    });
  });

  it("revalidates the same stable identity and refreshes username metadata", async () => {
    fetchMe.mockResolvedValue(providerProfile(undefined, "renamed_creator"));
    await expect(service.revalidate(user)).resolves.toMatchObject({
      revalidated: true,
      settings: {
        lifecycleState: "CONNECTED_HEALTHY",
        identity: { handle: "renamed_creator" },
      },
    });
    expect(row).toMatchObject({
      nativePlatformUserId: "permanent-provider-user-1",
      channelHandleString: "renamed_creator",
      authorizationHealth: ProviderAuthorizationHealth.USABLE,
    });
  });

  it("blocks a different identity during revalidation without mutating the binding", async () => {
    const before = row;
    fetchMe.mockResolvedValue(providerProfile("different-provider-user"));
    await expect(service.revalidate(user)).rejects.toMatchObject({
      response: {
        code: "INSTAGRAM_DIFFERENT_ACCOUNT_BLOCKED",
        manualReviewRequired: true,
      },
    });
    expect(row).toEqual(before);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("promotes a same-ID reconnect, refreshes username, and encrypts the new token", async () => {
    row = integration({
      authorizationHealth: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
    });
    fetchMe.mockResolvedValue(providerProfile(undefined, "same_id_renamed"));
    await expect(
      service.completeReconnect(user, {
        state: "a".repeat(43),
        code: "provider-code",
      }),
    ).resolves.toMatchObject({ connected: true });
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorProfileId: "subject-profile-1",
        initiatedByUserId: user.id,
        intent: InstagramOAuthIntent.RECONNECT,
      }),
      "a".repeat(43),
    );
    expect(row).toMatchObject({
      nativePlatformUserId: "permanent-provider-user-1",
      channelHandleString: "same_id_renamed",
      authorizationGeneration: 5,
      credentialVersion: 4,
      disconnectedAt: null,
    });
    expect(row!.oauthAccessTokenEncrypted).not.toContain(
      "new-long-lived-token",
    );
    expect(decryptField(row!.oauthAccessTokenEncrypted)).toBe(
      "new-long-lived-token",
    );
  });

  it("blocks a different reconnect identity and never promotes its credential", async () => {
    row = integration({
      authorizationHealth: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
    });
    const before = row.oauthAccessTokenEncrypted;
    fetchMe.mockResolvedValue(providerProfile("different-provider-user"));
    await expect(
      service.completeReconnect(user, {
        state: "a".repeat(43),
        code: "provider-code",
      }),
    ).rejects.toMatchObject({
      response: {
        code: "INSTAGRAM_DIFFERENT_ACCOUNT_BLOCKED",
        lifecycleState: "DIFFERENT_ACCOUNT_BLOCKED",
        manualReviewRequired: true,
      },
    });
    expect(row.oauthAccessTokenEncrypted).toBe(before);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("projects provider access failures as recoverable instead of healthy", async () => {
    fetchMe.mockRejectedValue(
      new InstagramProviderRequestError(
        "provider blocked",
        "PROVIDER_ACCESS_BLOCKED",
      ),
    );
    await expect(service.revalidate(user)).resolves.toMatchObject({
      revalidated: false,
      settings: { lifecycleState: "PROVIDER_BLOCKED_RECOVERABLE" },
    });
    expect(row).toMatchObject({
      authorizationHealth: ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
      authorizationHealthReasonCode: "INSTAGRAM_PROVIDER_ACCESS_BLOCKED",
    });
  });

  it("fails closed when role or actor/subject context changes before promotion", async () => {
    row = integration({
      authorizationHealth: ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
    });
    resolveActor
      .mockResolvedValueOnce(actor("MANAGER"))
      .mockResolvedValueOnce({ ...actor("MANAGER"), workspaceId: "moved" });
    await expect(
      service.completeReconnect(user, {
        state: "a".repeat(43),
        code: "provider-code",
      }),
    ).rejects.toMatchObject({
      response: { code: "INSTAGRAM_AUTHORIZATION_STALE" },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

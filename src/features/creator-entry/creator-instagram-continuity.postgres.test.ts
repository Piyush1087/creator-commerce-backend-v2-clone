import "reflect-metadata";

import {
  CreatorTeamRole,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  OrganizationKind,
  Prisma,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  UserAuthState,
  UserRole,
  type User,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PrismaService } from "../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../shared/crypto/field-encryption.util";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
  type InstagramMeProfile,
} from "../instagram/instagram-graph.client";
import {
  InstagramOAuthClient,
  InstagramTokenRefreshError,
} from "../instagram/instagram-oauth.client";
import { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
import { ProviderOAuthTransactionService } from "../provider-oauth/provider-oauth-transaction.service";
import { CreatorSettingsService } from "../creator-settings/services/creator-settings.service";
import { CreatorCanonicalContextService } from "./creator-canonical-context.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorInstagramContinuityService } from "./creator-instagram-continuity.service";
import {
  CREATOR_INSTAGRAM_REFRESH_MIN_AGE_MS,
  CREATOR_INSTAGRAM_REFRESH_WINDOW_MS,
  CreatorInstagramTokenRefreshService,
} from "./creator-instagram-token-refresh.service";

const databaseUrl = process.env.C01_I4_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

const BASIC = "instagram_business_basic";
const INSIGHTS = "instagram_business_manage_insights";
const REDIRECT_URI =
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback";
const DAY = 24 * 60 * 60 * 1000;

database("C01-I4 Instagram continuity and recovery", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
  const db = prisma as unknown as PrismaService;
  const oauth = new InstagramOAuthClient();
  const graph = new InstagramGraphClient();
  const contexts = new CreatorCanonicalContextService(db);
  const state = new CreatorEntryStateService(db);
  const transactions = new CreatorInstagramOAuthTransactionService(
    new ProviderOAuthTransactionService(db),
  );
  const continuity = new CreatorInstagramContinuityService(
    db,
    transactions,
    oauth,
    graph,
    state,
    contexts,
  );
  const refreshService = new CreatorInstagramTokenRefreshService(db, oauth);
  const exchange = vi.spyOn(oauth, "exchangeAuthorizationCode");
  const refresh = vi.spyOn(oauth, "refreshLongLivedToken");
  const fetchMe = vi.spyOn(graph, "fetchMe");
  const fetchPermissions = vi.spyOn(graph, "fetchGrantedPermissions");

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/c01_i4_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error("C01_I4_TEST_REQUIRES_DISPOSABLE_DATABASE");
    }
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.providerOAuthTransaction.deleteMany();
    await prisma.creatorSocialIntegration.deleteMany();
    await prisma.creatorWorkspaceMember.deleteMany();
    await prisma.creatorWorkspace.deleteMany();
    await prisma.creatorProfile.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@c01-i4.example.test" } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: "I4 Creator " } },
    });

    vi.stubEnv("INSTAGRAM_API_ID", "1180027506417007");
    vi.stubEnv("CREATOR_INSTAGRAM_REDIRECT_URI", REDIRECT_URI);
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "c01-i4-test-field-key");
    exchange.mockReset().mockResolvedValue({
      accessToken: "c01-i4-new-long-lived-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
      permissions: [BASIC, INSIGHTS],
    });
    refresh.mockReset().mockResolvedValue({
      accessToken: "c01-i4-refreshed-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
    });
    fetchMe.mockReset();
    fetchPermissions.mockReset().mockResolvedValue([BASIC, INSIGHTS]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  async function canonicalCreator() {
    const suffix = randomUUID();
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `I4 Creator ${suffix}`,
          kind: OrganizationKind.CREATOR,
        },
      });
      const email = `${suffix}@c01-i4.example.test`;
      const user = await tx.user.create({
        data: {
          email,
          normalizedEmail: email,
          name: "I4 Creator",
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: organization.id,
        },
      });
      const profile = await tx.creatorProfile.create({
        data: { userId: user.id, displayName: "I4 Creator" },
      });
      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: profile.id,
          organizationId: organization.id,
          organizationDisplayName: "I4 Creator Studio",
        },
      });
      await tx.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: profile.id,
          associatedEmail: email,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });
      return { organization, user, profile, workspace };
    });
  }

  async function integration(
    creator: Awaited<ReturnType<typeof canonicalCreator>>,
    overrides: Partial<Prisma.CreatorSocialIntegrationUncheckedCreateInput> = {},
  ) {
    const now = Date.now();
    return prisma.creatorSocialIntegration.create({
      data: {
        creatorProfileId: creator.profile.id,
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: `ig-${randomUUID()}`,
        channelHandleString: `creator_${randomUUID()}`,
        oauthAccessTokenEncrypted: encryptField("c01-i4-current-token"),
        tokenScopePermissions: [BASIC, INSIGHTS],
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        tokenExpiresAt: new Date(now + 60 * DAY),
        tokenIssuedAt: new Date(now - 2 * DAY),
        authorizationGeneration: 4,
        credentialVersion: 3,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
        basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
        insightsCapability: ProviderCapabilityState.AVAILABLE,
        professionalAccountType: InstagramProfessionalAccountType.BUSINESS,
        ...overrides,
      },
    });
  }

  function authUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  function me(
    userId: string,
    username = `creator_${randomUUID()}`,
    accountType = InstagramProfessionalAccountType.BUSINESS,
  ): InstagramMeProfile {
    return {
      userId,
      appScopedUserId: `app-${randomUUID()}`,
      username,
      name: "I4 Professional Creator",
      accountType,
      profilePictureUrl: "https://images.example.test/i4.jpg",
      followersCount: 10,
      followsCount: 2,
      mediaCount: 7,
    };
  }

  async function reconnectState(user: User) {
    const result = await continuity.authorizeReconnect(authUser(user));
    const stateValue = new URL(result.authorizationUrl).searchParams.get(
      "state",
    );
    if (!stateValue) throw new Error("Missing reconnect state");
    return stateValue;
  }

  async function disconnect(
    creator: Awaited<ReturnType<typeof canonicalCreator>>,
  ) {
    const access = {
      resolveCreatorProfile: vi.fn().mockResolvedValue(creator.profile),
      resolveWorkspace: vi.fn().mockResolvedValue(creator.workspace),
      resolveWorkspaceRole: vi.fn().mockResolvedValue(CreatorTeamRole.OWNER),
      isAssistantReadOnly: vi.fn().mockReturnValue(false),
    };
    const settings = new CreatorSettingsService(
      db,
      access as never,
      {} as never,
    );
    return settings.disconnectSocialIntegration(
      authUser(creator.user),
      SocialNetworkProvider.INSTAGRAM,
    );
  }

  describe("revalidation", () => {
    it("restores USABLE entry for the same Professional Basic identity", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
      });
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      fetchPermissions.mockResolvedValue([BASIC]);

      await expect(
        continuity.revalidate(authUser(creator.user)),
      ).resolves.toMatchObject({
        revalidated: true,
        state: {
          onboardingStatus: "COMPLETE",
          canEnterCreatorPlatform: true,
          instagram: {
            insightsCapability: ProviderCapabilityState.UNAVAILABLE,
          },
        },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        authorizationGeneration: row.authorizationGeneration,
        credentialVersion: row.credentialVersion,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
        basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
      });
    });

    it("updates username metadata without changing identity or credential fences", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(
        me(row.nativePlatformUserId, "renamed_creator"),
      );

      await continuity.revalidate(authUser(creator.user));
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        channelHandleString: "renamed_creator",
        authorizationGeneration: row.authorizationGeneration,
        credentialVersion: row.credentialVersion,
      });
    });

    it("rejects a different stable identity without any mutation", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(me("different-provider-id"));

      await expect(
        continuity.revalidate(authUser(creator.user)),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_IDENTITY_CONFLICT" },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
    });

    it("retains stable identity but requires reauthorization for Personal", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(
        me(
          row.nativePlatformUserId,
          "personal_creator",
          InstagramProfessionalAccountType.PERSONAL,
        ),
      );

      await continuity.revalidate(authUser(creator.user));
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
    });

    it("requires reauthorization when Basic is absent", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      fetchPermissions.mockResolvedValue([INSIGHTS]);
      await continuity.revalidate(authUser(creator.user));
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.AVAILABLE,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
    });

    it("keeps entry usable when Insights are absent", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      fetchPermissions.mockResolvedValue([BASIC]);
      const result = await continuity.revalidate(authUser(creator.user));
      expect(result.state).toMatchObject({
        canEnterCreatorPlatform: true,
        nextAction: "CREATOR_WORKSPACE_ENTRY",
        instagram: { insightsCapability: ProviderCapabilityState.UNAVAILABLE },
      });
    });

    it("does not force reconnect when permission evidence is transient", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      fetchPermissions.mockRejectedValue(
        new InstagramPermissionEvidenceError("TRANSIENT"),
      );
      const result = await continuity.revalidate(authUser(creator.user));
      expect(result.state).toMatchObject({
        canEnterCreatorPlatform: true,
        instagram: {
          basicAuthorization: ProviderCapabilityState.AVAILABLE,
          insightsCapability: ProviderCapabilityState.UNKNOWN,
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
        },
      });
    });

    it("persists provider blocking without erasing identity", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockRejectedValue(
        new InstagramProviderRequestError("blocked", "PROVIDER_ACCESS_BLOCKED"),
      );
      const result = await continuity.revalidate(authUser(creator.user));
      expect(result.state).toMatchObject({
        canEnterCreatorPlatform: false,
        nextAction: "REVALIDATE_INSTAGRAM",
        instagram: {
          identityConnection: "CONNECTED",
          authorizationHealth:
            ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
        },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({ nativePlatformUserId: row.nativePlatformUserId });
    });

    it("persists deterministic authorization loss from the current credential", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockRejectedValue(
        new InstagramProviderRequestError(
          "authorization lost",
          "AUTHORIZATION_REVALIDATION_REQUIRED",
        ),
      );
      const result = await continuity.revalidate(authUser(creator.user));
      expect(result.state).toMatchObject({
        canEnterCreatorPlatform: false,
        nextAction: "RECONNECT_INSTAGRAM",
        instagram: {
          identityConnection: "CONNECTED",
          basicAuthorization: ProviderCapabilityState.UNAVAILABLE,
          authorizationHealth:
            ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({ nativePlatformUserId: row.nativePlatformUserId });
    });

    it("preserves usable state on transient provider failure", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator);
      fetchMe.mockRejectedValue(
        new InstagramProviderRequestError("retry", "TRANSIENT"),
      );
      await expect(
        continuity.revalidate(authUser(creator.user)),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_PROVIDER_RETRY_REQUIRED" },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
    });

    it("marks an expired token without provider I/O or identity loss", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        tokenExpiresAt: new Date(Date.now() - 1000),
      });
      const result = await continuity.revalidate(authUser(creator.user));
      expect(fetchMe).not.toHaveBeenCalled();
      expect(result.state).toMatchObject({
        canEnterCreatorPlatform: false,
        nextAction: "RECONNECT_INSTAGRAM",
        instagram: { identityConnection: "CONNECTED" },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        tokenStateCondition: OAuthTokenStatus.EXPIRED,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        authorizationHealthReasonCode: "TOKEN_EXPIRED",
        nativePlatformUserId: row.nativePlatformUserId,
      });
    });
  });

  describe("scheduled refresh", () => {
    it("refreshes a due valid credential with only credential-version change", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenIssuedAt: new Date(now.getTime() - 2 * DAY),
        tokenExpiresAt: new Date(
          now.getTime() + CREATOR_INSTAGRAM_REFRESH_WINDOW_MS - 1000,
        ),
      });
      const result = await refreshService.refreshDueTokens(now);
      expect(result.refreshed).toBe(1);
      const after = await prisma.creatorSocialIntegration.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(decryptField(after.oauthAccessTokenEncrypted)).toBe(
        "c01-i4-refreshed-token",
      );
      expect(after.credentialVersion).toBe(row.credentialVersion + 1);
      expect(after.authorizationGeneration).toBe(row.authorizationGeneration);
    });

    it("does not refresh a credential younger than 24 hours", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenIssuedAt: new Date(
          now.getTime() - CREATOR_INSTAGRAM_REFRESH_MIN_AGE_MS + 1000,
        ),
        tokenExpiresAt: new Date(now.getTime() + DAY),
      });
      await refreshService.refreshDueTokens(now);
      expect(refresh).not.toHaveBeenCalled();
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
    });

    it("does not refresh outside the bounded refresh window", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenIssuedAt: new Date(now.getTime() - 2 * DAY),
        tokenExpiresAt: new Date(
          now.getTime() + CREATOR_INSTAGRAM_REFRESH_WINDOW_MS + 1000,
        ),
      });
      await refreshService.refreshDueTokens(now);
      expect(refresh).not.toHaveBeenCalled();
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
    });

    it("marks expired credentials without attempting refresh", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenExpiresAt: new Date(now.getTime() - 1),
      });
      const result = await refreshService.refreshDueTokens(now);
      expect(result.expired).toBe(1);
      expect(refresh).not.toHaveBeenCalled();
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        tokenStateCondition: OAuthTokenStatus.EXPIRED,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
    });

    it("preserves the current credential on transient refresh failure", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenExpiresAt: new Date(now.getTime() + DAY),
      });
      refresh.mockRejectedValue(new InstagramTokenRefreshError("TRANSIENT"));
      const result = await refreshService.refreshDueTokens(now);
      expect(result.retryableFailures).toBe(1);
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
      await prisma.creatorSocialIntegration.update({
        where: { id: row.id },
        data: { tokenExpiresAt: new Date(now.getTime() + 60 * DAY) },
      });
    });

    it("persists authorization loss while retaining stable identity", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenExpiresAt: new Date(now.getTime() + DAY),
      });
      refresh.mockRejectedValue(
        new InstagramTokenRefreshError("AUTHORIZATION_REVALIDATION_REQUIRED"),
      );
      const result = await refreshService.refreshDueTokens(now);
      expect(result.reauthorizationRequired).toBe(1);
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      await prisma.creatorSocialIntegration.update({
        where: { id: row.id },
        data: { tokenExpiresAt: new Date(now.getTime() + 60 * DAY) },
      });
    });

    it("persists provider block without changing capability evidence", async () => {
      const creator = await canonicalCreator();
      const now = new Date();
      const row = await integration(creator, {
        tokenExpiresAt: new Date(now.getTime() + DAY),
      });
      refresh.mockRejectedValue(
        new InstagramTokenRefreshError("PROVIDER_ACCESS_BLOCKED"),
      );
      const result = await refreshService.refreshDueTokens(now);
      expect(result.providerBlocked).toBe(1);
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        basicAuthorizationCapability: row.basicAuthorizationCapability,
        insightsCapability: row.insightsCapability,
        authorizationHealth:
          ProviderAuthorizationHealth.PROVIDER_ACCESS_BLOCKED,
      });
      await prisma.creatorSocialIntegration.update({
        where: { id: row.id },
        data: { tokenExpiresAt: new Date(now.getTime() + 60 * DAY) },
      });
    });

    it("continues the bounded batch when one candidate fails", async () => {
      const firstCreator = await canonicalCreator();
      const secondCreator = await canonicalCreator();
      const now = new Date();
      const first = await integration(firstCreator, {
        tokenExpiresAt: new Date(now.getTime() + DAY),
      });
      const second = await integration(secondCreator, {
        tokenExpiresAt: new Date(now.getTime() + DAY + 1000),
      });
      refresh
        .mockRejectedValueOnce(new InstagramTokenRefreshError("TRANSIENT"))
        .mockResolvedValueOnce({
          accessToken: "second-candidate-refreshed",
          expiresInSeconds: 60 * 24 * 60 * 60,
        });
      const result = await refreshService.refreshDueTokens(now);
      expect(result).toMatchObject({ refreshed: 1, retryableFailures: 1 });
      expect(
        decryptField(
          (
            await prisma.creatorSocialIntegration.findUniqueOrThrow({
              where: { id: second.id },
            })
          ).oauthAccessTokenEncrypted,
        ),
      ).toBe("second-candidate-refreshed");
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: first.id },
        }),
      ).toEqual(first);
    });
  });

  describe("same-identity reconnect and disconnect fencing", () => {
    it("requires an existing stable identity to authorize reconnect", async () => {
      const creator = await canonicalCreator();
      await expect(
        continuity.authorizeReconnect(authUser(creator.user)),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_NOT_CONNECTED" },
      });
    });

    it("binds reconnect state to current generation and provider identity", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const stateValue = await reconnectState(creator.user);
      const attempt = await prisma.providerOAuthTransaction.findFirstOrThrow({
        where: { initiatedByUserId: creator.user.id, consumedAt: null },
      });
      expect(stateValue).toHaveLength(43);
      expect(attempt).toMatchObject({
        intent: "RECONNECT",
        expectedGeneration: row.authorizationGeneration,
        expectedProviderAccountId: row.nativePlatformUserId,
        redirectUri: REDIRECT_URI,
      });
    });

    it("consumes reconnect denial exactly once without provider I/O", async () => {
      const creator = await canonicalCreator();
      await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const stateValue = await reconnectState(creator.user);
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stateValue,
          error: "access_denied",
        }),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_AUTHORIZATION_DENIED" },
      });
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stateValue,
          code: "replay",
        }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
      });
      expect(exchange).not.toHaveBeenCalled();
    });

    it("promotes a new credential only for the same stable identity", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
      });
      const stateValue = await reconnectState(creator.user);
      fetchMe.mockResolvedValue(
        me(row.nativePlatformUserId, "same_id_renamed"),
      );
      fetchPermissions.mockResolvedValue([BASIC]);
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stateValue,
          code: "same-id-code",
        }),
      ).resolves.toMatchObject({
        connected: true,
        state: { canEnterCreatorPlatform: true },
      });
      const after = await prisma.creatorSocialIntegration.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(after).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        channelHandleString: "same_id_renamed",
        authorizationGeneration: row.authorizationGeneration + 1,
        credentialVersion: row.credentialVersion + 1,
        disconnectedAt: null,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
      });
      expect(decryptField(after.oauthAccessTokenEncrypted)).toBe(
        "c01-i4-new-long-lived-token",
      );
    });

    it("rejects different provider identity without credential promotion", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const stateValue = await reconnectState(creator.user);
      fetchMe.mockResolvedValue(me("different-provider-id"));
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stateValue,
          code: "different-id-code",
        }),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_IDENTITY_CONFLICT" },
      });
      expect(
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toEqual(row);
    });

    it("fences an older state after another reconnect wins", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const first = await reconnectState(creator.user);
      const stale = await reconnectState(creator.user);
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      await continuity.completeReconnect(authUser(creator.user), {
        state: first,
        code: "winner",
      });
      exchange.mockClear();
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stale,
          code: "stale",
        }),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_AUTHORIZATION_STALE" },
      });
      expect(exchange).not.toHaveBeenCalled();
    });

    it("allows exactly one reconnect winner for one generation", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const first = await reconnectState(creator.user);
      const second = await reconnectState(creator.user);
      fetchMe.mockResolvedValue(me(row.nativePlatformUserId));
      const results = await Promise.allSettled([
        continuity.completeReconnect(authUser(creator.user), {
          state: first,
          code: "race-one",
        }),
        continuity.completeReconnect(authUser(creator.user), {
          state: second,
          code: "race-two",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        (
          await prisma.creatorSocialIntegration.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).authorizationGeneration,
      ).toBe(row.authorizationGeneration + 1);
    });

    it("explicit disconnect retains identity/ciphertext and fences old OAuth state", async () => {
      const creator = await canonicalCreator();
      const row = await integration(creator, {
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      });
      const stale = await reconnectState(creator.user);
      await disconnect(creator);
      const afterDisconnect =
        await prisma.creatorSocialIntegration.findUniqueOrThrow({
          where: { id: row.id },
        });
      expect(afterDisconnect).toMatchObject({
        nativePlatformUserId: row.nativePlatformUserId,
        oauthAccessTokenEncrypted: row.oauthAccessTokenEncrypted,
        tokenStateCondition: OAuthTokenStatus.REVOKED,
        authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        authorizationGeneration: row.authorizationGeneration + 1,
        credentialVersion: row.credentialVersion + 1,
      });
      expect(await state.read(authUser(creator.user))).toMatchObject({
        accountContext: "CREATOR_READY",
        canEnterCreatorPlatform: false,
        nextAction: "RECONNECT_INSTAGRAM",
        instagram: { identityConnection: "DISCONNECTED" },
      });
      await expect(
        continuity.completeReconnect(authUser(creator.user), {
          state: stale,
          code: "pre-disconnect",
        }),
      ).rejects.toMatchObject({
        response: { code: "INSTAGRAM_AUTHORIZATION_STALE" },
      });
      expect(exchange).not.toHaveBeenCalled();
      expect(
        (
          await prisma.user.findUniqueOrThrow({
            where: { id: creator.user.id },
          })
        ).authState,
      ).toBe(UserAuthState.ACTIVE);
    });
  });
});

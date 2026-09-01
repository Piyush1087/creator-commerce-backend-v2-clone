import "reflect-metadata";

import { Logger } from "@nestjs/common";
import {
  CreatorTeamRole,
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  OAuthTokenStatus,
  OrganizationKind,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  ProviderOAuthProvider,
  ProviderOAuthSubjectType,
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
  InstagramOAuthExchangeError,
} from "../instagram/instagram-oauth.client";
import { CreatorInstagramOAuthTransactionService } from "../provider-oauth/creator-instagram-oauth-transaction.service";
import {
  hashProviderOAuthState,
  ProviderOAuthTransactionService,
} from "../provider-oauth/provider-oauth-transaction.service";
import { CreatorEntryStateService } from "./creator-entry-state.service";
import { CreatorInstagramConnectionService } from "./creator-instagram-connection.service";

const databaseUrl = process.env.C01_I3_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

const BASIC = "instagram_business_basic";
const INSIGHTS = "instagram_business_manage_insights";
const REDIRECT_URI =
  "https://dashboard.dev.thecreatorshop.in/creator-marketplace/callback";

database("C01-I3 Creator Instagram connection", () => {
  const prisma = new PrismaClient({
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
  const db = prisma as unknown as PrismaService;
  const providerTransactions = new ProviderOAuthTransactionService(db);
  const creatorTransactions = new CreatorInstagramOAuthTransactionService(
    providerTransactions,
  );
  const oauth = new InstagramOAuthClient();
  const graph = new InstagramGraphClient();
  const state = new CreatorEntryStateService(db);
  const connection = new CreatorInstagramConnectionService(
    db,
    creatorTransactions,
    oauth,
    graph,
    state,
  );
  const exchange = vi.spyOn(oauth, "exchangeAuthorizationCode");
  const fetchMe = vi.spyOn(graph, "fetchMe");
  const fetchPermissions = vi.spyOn(graph, "fetchGrantedPermissions");

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^\/c01_i3_[a-z0-9_]+$/.test(url.pathname)
    ) {
      throw new Error("C01_I3_TEST_REQUIRES_DISPOSABLE_DATABASE");
    }
    await prisma.$connect();
  });

  beforeEach(() => {
    vi.stubEnv("INSTAGRAM_API_ID", "1180027506417007");
    vi.stubEnv("CREATOR_INSTAGRAM_REDIRECT_URI", REDIRECT_URI);
    vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "c01-i3-test-field-key");
    exchange.mockReset().mockResolvedValue({
      accessToken: "c01-i3-long-lived-token",
      expiresInSeconds: 5_184_000,
      permissions: [BASIC, INSIGHTS],
    });
    fetchMe.mockReset().mockResolvedValue(me());
    fetchPermissions.mockReset().mockResolvedValue([BASIC, INSIGHTS]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  function email(label: string): string {
    return `${label}-${randomUUID()}@creator.example.test`;
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
    accountType = InstagramProfessionalAccountType.BUSINESS,
    userId = `ig-user-${randomUUID()}`,
    username = `creator_${randomUUID()}`,
  ): InstagramMeProfile {
    return {
      userId,
      appScopedUserId: `app-scoped-${randomUUID()}`,
      username,
      name: "I3 Professional Creator",
      accountType,
      profilePictureUrl: "https://images.example.test/creator.jpg",
      followersCount: 42,
      followsCount: 7,
      mediaCount: 11,
    };
  }

  async function canonicalCreator(label = "canonical") {
    return prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `I3 Creator ${randomUUID()}`,
          kind: OrganizationKind.CREATOR,
        },
      });
      const normalizedEmail = email(label);
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          normalizedEmail,
          name: "I3 Creator",
          role: UserRole.CREATOR,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
          organizationId: organization.id,
        },
      });
      const profile = await tx.creatorProfile.create({
        data: { userId: user.id, displayName: "I3 Creator" },
      });
      const workspace = await tx.creatorWorkspace.create({
        data: {
          ownerProfileId: profile.id,
          organizationId: organization.id,
          organizationDisplayName: "I3 Creator Studio",
        },
      });
      await tx.creatorWorkspaceMember.create({
        data: {
          workspaceId: workspace.id,
          assignedProfileId: profile.id,
          associatedEmail: normalizedEmail,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });
      return { organization, user, profile, workspace };
    });
  }

  async function brandUser() {
    const organization = await prisma.organization.create({
      data: { name: `I3 Brand ${randomUUID()}`, kind: OrganizationKind.BRAND },
    });
    const normalizedEmail = email("brand");
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        role: UserRole.BRAND,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
    return { organization, user };
  }

  async function malformedCreator() {
    const organization = await prisma.organization.create({
      data: {
        name: `I3 Malformed ${randomUUID()}`,
        kind: OrganizationKind.CREATOR,
      },
    });
    const normalizedEmail = email("malformed");
    return prisma.user.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        role: UserRole.CREATOR,
        authState: UserAuthState.ACTIVE,
        emailVerifiedAt: new Date(),
        organizationId: organization.id,
      },
    });
  }

  async function start(user: User) {
    const result = await connection.authorize(authUser(user));
    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get("state");
    if (!state) throw new Error("Missing OAuth state in authorization URL");
    return { result, url, state };
  }

  async function complete(user: User, stateValue: string) {
    return connection.complete(authUser(user), {
      state: stateValue,
      code: `code-${randomUUID()}`,
    });
  }

  it("requires canonical Creator context and issues only a server-bound digest state", async () => {
    const brand = await brandUser();
    await expect(
      connection.authorize(authUser(brand.user)),
    ).rejects.toMatchObject({ response: { code: "ACCOUNT_CONTEXT_CONFLICT" } });
    const malformed = await malformedCreator();
    await expect(
      connection.authorize(authUser(malformed)),
    ).rejects.toMatchObject({
      response: { code: "CONTEXT_RECOVERY_REQUIRED" },
    });

    const creator = await canonicalCreator("authorize");
    const issued = await start(creator.user);
    expect(issued.url.origin + issued.url.pathname).toBe(
      "https://www.instagram.com/oauth/authorize",
    );
    expect(issued.url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(issued.url.searchParams.get("scope")?.split(",")).toEqual([
      BASIC,
      INSIGHTS,
    ]);
    const transaction = await prisma.providerOAuthTransaction.findUniqueOrThrow(
      {
        where: { stateHash: hashProviderOAuthState(issued.state) },
      },
    );
    expect(transaction).toMatchObject({
      provider: ProviderOAuthProvider.INSTAGRAM,
      subjectType: ProviderOAuthSubjectType.CREATOR,
      creatorProfileId: creator.profile.id,
      brandProfileId: null,
      initiatedByUserId: creator.user.id,
      redirectUri: REDIRECT_URI,
      intent: InstagramOAuthIntent.INITIAL_CONNECT,
      expectedGeneration: 0,
      expectedProviderAccountId: null,
      consumedAt: null,
    });
    expect(transaction.stateHash).not.toContain(issued.state);
  });

  it("fails closed when redirect configuration is absent or not audited", async () => {
    const creator = await canonicalCreator("redirect");
    vi.stubEnv(
      "CREATOR_INSTAGRAM_REDIRECT_URI",
      "https://evil.example/callback",
    );
    await expect(
      connection.authorize(authUser(creator.user)),
    ).rejects.toMatchObject({
      response: { code: "CREATOR_INSTAGRAM_REDIRECT_URI_INVALID" },
    });
    expect(
      await prisma.providerOAuthTransaction.count({
        where: { creatorProfileId: creator.profile.id },
      }),
    ).toBe(0);
  });

  it("binds completion to the initiating User and Creator subject", async () => {
    const first = await canonicalCreator("binding-a");
    const second = await canonicalCreator("binding-b");
    const issued = await start(first.user);
    await expect(complete(second.user, issued.state)).rejects.toMatchObject({
      response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
    });

    const wrongSubjectState = await creatorTransactions.issue({
      creatorProfileId: second.profile.id,
      initiatedByUserId: first.user.id,
      redirectUri: REDIRECT_URI,
      intent: InstagramOAuthIntent.INITIAL_CONNECT,
      expectedGeneration: 0,
      expectedProviderAccountId: null,
    });
    await expect(complete(first.user, wrongSubjectState)).rejects.toMatchObject(
      {
        response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
      },
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects expired state before provider I/O", async () => {
    const creator = await canonicalCreator("expired-state");
    const issued = await start(creator.user);
    await prisma.providerOAuthTransaction.update({
      where: { stateHash: hashProviderOAuthState(issued.state) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
    });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("consumes denial state exactly once without creating an integration", async () => {
    const creator = await canonicalCreator("denial");
    const issued = await start(creator.user);
    await expect(
      connection.complete(authUser(creator.user), {
        state: issued.state,
        error: "access_denied",
        errorDescription: "The user denied access",
      }),
    ).rejects.toMatchObject({
      response: { code: "INSTAGRAM_AUTHORIZATION_DENIED" },
    });
    const transaction = await prisma.providerOAuthTransaction.findUniqueOrThrow(
      {
        where: { stateHash: hashProviderOAuthState(issued.state) },
      },
    );
    expect(transaction.consumedAt).not.toBeNull();
    expect(
      await prisma.creatorSocialIntegration.count({
        where: { creatorProfileId: creator.profile.id },
      }),
    ).toBe(0);
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
    });
  });

  it.each([
    {
      label: "transient token exchange failure",
      setup: () => exchange.mockRejectedValueOnce(new Error("transport")),
      expectedCode: "INSTAGRAM_PROVIDER_RETRY_REQUIRED",
    },
    {
      label: "provider access block before identity establishment",
      setup: () =>
        fetchMe.mockRejectedValueOnce(
          new InstagramProviderRequestError(
            "Provider access blocked",
            "PROVIDER_ACCESS_BLOCKED",
          ),
        ),
      expectedCode: "PROVIDER_ACCESS_BLOCKED",
    },
    {
      label: "provider access block during token exchange",
      setup: () =>
        exchange.mockRejectedValueOnce(
          new InstagramOAuthExchangeError(
            "Provider access blocked",
            "PROVIDER_ACCESS_BLOCKED",
          ),
        ),
      expectedCode: "PROVIDER_ACCESS_BLOCKED",
    },
  ])("keeps state consumed after $label", async ({ setup, expectedCode }) => {
    const creator = await canonicalCreator("provider-failure");
    const issued = await start(creator.user);
    setup();
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: { code: expectedCode },
    });
    expect(
      (
        await prisma.providerOAuthTransaction.findUniqueOrThrow({
          where: { stateHash: hashProviderOAuthState(issued.state) },
        })
      ).consumedAt,
    ).not.toBeNull();
    expect(
      await prisma.creatorSocialIntegration.count({
        where: { creatorProfileId: creator.profile.id },
      }),
    ).toBe(0);
  });

  it.each([
    {
      label: "Business with Insights granted",
      accountType: InstagramProfessionalAccountType.BUSINESS,
      permissions: [BASIC, INSIGHTS],
      permissionFailure: false,
      expectedInsights: ProviderCapabilityState.AVAILABLE,
    },
    {
      label: "Creator with Insights absent",
      accountType: InstagramProfessionalAccountType.CREATOR,
      permissions: [BASIC],
      permissionFailure: false,
      expectedInsights: ProviderCapabilityState.UNAVAILABLE,
    },
    {
      label: "Professional with permission evidence unavailable",
      accountType: InstagramProfessionalAccountType.BUSINESS,
      permissions: [BASIC, INSIGHTS],
      permissionFailure: true,
      expectedInsights: ProviderCapabilityState.UNKNOWN,
    },
  ])(
    "promotes $label to complete using Basic independently of Insights",
    async ({
      accountType,
      permissions,
      permissionFailure,
      expectedInsights,
    }) => {
      const creator = await canonicalCreator("capability");
      const providerIdentity = `stable-${randomUUID()}`;
      const username = `mutable_${randomUUID()}`;
      const plaintext = `secret-token-${randomUUID()}`;
      exchange.mockResolvedValueOnce({
        accessToken: plaintext,
        expiresInSeconds: 5_184_000,
        permissions,
      });
      fetchMe.mockResolvedValueOnce(
        me(accountType, providerIdentity, username),
      );
      if (permissionFailure) {
        fetchPermissions.mockRejectedValueOnce(
          new InstagramPermissionEvidenceError("UNKNOWN"),
        );
      } else {
        fetchPermissions.mockResolvedValueOnce(permissions);
      }
      const log = vi.spyOn(Logger.prototype, "log");
      const warn = vi.spyOn(Logger.prototype, "warn");
      const issued = await start(creator.user);
      const result = await complete(creator.user, issued.state);
      expect(result).toMatchObject({
        connected: true,
        state: {
          accountContext: "CREATOR_READY",
          onboardingStatus: "COMPLETE",
          canEnterCreatorPlatform: true,
          instagram: {
            identityConnection: "CONNECTED",
            basicAuthorization: ProviderCapabilityState.AVAILABLE,
            insightsCapability: expectedInsights,
            authorizationHealth: ProviderAuthorizationHealth.USABLE,
          },
        },
      });
      const row = await prisma.creatorSocialIntegration.findUniqueOrThrow({
        where: {
          creatorProfileId_platformNetwork: {
            creatorProfileId: creator.profile.id,
            platformNetwork: SocialNetworkProvider.INSTAGRAM,
          },
        },
      });
      expect(row).toMatchObject({
        nativePlatformUserId: providerIdentity,
        channelHandleString: username,
        professionalAccountType: accountType,
        authorizationGeneration: 1,
        credentialVersion: 1,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
        insightsCapability: expectedInsights,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
        disconnectedAt: null,
      });
      expect(row.oauthAccessTokenEncrypted).not.toContain(plaintext);
      expect(decryptField(row.oauthAccessTokenEncrypted)).toBe(plaintext);
      expect(JSON.stringify(result)).not.toContain(plaintext);
      expect(
        JSON.stringify([...log.mock.calls, ...warn.mock.calls]),
      ).not.toContain(plaintext);
      log.mockRestore();
      warn.mockRestore();
    },
  );

  it("persists stable identity but denies entry when Basic is definitively absent", async () => {
    const creator = await canonicalCreator("basic-absent");
    fetchPermissions.mockResolvedValueOnce([INSIGHTS]);
    const issued = await start(creator.user);
    const result = await complete(creator.user, issued.state);
    expect(result.state).toMatchObject({
      onboardingStatus: "INCOMPLETE",
      canEnterCreatorPlatform: false,
      instagram: {
        identityConnection: "CONNECTED",
        basicAuthorization: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.AVAILABLE,
        authorizationHealth:
          ProviderAuthorizationHealth.REAUTHORIZATION_REQUIRED,
      },
    });
  });

  it.each([
    InstagramProfessionalAccountType.PERSONAL,
    InstagramProfessionalAccountType.UNKNOWN,
  ])("does not promote unsupported account type %s", async (accountType) => {
    const creator = await canonicalCreator("unsupported-type");
    fetchMe.mockResolvedValueOnce(me(accountType));
    const issued = await start(creator.user);
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: {
        code:
          accountType === InstagramProfessionalAccountType.PERSONAL
            ? "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED"
            : "INSTAGRAM_PROFESSIONAL_ACCOUNT_REVALIDATION_REQUIRED",
      },
    });
    expect(
      await prisma.creatorSocialIntegration.count({
        where: { creatorProfileId: creator.profile.id },
      }),
    ).toBe(0);
  });

  it("never transfers a provider identity even from a disconnected revoked owner", async () => {
    const owner = await canonicalCreator("identity-owner");
    const contender = await canonicalCreator("identity-contender");
    const providerIdentity = `owned-${randomUUID()}`;
    await prisma.creatorSocialIntegration.create({
      data: {
        creatorProfileId: owner.profile.id,
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: providerIdentity,
        channelHandleString: `former_${randomUUID()}`,
        oauthAccessTokenEncrypted: encryptField("revoked-owner-token"),
        tokenStateCondition: OAuthTokenStatus.REVOKED,
        authorizationGeneration: 4,
        credentialVersion: 3,
        authorizationHealth: ProviderAuthorizationHealth.DISCONNECTED,
        authorizationHealthReasonCode: "OWNER_DISCONNECTED",
        basicAuthorizationCapability: ProviderCapabilityState.UNAVAILABLE,
        insightsCapability: ProviderCapabilityState.UNKNOWN,
        disconnectedAt: new Date(),
        professionalAccountType: InstagramProfessionalAccountType.CREATOR,
      },
    });
    fetchMe.mockResolvedValueOnce(
      me(
        InstagramProfessionalAccountType.CREATOR,
        providerIdentity,
        `new_name_${randomUUID()}`,
      ),
    );
    const issued = await start(contender.user);
    await expect(complete(contender.user, issued.state)).rejects.toMatchObject({
      response: { code: "INSTAGRAM_IDENTITY_ALREADY_IN_USE" },
    });
    const ownerRow = await prisma.creatorSocialIntegration.findUniqueOrThrow({
      where: {
        platformNetwork_nativePlatformUserId: {
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: providerIdentity,
        },
      },
    });
    expect(ownerRow.creatorProfileId).toBe(owner.profile.id);
  });

  it("treats username as mutable metadata rather than global identity", async () => {
    const first = await canonicalCreator("same-handle-a");
    const second = await canonicalCreator("same-handle-b");
    const username = `shared_handle_${randomUUID()}`;
    const firstState = await start(first.user);
    fetchMe.mockResolvedValueOnce(
      me(
        InstagramProfessionalAccountType.BUSINESS,
        `id-${randomUUID()}`,
        username,
      ),
    );
    await complete(first.user, firstState.state);
    const secondState = await start(second.user);
    fetchMe.mockResolvedValueOnce(
      me(
        InstagramProfessionalAccountType.CREATOR,
        `id-${randomUUID()}`,
        username,
      ),
    );
    await complete(second.user, secondState.state);
    expect(
      await prisma.creatorSocialIntegration.count({
        where: { channelHandleString: username },
      }),
    ).toBe(2);
  });

  it("allows exactly one concurrent consumer for one OAuth state", async () => {
    const creator = await canonicalCreator("state-race");
    const issued = await start(creator.user);
    const attempts = await Promise.allSettled([
      complete(creator.user, issued.state),
      complete(creator.user, issued.state),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(
      await prisma.creatorSocialIntegration.count({
        where: { creatorProfileId: creator.profile.id },
      }),
    ).toBe(1);
  });

  it("allows exactly one global owner when two Creators race for one provider identity", async () => {
    const first = await canonicalCreator("identity-race-a");
    const second = await canonicalCreator("identity-race-b");
    const providerIdentity = `race-id-${randomUUID()}`;
    fetchMe.mockResolvedValue(
      me(
        InstagramProfessionalAccountType.BUSINESS,
        providerIdentity,
        `race_handle_${randomUUID()}`,
      ),
    );
    const [firstState, secondState] = await Promise.all([
      start(first.user),
      start(second.user),
    ]);
    const attempts = await Promise.allSettled([
      complete(first.user, firstState.state),
      complete(second.user, secondState.state),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.creatorSocialIntegration.count({
        where: {
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: providerIdentity,
        },
      }),
    ).toBe(1);
  });

  it("fails stale when an integration appears after authorize and before completion", async () => {
    const creator = await canonicalCreator("generation-race");
    const issued = await start(creator.user);
    await prisma.creatorSocialIntegration.create({
      data: {
        creatorProfileId: creator.profile.id,
        platformNetwork: SocialNetworkProvider.INSTAGRAM,
        nativePlatformUserId: `newer-${randomUUID()}`,
        channelHandleString: `newer_${randomUUID()}`,
        oauthAccessTokenEncrypted: encryptField("newer-token"),
        authorizationGeneration: 1,
        credentialVersion: 1,
        tokenStateCondition: OAuthTokenStatus.ACTIVE,
        authorizationHealth: ProviderAuthorizationHealth.USABLE,
        basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
        insightsCapability: ProviderCapabilityState.UNAVAILABLE,
        professionalAccountType: InstagramProfessionalAccountType.BUSINESS,
      },
    });
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: { code: "INSTAGRAM_AUTHORIZATION_STALE" },
    });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects duplicate completion without overwriting credentials", async () => {
    const creator = await canonicalCreator("duplicate-complete");
    const issued = await start(creator.user);
    await complete(creator.user, issued.state);
    const before = await prisma.creatorSocialIntegration.findUniqueOrThrow({
      where: {
        creatorProfileId_platformNetwork: {
          creatorProfileId: creator.profile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
        },
      },
    });
    await expect(complete(creator.user, issued.state)).rejects.toMatchObject({
      response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
    });
    const after = await prisma.creatorSocialIntegration.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after.oauthAccessTokenEncrypted).toBe(
      before.oauthAccessTokenEncrypted,
    );
    expect(after.authorizationGeneration).toBe(1);
    expect(after.credentialVersion).toBe(1);
  });

  it("refuses a second initial-connect authorization for an existing identity", async () => {
    const creator = await canonicalCreator("existing-connect");
    const issued = await start(creator.user);
    await complete(creator.user, issued.state);
    await expect(
      connection.authorize(authUser(creator.user)),
    ).rejects.toMatchObject({
      response: { code: "INSTAGRAM_RECOVERY_FLOW_REQUIRED" },
    });
  });
});

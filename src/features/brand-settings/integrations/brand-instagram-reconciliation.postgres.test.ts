import "reflect-metadata";

import {
  BrandRole,
  InstagramOAuthIntent,
  PrismaClient,
  UserAuthState,
} from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
} from "../../../shared/crypto/field-encryption.util";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { BrandSocialSyncService } from "../../brand-onboarding/social-sync/brand-social-sync.service";
import {
  InstagramGraphClient,
  InstagramPermissionEvidenceError,
  InstagramProviderRequestError,
} from "../../instagram/instagram-graph.client";
import {
  InstagramOAuthClient,
  InstagramTokenRefreshError,
} from "../../instagram/instagram-oauth.client";
import { ProviderOAuthTransactionService } from "../../provider-oauth/provider-oauth-transaction.service";
import { BrandInstagramDeletionService } from "../services/brand-instagram-deletion.service";
import {
  BrandInstagramOAuthStateService,
  hashInstagramSettingsState,
  INSTAGRAM_SETTINGS_STATE_TTL_MS,
} from "../services/brand-instagram-oauth-state.service";
import { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import {
  BrandSettingsIntegrationsService,
  INSTAGRAM_MIN_REFRESH_AGE_MS,
} from "../services/brand-settings-integrations.service";

const redirectUri = "http://localhost:5173/brand/settings/integrations";

describe.skipIf(process.env.BS06_DATABASE_TEST !== "true")(
  "BS-06 P1 reconciliation on disposable PostgreSQL",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const brandAuth = new BrandCentreAuthService(
      db,
      new BrandCentreSessionEvictionService(db),
    );
    const workspaceAuthorization = new BrandWorkspaceAuthorizationService(
      db,
      brandAuth,
    );
    const access = new BrandSettingsAccessService(db, workspaceAuthorization);
    const oauth = new InstagramOAuthClient();
    const graph = new InstagramGraphClient();
    const states = new BrandInstagramOAuthStateService(
      new ProviderOAuthTransactionService(db),
    );
    const deletion = new BrandInstagramDeletionService(db, access);
    const socialSync = new BrandSocialSyncService(
      db,
      oauth,
      graph,
      { sendOtp: vi.fn() } as never,
      brandAuth,
      access,
      states,
    );
    const notifications = { dispatch: vi.fn().mockResolvedValue(undefined) };
    const service = new BrandSettingsIntegrationsService(
      db,
      access,
      oauth,
      graph,
      states,
      deletion,
      notifications as never,
    );
    const createdBrandIds: string[] = [];
    const createdOrganizationIds: string[] = [];
    const exchange = vi.spyOn(oauth, "exchangeAuthorizationCode");
    const refresh = vi.spyOn(oauth, "refreshLongLivedToken");
    const me = vi.spyOn(graph, "fetchMe");
    const permissions = vi.spyOn(graph, "fetchGrantedPermissions");

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs06_")
      ) {
        throw new Error("BS-06 tests require a loopback bs06_* database");
      }
      vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "bs06-test-key");
      vi.spyOn(oauth, "buildAuthorizeUrl").mockImplementation(
        (redirect, state) =>
          `https://provider.example.test/authorize?redirect_uri=${encodeURIComponent(redirect)}&state=${state}`,
      );
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockRejectedValue(new Error("Unexpected provider network call")),
      );
    });

    beforeEach(() => {
      exchange.mockReset().mockResolvedValue({
        accessToken: randomBytes(32).toString("hex"),
        expiresInSeconds: 60 * 24 * 60 * 60,
        permissions: ["instagram_business_basic"],
      });
      refresh.mockReset().mockResolvedValue({
        accessToken: randomBytes(32).toString("hex"),
        expiresInSeconds: 60 * 24 * 60 * 60,
      });
      me.mockReset().mockResolvedValue(
        profile("ig-account-1", "app-user-1", "brand"),
      );
      permissions
        .mockReset()
        .mockResolvedValue(["instagram_business_manage_insights"]);
      notifications.dispatch.mockClear();
    });

    afterEach(async () => {
      await prisma.brandProfile.deleteMany({
        where: { id: { in: createdBrandIds.splice(0) } },
      });
      await prisma.user.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: createdOrganizationIds.splice(0) } },
      });
    });

    afterAll(async () => {
      await prisma.$disconnect();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    async function makeWorkspace() {
      const organization = await prisma.organization.create({
        data: { name: "BS06 P1 fixture", kind: "BRAND" },
      });
      createdOrganizationIds.push(organization.id);
      const brand = await prisma.brandProfile.create({
        data: {
          name: "BS06 Brand",
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          organizationId: organization.id,
          isVerified: true,
          igHandle: "brand",
        },
      });
      createdBrandIds.push(brand.id);
      const owner = await addActor(
        organization.id,
        brand.id,
        BrandRole.BRAND_OWNER,
      );
      const campaignManager = await addActor(
        organization.id,
        brand.id,
        BrandRole.CAMPAIGN_MANAGER,
      );
      const finance = await addActor(
        organization.id,
        brand.id,
        BrandRole.FINANCE_ADMIN,
      );
      return { organization, brand, owner, campaignManager, finance };
    }

    async function addActor(
      organizationId: string,
      brandProfileId: string,
      role: BrandRole,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "BRAND",
          authState: UserAuthState.ACTIVE,
          organizationId,
        },
      });
      await prisma.brandTeamMember.create({
        data: { brandProfileId, userId: user.id, role },
      });
      return user;
    }

    async function start(
      actor: Awaited<ReturnType<typeof addActor>>,
      intent?: InstagramOAuthIntent,
    ) {
      return (await service.getInstagramOauthUrl(actor, redirectUri, intent))
        .state;
    }

    function connect(
      actor: Awaited<ReturnType<typeof addActor>>,
      state: string,
    ) {
      return service.connectInstagram(actor, {
        code: "synthetic-code",
        redirectUri,
        state,
      });
    }

    async function connectInitial(
      workspace: Awaited<ReturnType<typeof makeWorkspace>>,
    ) {
      const result = await connect(
        workspace.owner,
        await start(workspace.owner),
      );
      return prisma.brandIntegration.findUniqueOrThrow({
        where: { id: result.integrationId },
      });
    }

    it("binds state once and permits one callback winner under concurrency", async () => {
      const workspace = await makeWorkspace();
      const state = await start(workspace.owner);
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => connect(workspace.owner, state)),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(7);
      expect(exchange).toHaveBeenCalledTimes(1);
    });

    it("persists only independent state hashes with Brand, user, redirect, and ten-minute binding", async () => {
      const workspace = await makeWorkspace();
      const before = Date.now();
      const first = await start(workspace.owner);
      const second = await start(workspace.owner);
      expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(second).not.toBe(first);
      const row = await prisma.providerOAuthTransaction.findUniqueOrThrow({
        where: { stateHash: hashInstagramSettingsState(first) },
      });
      expect(row).toMatchObject({
        brandProfileId: workspace.brand.id,
        initiatedByUserId: workspace.owner.id,
        redirectUri,
        intent: "INITIAL_CONNECT",
        initiatedByRole: "BRAND_OWNER",
        expectedGeneration: 0,
        consumedAt: null,
      });
      expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + INSTAGRAM_SETTINGS_STATE_TTL_MS,
      );
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + INSTAGRAM_SETTINGS_STATE_TTL_MS,
      );
      expect(JSON.stringify(row)).not.toContain(first);
    });

    it.each([
      "missing",
      "unknown",
      "altered",
      "expired",
      "consumed",
      "wrong-user",
      "wrong-brand",
      "redirect",
    ] as const)(
      "rejects %s OAuth state before provider I/O",
      async (failure) => {
        const workspace = await makeWorkspace();
        let state = await start(workspace.owner);
        let actor = workspace.owner;
        let callbackRedirect = redirectUri;
        const stateHash = hashInstagramSettingsState(state);
        if (failure === "missing") state = undefined as unknown as string;
        if (failure === "unknown")
          state = randomBytes(32).toString("base64url");
        if (failure === "altered") {
          state = `${state[0] === "A" ? "B" : "A"}${state.slice(1)}`;
        }
        if (failure === "expired") {
          await prisma.providerOAuthTransaction.update({
            where: { stateHash },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
        }
        if (failure === "consumed") {
          await prisma.providerOAuthTransaction.update({
            where: { stateHash },
            data: { consumedAt: new Date() },
          });
        }
        if (failure === "wrong-user") actor = workspace.campaignManager;
        if (failure === "wrong-brand") actor = (await makeWorkspace()).owner;
        if (failure === "redirect") callbackRedirect = `${redirectUri}/changed`;

        await expect(
          service.connectInstagram(actor, {
            code: "must-not-exchange",
            redirectUri: callbackRedirect,
            state,
          }),
        ).rejects.toBeTruthy();
        expect(exchange).not.toHaveBeenCalled();
        expect(me).not.toHaveBeenCalled();
      },
    );

    it("burns state on provider failure and requires a fresh attempt", async () => {
      const workspace = await makeWorkspace();
      const state = await start(workspace.owner);
      exchange.mockRejectedValueOnce(new Error("synthetic provider failure"));
      await expect(connect(workspace.owner, state)).rejects.toThrow(
        "synthetic provider failure",
      );
      await expect(connect(workspace.owner, state)).rejects.toMatchObject({
        status: 400,
      });
      expect(exchange).toHaveBeenCalledTimes(1);
      await expect(
        connect(workspace.owner, await start(workspace.owner)),
      ).resolves.toMatchObject({ connected: true });
    });

    it("binds onboarding and invitation OAuth to the same generation fence", async () => {
      const workspace = await makeWorkspace();
      await expect(
        socialSync.inviteTeammate(
          workspace.campaignManager,
          "delegate@example.test",
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        socialSync.inviteTeammate(workspace.finance, "delegate@example.test"),
      ).rejects.toMatchObject({ status: 403 });
      const onboarding = await socialSync.getOauthUrl(
        workspace.owner,
        redirectUri,
      );
      await expect(
        socialSync.connectInstagram(workspace.owner, {
          code: "onboarding-code",
          redirectUri,
          state: onboarding.state,
        }),
      ).resolves.toMatchObject({ connected: true, handle: "@brand" });
      const integration = await prisma.brandIntegration.findUniqueOrThrow({
        where: {
          brandProfileId_provider: {
            brandProfileId: workspace.brand.id,
            provider: "INSTAGRAM",
          },
        },
      });
      expect(integration).toMatchObject({
        providerAccountId: "ig-account-1",
        providerAppScopedUserId: "app-user-1",
      });

      const invite = await prisma.instagramSyncInvitation.create({
        data: {
          brandProfileId: workspace.brand.id,
          email: "fenced-invite@example.test",
          token: randomBytes(24).toString("hex"),
          status: "VERIFIED",
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const inviteAttempt = await socialSync.getInviteOauthUrl(
        invite.token,
        redirectUri,
      );
      await deletion.requestByUser(workspace.owner, integration.id);
      exchange.mockClear();
      await expect(
        socialSync.connectInstagramForInvite(invite.token, {
          code: "stale-invite-code",
          redirectUri,
          state: inviteAttempt.state,
        }),
      ).rejects.toMatchObject({ status: 401 });
      expect(exchange).not.toHaveBeenCalled();
    });

    it("keeps failed permission evidence unknown without downgrading core profile proof", async () => {
      const workspace = await makeWorkspace();
      permissions.mockRejectedValueOnce(
        new InstagramPermissionEvidenceError("TRANSIENT"),
      );
      const integration = await connectInitial(workspace);
      expect(integration).toMatchObject({
        authorizationHealth: "NEEDS_REVALIDATION",
        firstPartyProfileCapability: "YES",
        firstPartyInsightsCapability: "UNKNOWN",
        businessDiscoveryCapability: "DEFERRED",
        creatorMarketplaceCapability: "DEFERRED",
        humanActionRequired: false,
      });
    });

    it("distinguishes explicit missing insights from full core authorization", async () => {
      const workspace = await makeWorkspace();
      permissions.mockResolvedValueOnce([]);
      const integration = await connectInitial(workspace);
      expect(integration).toMatchObject({
        authorizationHealth: "PARTIALLY_CONNECTED",
        firstPartyProfileCapability: "YES",
        firstPartyInsightsCapability: "NO",
      });
    });

    it("uses stable identity across rename, rejects different-ID reconnect, and gates account change", async () => {
      const workspace = await makeWorkspace();
      const initial = await connectInitial(workspace);
      expect(initial).toMatchObject({
        providerAccountId: "ig-account-1",
        providerAppScopedUserId: "app-user-1",
        currentPlatformHandle: "@brand",
        identityVerification: "VERIFIED",
        authorizationHealth: "CONNECTED_FULL",
      });

      me.mockResolvedValue(profile("ig-account-1", "app-user-1", "renamed"));
      await expect(
        connect(
          workspace.campaignManager,
          await start(
            workspace.campaignManager,
            InstagramOAuthIntent.RECONNECT,
          ),
        ),
      ).resolves.toMatchObject({ connected: true, handle: "@renamed" });

      const beforeConflict = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: initial.id },
      });
      me.mockResolvedValue(profile("ig-account-2", "app-user-2", "renamed"));
      await expect(
        connect(
          workspace.campaignManager,
          await start(
            workspace.campaignManager,
            InstagramOAuthIntent.RECONNECT,
          ),
        ),
      ).resolves.toMatchObject({
        conflict: true,
        code: "ACCOUNT_CHANGE_REQUIRED",
      });
      const conflict = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: initial.id },
      });
      expect(conflict.providerAccountId).toBe("ig-account-1");
      expect(conflict.accessTokenEncrypted).toBe(
        beforeConflict.accessTokenEncrypted,
      );
      expect(conflict.pendingProviderAccountId).toBe("ig-account-2");

      await expect(
        start(workspace.campaignManager, InstagramOAuthIntent.ACCOUNT_CHANGE),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        start(workspace.finance, InstagramOAuthIntent.RECONNECT),
      ).rejects.toMatchObject({ status: 403 });

      await expect(
        connect(
          workspace.owner,
          await start(workspace.owner, InstagramOAuthIntent.ACCOUNT_CHANGE),
        ),
      ).resolves.toMatchObject({
        connected: true,
        providerAccountId: "ig-account-2",
      });
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: initial.id },
        }),
      ).toMatchObject({
        providerAccountId: "ig-account-2",
        providerAppScopedUserId: "app-user-2",
        pendingProviderAccountId: null,
      });
    });

    it("establishes legacy identity only by revalidating the existing credential", async () => {
      const workspace = await makeWorkspace();
      const legacyToken = encryptField("legacy-canonical-token");
      const legacy = await prisma.brandIntegration.create({
        data: {
          brandProfileId: workspace.brand.id,
          provider: "INSTAGRAM",
          status: "CONNECTED",
          currentPlatformHandle: "@brand",
          accessTokenEncrypted: legacyToken,
          isActive: true,
        },
      });
      me.mockResolvedValueOnce(
        profile("real-stable-id", "app-subject", "renamed"),
      ).mockResolvedValueOnce(
        profile("real-stable-id", "app-subject", "brand"),
      );
      await expect(
        connect(
          workspace.campaignManager,
          await start(
            workspace.campaignManager,
            InstagramOAuthIntent.RECONNECT,
          ),
        ),
      ).resolves.toMatchObject({
        connected: true,
        providerAccountId: "real-stable-id",
      });
      const reconciled = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: legacy.id },
      });
      expect(reconciled).toMatchObject({
        providerAccountId: "real-stable-id",
        providerAppScopedUserId: "app-subject",
        identityVerification: "VERIFIED",
        currentPlatformHandle: "@renamed",
      });
      expect(reconciled.authorizationGeneration).toBe(1);

      const unavailable = await makeWorkspace();
      const unverifiable = await prisma.brandIntegration.create({
        data: {
          brandProfileId: unavailable.brand.id,
          provider: "INSTAGRAM",
          status: "CONNECTED",
          currentPlatformHandle: "@brand",
          accessTokenEncrypted: null,
          isActive: true,
        },
      });
      await expect(
        connect(
          unavailable.campaignManager,
          await start(
            unavailable.campaignManager,
            InstagramOAuthIntent.RECONNECT,
          ),
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: unverifiable.id },
        }),
      ).toMatchObject({
        providerAccountId: null,
        providerAppScopedUserId: null,
        identityVerification: "UNVERIFIED",
        accessTokenEncrypted: null,
      });
    });

    it("disconnects through LIVE campaign history and fences callback and refresh races", async () => {
      const workspace = await makeWorkspace();
      const integration = await connectInitial(workspace);
      const staleState = await start(
        workspace.owner,
        InstagramOAuthIntent.RECONNECT,
      );
      const campaign = await prisma.uceCampaign.create({
        data: {
          brandProfileId: workspace.brand.id,
          name: "LIVE history",
          status: "LIVE",
        },
      });

      const refreshEntered = deferred<void>();
      const releaseRefresh = deferred<{
        accessToken: string;
        expiresInSeconds: number;
      }>();
      refresh.mockImplementationOnce(async () => {
        refreshEntered.resolve();
        return releaseRefresh.promise;
      });
      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: {
          tokenIssuedAt: new Date(
            Date.now() - INSTAGRAM_MIN_REFRESH_AGE_MS - 1000,
          ),
          tokenExpiresAt: new Date(Date.now() + 60_000),
        },
      });
      const refreshing = service.refreshDueTokens();
      await refreshEntered.promise;
      await service.manageAction(workspace.owner, {
        integrationId: integration.id,
        action: "DISCONNECT_INTEGRATION",
      });
      releaseRefresh.resolve({
        accessToken: "stale-refresh",
        expiresInSeconds: 9999,
      });
      expect(await refreshing).toMatchObject({ refreshed: 0 });

      exchange.mockClear();
      await expect(connect(workspace.owner, staleState)).rejects.toMatchObject({
        status: 400,
      });
      expect(exchange).not.toHaveBeenCalled();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        isActive: false,
        authorizationHealth: "DISCONNECTED",
        accessTokenEncrypted: null,
        pendingAccessTokenEncrypted: null,
      });
      expect(
        await prisma.uceCampaign.count({ where: { id: campaign.id } }),
      ).toBe(1);
      await expect(
        service.manageAction(workspace.campaignManager, {
          integrationId: integration.id,
          action: "DISCONNECT_INTEGRATION",
        }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.manageAction(workspace.finance, {
          integrationId: integration.id,
          action: "DISCONNECT_INTEGRATION",
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("distinguishes transient refresh failure from durable authorization-loss episodes", async () => {
      const workspace = await makeWorkspace();
      const integration = await connectInitial(workspace);
      const makeDue = () =>
        prisma.brandIntegration.update({
          where: { id: integration.id },
          data: {
            tokenIssuedAt: new Date(
              Date.now() - INSTAGRAM_MIN_REFRESH_AGE_MS - 1000,
            ),
            tokenExpiresAt: new Date(Date.now() + 60_000),
          },
        });

      await prisma.brandIntegration.update({
        where: { id: integration.id },
        data: {
          tokenIssuedAt: new Date(
            Date.now() - INSTAGRAM_MIN_REFRESH_AGE_MS - 1000,
          ),
          tokenExpiresAt: new Date(Date.now() - 1000),
        },
      });
      me.mockRejectedValueOnce(
        new InstagramProviderRequestError("synthetic timeout", "TRANSIENT"),
      );
      await service.refreshDueTokens();
      expect(refresh).not.toHaveBeenCalled();
      expect(notifications.dispatch).not.toHaveBeenCalled();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        authorizationHealth: "UNKNOWN",
        humanActionRequired: false,
      });

      await makeDue();
      refresh.mockRejectedValueOnce(
        new InstagramTokenRefreshError("TRANSIENT"),
      );
      await service.refreshDueTokens();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        authorizationHealth: "UNKNOWN",
        humanActionRequired: false,
      });
      expect(notifications.dispatch).not.toHaveBeenCalled();

      await makeDue();
      refresh.mockRejectedValueOnce(
        new InstagramTokenRefreshError("PROVIDER_ACCESS_BLOCKED"),
      );
      await service.refreshDueTokens();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        authorizationHealth: "PROVIDER_ACCESS_BLOCKED",
        humanActionRequired: false,
        authorizationLossTransitionId: null,
      });
      expect(notifications.dispatch).not.toHaveBeenCalled();

      await makeDue();
      refresh.mockRejectedValueOnce(
        new InstagramTokenRefreshError("AUTHORIZATION_REVALIDATION_REQUIRED"),
      );
      await service.refreshDueTokens();
      const firstLoss = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      expect(firstLoss.humanActionRequired).toBe(true);
      expect(firstLoss.authorizationLossTransitionId).toBeTruthy();

      await makeDue();
      refresh.mockRejectedValueOnce(
        new InstagramTokenRefreshError("AUTHORIZATION_REVALIDATION_REQUIRED"),
      );
      await service.refreshDueTokens();
      const replay = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      expect(replay.authorizationLossTransitionId).toBe(
        firstLoss.authorizationLossTransitionId,
      );
      expect(
        notifications.dispatch.mock.calls.every(
          ([event]) =>
            event.eventType === "integration.instagram_token_expired" &&
            event.source.transitionId ===
              firstLoss.authorizationLossTransitionId,
        ),
      ).toBe(true);

      await makeDue();
      refresh.mockResolvedValueOnce({
        accessToken: "recovered",
        expiresInSeconds: 9999,
      });
      await service.refreshDueTokens();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        humanActionRequired: false,
        authorizationLossTransitionId: null,
      });

      await makeDue();
      refresh.mockRejectedValueOnce(
        new InstagramTokenRefreshError("PERMISSION_LOSS"),
      );
      await service.refreshDueTokens();
      const laterLoss = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: integration.id },
      });
      expect(laterLoss.authorizationLossTransitionId).not.toBe(
        firstLoss.authorizationLossTransitionId,
      );
    });

    it("deletes durably, preserves business history, applies provenance, and resumes after failure", async () => {
      const workspace = await makeWorkspace();
      const integration = await connectInitial(workspace);
      const outstandingState = await start(
        workspace.owner,
        InstagramOAuthIntent.RECONNECT,
      );
      const invitation = await prisma.instagramSyncInvitation.create({
        data: {
          brandProfileId: workspace.brand.id,
          email: "invite@example.test",
          token: randomBytes(24).toString("hex"),
          status: "VERIFIED",
          expiresAt: new Date(Date.now() + 86_400_000),
          otpCode: "123456",
          otpExpiresAt: new Date(Date.now() + 600_000),
          oauthStateHash: randomBytes(32).toString("hex"),
          oauthRedirectUri: redirectUri,
          oauthExpectedGeneration: integration.authorizationGeneration,
          oauthStateExpiresAt: new Date(Date.now() + 600_000),
        },
      });
      const campaign = await prisma.uceCampaign.create({
        data: {
          brandProfileId: workspace.brand.id,
          name: "Retained",
          status: "LIVE",
        },
      });

      const request = await prisma.brandInstagramDeletionRequest.create({
        data: {
          brandProfileId: workspace.brand.id,
          providerAccountId: integration.providerAccountId,
          providerAppScopedUserId: integration.providerAppScopedUserId,
          source: "USER",
          requesterUserId: workspace.owner.id,
          requestedGeneration: integration.authorizationGeneration,
          confirmationCode: "crash-resume-confirmation",
          policyVersion: "BS06_P1_V1",
        },
      });
      await (
        deletion as unknown as {
          establishFence(requestId: string): Promise<void>;
        }
      ).establishFence(request.id);
      await prisma.brandInstagramDeletionRequest.update({
        where: { id: request.id },
        data: { state: "FAILED_RETRYABLE", lastErrorCode: "WORKER_CRASH" },
      });
      const failed =
        await prisma.brandInstagramDeletionRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
      expect(failed).toMatchObject({ state: "FAILED_RETRYABLE" });
      expect(failed.fenceGeneration).toBeTruthy();

      await deletion.processPending();
      const completed =
        await prisma.brandInstagramDeletionRequest.findUniqueOrThrow({
          where: { id: failed.id },
        });
      expect(completed.state).toBe("COMPLETED");
      expect(completed.fenceGeneration).toBe(failed.fenceGeneration);
      const repeated = await deletion.requestByUser(
        workspace.owner,
        integration.id,
      );
      expect(repeated.requestId).toBe(completed.id);
      expect(JSON.stringify(repeated)).not.toContain("ig-account-1");
      expect(JSON.stringify(repeated)).not.toContain("@brand");

      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: integration.id },
        }),
      ).toMatchObject({
        accessTokenEncrypted: null,
        pendingAccessTokenEncrypted: null,
        currentPlatformHandle: null,
        inboundOauthHandle: null,
        authorizationHealth: "DISCONNECTED",
      });
      expect(
        await prisma.brandProfile.findUniqueOrThrow({
          where: { id: workspace.brand.id },
        }),
      ).toMatchObject({ igHandle: null, igHandleProvenance: "META_DIRECT" });
      expect(
        await prisma.providerOAuthTransaction.findUniqueOrThrow({
          where: {
            stateHash: hashState(outstandingState),
          },
        }),
      ).toMatchObject({ consumedAt: expect.any(Date) });
      expect(
        await prisma.instagramSyncInvitation.findUniqueOrThrow({
          where: { id: invitation.id },
        }),
      ).toMatchObject({
        status: "EXPIRED",
        otpCode: null,
        oauthStateHash: null,
      });
      expect(
        await prisma.uceCampaign.count({ where: { id: campaign.id } }),
      ).toBe(1);
    });

    it.each(["USER_ENTERED", "WEBSITE_DERIVED"] as const)(
      "retains %s Instagram handle provenance during deletion",
      async (provenance) => {
        const workspace = await makeWorkspace();
        const integration = await connectInitial(workspace);
        await prisma.brandProfile.update({
          where: { id: workspace.brand.id },
          data: { igHandle: "retained-handle", igHandleProvenance: provenance },
        });
        await deletion.requestByUser(workspace.owner, integration.id);
        expect(
          await prisma.brandProfile.findUniqueOrThrow({
            where: { id: workspace.brand.id },
          }),
        ).toMatchObject({
          igHandle: "retained-handle",
          igHandleProvenance: provenance,
        });
      },
    );

    it("resolves every callback Brand deterministically and reuses replay confirmation", async () => {
      const first = await makeWorkspace();
      const second = await makeWorkspace();
      me.mockResolvedValue(profile("ig-one", "shared-app-subject", "brand"));
      const alreadyDeleted = await connectInitial(first);
      await deletion.requestByUser(first.owner, alreadyDeleted.id);
      me.mockResolvedValue(profile("ig-two", "shared-app-subject", "brand"));
      await connectInitial(second);

      const initial = await deletion.requestByMetaCallback({
        providerAppScopedUserId: "shared-app-subject",
        callbackRequestHash: "a".repeat(64),
        confirmationCode: "first-confirmation",
      });
      const replay = await deletion.requestByMetaCallback({
        providerAppScopedUserId: "shared-app-subject",
        callbackRequestHash: "a".repeat(64),
        confirmationCode: "must-not-replace",
      });
      expect(initial.requestIds).toHaveLength(2);
      expect(replay).toEqual(initial);
      expect((await deletion.status(initial.confirmationCode)).scopes).toBe(2);
      await expect(
        deletion.requestByMetaCallback({
          providerAppScopedUserId: "unknown-subject",
          callbackRequestHash: "b".repeat(64),
          confirmationCode: "unknown",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  },
);

function profile(userId: string, appScopedUserId: string, username: string) {
  return {
    userId,
    appScopedUserId,
    username,
    name: null,
    accountType: "BUSINESS" as const,
    profilePictureUrl: null,
    followersCount: 10,
    followsCount: 2,
    mediaCount: 3,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

import "reflect-metadata";

import {
  InstagramOAuthIntent,
  InstagramProfessionalAccountType,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { InstagramGraphClient } from "../../instagram/instagram-graph.client";
import { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import { BrandInstagramOAuthStateService } from "../services/brand-instagram-oauth-state.service";
import { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import { BrandSettingsIntegrationsService } from "../services/brand-settings-integrations.service";

const BRAND_ID = "bs06-p1c1-brand";
const INTEGRATION_ID = "bs06-p1c1-integration";
const LEGACY_STATE_ID = "bs06-p1c1-legacy-state";
const LEGACY_BEARER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const REDIRECT_URI = "http://localhost:5173/brand/settings/integrations";

describe.skipIf(process.env.BS06_MIGRATION_DATABASE_TEST !== "true")(
  "BS-06 P1C1 canonical-upgrade OAuth boundary",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const brandAuth = new BrandCentreAuthService(
      db,
      new BrandCentreSessionEvictionService(db),
    );
    const access = new BrandSettingsAccessService(
      db,
      new BrandWorkspaceAuthorizationService(db, brandAuth),
    );
    const oauth = new InstagramOAuthClient();
    const graph = new InstagramGraphClient();
    const states = new BrandInstagramOAuthStateService(db);
    const service = new BrandSettingsIntegrationsService(
      db,
      access,
      oauth,
      graph,
      states,
    );
    const exchange = vi.spyOn(oauth, "exchangeAuthorizationCode");
    const me = vi.spyOn(graph, "fetchMe");
    const permissions = vi.spyOn(graph, "fetchGrantedPermissions");

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.pathname !== "/bs06_p1c1"
      ) {
        throw new Error(
          "BS-06 P1C1 requires the disposable bs06_p1c1 database",
        );
      }
      vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", "bs06-p1c1-test-key");
      vi.spyOn(oauth, "buildAuthorizeUrl").mockImplementation(
        (redirect, state) =>
          `https://provider.example.test/authorize?redirect_uri=${encodeURIComponent(redirect)}&state=${state}`,
      );
      exchange.mockResolvedValue({
        accessToken: "fresh-post-migration-token",
        expiresInSeconds: 5_184_000,
        permissions: ["instagram_business_basic"],
      });
      me.mockResolvedValue({
        userId: "stable-provider-account-1",
        appScopedUserId: "app-scoped-user-1",
        username: "legacy_handle",
        name: "Legacy Brand",
        accountType: InstagramProfessionalAccountType.BUSINESS,
        profilePictureUrl: null,
        followersCount: 1,
        followsCount: 1,
        mediaCount: 1,
      });
      permissions.mockResolvedValue(["instagram_business_manage_insights"]);
    });

    afterAll(async () => {
      await prisma.$disconnect();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it("burns the pre-P1 bearer and permits a fresh post-migration reconnect", async () => {
      const owner = await prisma.user.findUniqueOrThrow({
        where: { id: "bs06-p1c1-owner" },
      });
      const before = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: INTEGRATION_ID },
      });
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: "bs06-p1c1-disconnected" },
        }),
      ).toMatchObject({
        status: "DISCONNECTED",
        providerAccountId: null,
        identityVerification: "UNVERIFIED",
        authorizationHealth: "DISCONNECTED",
        accessTokenEncrypted: null,
      });
      expect(
        await prisma.brandProfile.findUniqueOrThrow({
          where: { id: BRAND_ID },
        }),
      ).toMatchObject({
        igHandle: "legacy_handle",
        igHandleProvenance: "LEGACY_UNKNOWN",
      });
      expect(before).toMatchObject({
        brandProfileId: BRAND_ID,
        status: "CONNECTED",
        currentPlatformHandle: "@legacy_handle",
        providerAccountId: null,
        providerAppScopedUserId: null,
        identityVerification: "UNVERIFIED",
        authorizationHealth: "NEEDS_REVALIDATION",
        pendingProviderAccountId: null,
      });
      expect(
        await prisma.brandInstagramOAuthState.findUniqueOrThrow({
          where: { id: LEGACY_STATE_ID },
        }),
      ).toMatchObject({ consumedAt: expect.any(Date) });

      await expect(
        service.connectInstagram(owner, {
          code: "must-not-be-exchanged",
          redirectUri: REDIRECT_URI,
          state: LEGACY_BEARER,
        }),
      ).rejects.toMatchObject({
        response: { code: "INVALID_INSTAGRAM_OAUTH_STATE" },
      });
      expect(exchange).not.toHaveBeenCalled();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: INTEGRATION_ID },
        }),
      ).toMatchObject({
        accessTokenEncrypted: before.accessTokenEncrypted,
        providerAccountId: null,
        providerAppScopedUserId: null,
        pendingProviderAccountId: null,
        pendingAccessTokenEncrypted: null,
      });

      const fresh = await service.getInstagramOauthUrl(
        owner,
        REDIRECT_URI,
        InstagramOAuthIntent.RECONNECT,
      );
      expect(fresh.intent).toBe(InstagramOAuthIntent.RECONNECT);
      await expect(
        service.connectInstagram(owner, {
          code: "fresh-code",
          redirectUri: REDIRECT_URI,
          state: fresh.state,
        }),
      ).resolves.toMatchObject({
        connected: true,
        providerAccountId: "stable-provider-account-1",
      });
      expect(exchange).toHaveBeenCalledOnce();
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: INTEGRATION_ID },
        }),
      ).toMatchObject({
        providerAccountId: "stable-provider-account-1",
        providerAppScopedUserId: "app-scoped-user-1",
        identityVerification: "VERIFIED",
      });
    });
  },
);

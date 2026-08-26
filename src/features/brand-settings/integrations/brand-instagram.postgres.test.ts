import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import {
  PrismaClient,
  type Prisma,
  type BrandIntegration,
  type BrandIntegrationStatus,
} from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { decryptField } from "../../../shared/crypto/field-encryption.util";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { InstagramOAuthClient } from "../../instagram/instagram-oauth.client";
import { InstagramGraphClient } from "../../instagram/instagram-graph.client";
import { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import { BrandSettingsIntegrationsService } from "../services/brand-settings-integrations.service";
import {
  BrandInstagramOAuthStateService,
  hashInstagramSettingsState,
  INSTAGRAM_SETTINGS_STATE_TTL_MS,
} from "../services/brand-instagram-oauth-state.service";
import { ConnectInstagramSettingsSchema } from "../schemas/brand-settings.schema";

const redirectUri = "http://localhost:5173/brand/settings/integrations";
describe("BS-06 callback schema", () => {
  it.each([undefined, "", "altered", " "])(
    "rejects missing or malformed state (%s)",
    (state) => {
      expect(
        ConnectInstagramSettingsSchema.safeParse({
          code: "synthetic-code",
          redirectUri,
          state,
        }).success,
      ).toBe(false);
    },
  );
});

describe.skipIf(process.env.BS06_DATABASE_TEST !== "true")(
  "BS-06 disposable PostgreSQL",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const access = new BrandSettingsAccessService(
      db,
      new BrandWorkspaceAuthorizationService(
        db,
        new BrandCentreAuthService(
          db,
          new BrandCentreSessionEvictionService(db),
        ),
      ),
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
    const orgIds: string[] = [];
    const brandIds: string[] = [];
    const syntheticToken = () => randomBytes(32).toString("hex");
    const exchange = vi.spyOn(oauth, "exchangeAuthorizationCode");
    const me = vi.spyOn(graph, "fetchMe");
    const permissions = vi.spyOn(graph, "fetchGrantedPermissions");

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs06_")
      )
        throw new Error("BS-06 requires a disposable loopback bs06_* database");
      vi.stubEnv("SETTINGS_FIELD_ENCRYPTION_KEY", syntheticToken());
      vi.spyOn(oauth, "buildAuthorizeUrl").mockImplementation(
        (redirect, state) => {
          const url = new URL("https://provider.example.test/authorize");
          url.searchParams.set("redirect_uri", redirect);
          url.searchParams.set("state", state);
          return url.toString();
        },
      );
      // No real provider network access is permitted in this suite.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Unexpected network call")),
      );
    });
    beforeEach(() => {
      exchange.mockReset().mockResolvedValue({
        accessToken: syntheticToken(),
        expiresInSeconds: 3600,
        permissions: ["instagram_business_basic"],
      });
      permissions
        .mockReset()
        .mockResolvedValue(["instagram_business_manage_insights"]);
      me.mockReset().mockResolvedValue({
        userId: "synthetic-ig",
        username: "brand",
        name: null,
        accountType: "BUSINESS",
        profilePictureUrl: null,
        followersCount: 10,
        followsCount: 2,
        mediaCount: 3,
      });
    });
    afterAll(async () => {
      await prisma.brandProfile.deleteMany({ where: { id: { in: brandIds } } });
      await prisma.user.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      await prisma.$disconnect();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });
    async function workspace() {
      const org = await prisma.organization.create({
        data: { name: "BS06 fixture" },
      });
      orgIds.push(org.id);
      const brand = await prisma.brandProfile.create({
        data: {
          name: "BS06 Brand",
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          organizationId: org.id,
          isVerified: true,
          igHandle: "brand",
        },
      });
      brandIds.push(brand.id);
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          role: "BRAND",
          organizationId: org.id,
        },
      });
      const membership = await prisma.brandTeamMember.create({
        data: {
          brandProfileId: brand.id,
          userId: user.id,
          role: "BRAND_OWNER",
        },
      });
      return { org, brand, user, membership };
    }
    type Workspace = Awaited<ReturnType<typeof workspace>>;
    async function start(w: Workspace) {
      const result = await service.getInstagramOauthUrl(w.user, redirectUri);
      return new URL(result.url).searchParams.get("state")!;
    }
    const connect = (w: Workspace, state: string, redirect = redirectUri) =>
      service.connectInstagram(w.user, {
        code: "synthetic-code",
        state,
        redirectUri: redirect,
      });
    async function connected(w: Workspace) {
      const result = await connect(w, await start(w));
      return prisma.brandIntegration.findUniqueOrThrow({
        where: { id: result.integrationId },
      });
    }

    it("issues independent random states, persisting only hashes with user/Brand/redirect/10-minute binding", async () => {
      const w = await workspace();
      const before = Date.now();
      const raw = await start(w);
      const second = await start(w);
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(second === raw).toBe(false);
      const row = await prisma.brandInstagramOAuthState.findUniqueOrThrow({
        where: { stateHash: hashInstagramSettingsState(raw) },
      });
      expect(row.brandProfileId).toBe(w.brand.id);
      expect(row.initiatedByUserId).toBe(w.user.id);
      expect(row.redirectUri).toBe(redirectUri);
      expect(row.consumedAt).toBeNull();
      expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + INSTAGRAM_SETTINGS_STATE_TTL_MS,
      );
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + INSTAGRAM_SETTINGS_STATE_TTL_MS,
      );
      expect(JSON.stringify(row).includes(raw)).toBe(false);
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
    ] as const)("denies %s state before provider exchange", async (failure) => {
      const w = await workspace();
      let state = await start(w);
      let actor = w;
      let redirect = redirectUri;
      const where = { stateHash: hashInstagramSettingsState(state) };
      if (failure === "missing") state = undefined as unknown as string;
      if (failure === "unknown") state = randomBytes(32).toString("base64url");
      if (failure === "altered")
        state = (state[0] === "A" ? "B" : "A") + state.slice(1);
      if (failure === "expired")
        await prisma.brandInstagramOAuthState.update({
          where,
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
      if (failure === "consumed")
        await prisma.brandInstagramOAuthState.update({
          where,
          data: { consumedAt: new Date() },
        });
      if (failure === "wrong-brand") actor = await workspace();
      if (failure === "wrong-user") {
        const user = await prisma.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            role: "BRAND",
            organizationId: w.org.id,
          },
        });
        await prisma.brandTeamMember.create({
          data: {
            brandProfileId: w.brand.id,
            userId: user.id,
            role: "CAMPAIGN_MANAGER",
          },
        });
        actor = { ...w, user };
      }
      if (failure === "redirect") redirect += "/different";
      await expect(connect(actor, state, redirect)).rejects.toMatchObject({
        status: 400,
      });
      expect(exchange).not.toHaveBeenCalled();
      expect(me).not.toHaveBeenCalled();
      if (["wrong-user", "wrong-brand", "redirect"].includes(failure)) {
        expect(
          (await prisma.brandInstagramOAuthState.findUniqueOrThrow({ where }))
            .consumedAt,
        ).toBeNull();
        await expect(connect(w, state)).resolves.toMatchObject({
          connected: true,
        });
      }
    });

    it("valid matching identity connects with encrypted token, scopes and expiry intact; replay denied", async () => {
      const w = await workspace();
      const state = await start(w);
      const token = syntheticToken();
      exchange.mockResolvedValueOnce({
        accessToken: token,
        expiresInSeconds: 3600,
        permissions: ["instagram_business_basic"],
      });
      const result = await connect(w, state);
      expect(result).toMatchObject({
        conflict: false,
        connected: true,
        status: "CONNECTED",
        handle: "@brand",
        scopes: ["BASIC_PROFILE", "ENGAGEMENT_INSIGHTS"],
      });
      const row = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: result.integrationId },
      });
      expect(row.accessTokenEncrypted === token).toBe(false);
      expect(decryptField(row.accessTokenEncrypted!) === token).toBe(true);
      expect(row.tokenExpiresAt!.getTime()).toBeGreaterThan(
        Date.now() + 3500000,
      );
      await expect(connect(w, state)).rejects.toMatchObject({ status: 400 });
      expect(exchange).toHaveBeenCalledTimes(1);
    });

    it("concurrent same-state PostgreSQL updates allow exactly one provider exchange", async () => {
      const w = await workspace();
      const state = await start(w);
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => connect(w, state)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(7);
      expect(exchange).toHaveBeenCalledTimes(1);
    });

    it("provider failure burns the state; a fresh attempt can recover", async () => {
      const w = await workspace();
      const state = await start(w);
      exchange.mockRejectedValueOnce(new Error("Synthetic exchange failure"));
      await expect(connect(w, state)).rejects.toThrow(
        "Synthetic exchange failure",
      );
      await expect(connect(w, state)).rejects.toMatchObject({ status: 400 });
      expect(exchange).toHaveBeenCalledTimes(1);
      await expect(connect(w, await start(w))).resolves.toMatchObject({
        connected: true,
      });
    });

    it("preserves partial scope connection", async () => {
      const w = await workspace();
      permissions.mockResolvedValue([]);
      await expect(connect(w, await start(w))).resolves.toMatchObject({
        status: "PARTIALLY_CONNECTED",
        scopes: ["BASIC_PROFILE"],
      });
      expect((await service.getIntegrations(w.user)).layoutCase).toBe(
        "PARTIAL_INSTAGRAM",
      );
    });

    it.each([
      ["OVERWRITE_HANDLE", true],
      ["CANCEL_CONNECT", true],
      ["OVERWRITE_HANDLE", false],
      ["CANCEL_CONNECT", false],
    ] as const)(
      "stages mismatch until explicit %s (prior active=%s)",
      async (resolution, active) => {
        const w = await workspace();
        const prior = active ? await connected(w) : null;
        const incomingToken = syntheticToken();
        exchange.mockResolvedValueOnce({
          accessToken: incomingToken,
          expiresInSeconds: 3600,
          permissions: ["instagram_business_basic"],
        });
        me.mockResolvedValue({
          ...(await graph.fetchMe(syntheticToken())),
          username: "otherbrand",
        });
        me.mockClear();
        const result = await connect(w, await start(w));
        expect(result).toMatchObject({
          conflict: true,
          code: "IDENTITY_CONFLICT",
          currentPlatformHandle: "@brand",
          inboundOauthHandle: "@otherbrand",
        });
        const row = await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: result.integrationId },
        });
        expect(row.isActive).toBe(active);
        expect(row.status).toBe(active ? "CONNECTED" : "DISCONNECTED");
        expect(
          row.accessTokenEncrypted === (prior?.accessTokenEncrypted ?? null),
        ).toBe(true);
        expect(
          decryptField(row.pendingAccessTokenEncrypted!) === incomingToken,
        ).toBe(true);
        expect(row.pendingAccessTokenEncrypted === incomingToken).toBe(false);
        expect(
          (
            await prisma.brandProfile.findUniqueOrThrow({
              where: { id: w.brand.id },
            })
          ).igHandle,
        ).toBe("brand");
        await service.resolveIdentityConflict(w.user, {
          integrationId: row.id,
          currentPlatformHandle: "@brand",
          inboundOauthHandle: "@otherbrand",
          resolution,
        });
        const resolved = await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(resolved).toMatchObject({
          pendingAccessTokenEncrypted: null,
          pendingGrantedScopes: [],
          pendingTokenExpiresAt: null,
        });
        if (resolution === "OVERWRITE_HANDLE") {
          expect(resolved).toMatchObject({
            isActive: true,
            status: "CONNECTED",
            currentPlatformHandle: "@otherbrand",
          });
          expect(
            decryptField(resolved.accessTokenEncrypted!) === incomingToken,
          ).toBe(true);
          expect(
            (
              await prisma.brandProfile.findUniqueOrThrow({
                where: { id: w.brand.id },
              })
            ).igHandle,
          ).toBe("otherbrand");
        } else {
          expect(resolved).toMatchObject({
            isActive: active,
            status: active ? "CONNECTED" : "DISCONNECTED",
            grantedScopes: prior?.grantedScopes ?? [],
          });
          expect(
            resolved.accessTokenEncrypted ===
              (prior?.accessTokenEncrypted ?? null),
          ).toBe(true);
          expect(
            (
              await prisma.brandProfile.findUniqueOrThrow({
                where: { id: w.brand.id },
              })
            ).igHandle,
          ).toBe("brand");
        }
      },
    );

    it("disconnect clears credentials; reconnect requires new state", async () => {
      const w = await workspace();
      const old = await start(w);
      const connected = await connect(w, old);
      await prisma.brandIntegration.update({
        where: { id: connected.integrationId },
        data: {
          pendingAccessTokenEncrypted: (
            await prisma.brandIntegration.findUniqueOrThrow({
              where: { id: connected.integrationId },
            })
          ).accessTokenEncrypted,
          pendingGrantedScopes: ["BASIC_PROFILE"],
          pendingTokenExpiresAt: new Date(Date.now() + 3600000),
        },
      });
      await service.manageAction(w.user, {
        integrationId: connected.integrationId,
        action: "DISCONNECT_INTEGRATION",
      });
      const row = await prisma.brandIntegration.findUniqueOrThrow({
        where: { id: connected.integrationId },
      });
      expect(row).toMatchObject({
        isActive: false,
        status: "DISCONNECTED",
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        pendingAccessTokenEncrypted: null,
        pendingGrantedScopes: [],
        pendingTokenExpiresAt: null,
      });
      expect(
        await service.manageAction(w.user, {
          integrationId: row.id,
          action: "RECONNECT",
        }),
      ).toMatchObject({ next: "START_OAUTH" });
      await expect(connect(w, old)).rejects.toMatchObject({ status: 400 });
      await expect(connect(w, await start(w))).resolves.toMatchObject({
        connected: true,
      });
    });

    it("credential removal requires confirmation and reports retained history", async () => {
      const w = await workspace();
      const row = await connected(w);
      await prisma.brandIntegration.update({
        where: { id: row.id },
        data: {
          pendingAccessTokenEncrypted: row.accessTokenEncrypted,
          pendingGrantedScopes: ["BASIC_PROFILE"],
          pendingTokenExpiresAt: row.tokenExpiresAt,
        },
      });
      await expect(
        service.manageAction(w.user, {
          integrationId: row.id,
          action: "DELETE_INGESTED_DATA",
        }),
      ).rejects.toMatchObject({ status: 400 });
      const result = await service.manageAction(w.user, {
        integrationId: row.id,
        action: "DELETE_INGESTED_DATA",
        confirmDeleteData: true,
      });
      expect(result).toMatchObject({
        disconnected: true,
        credentialsRemoved: true,
        futureIngestionStopped: true,
        historicalDataRetained: true,
      });
      expect("purged" in result).toBe(false);
      expect(
        await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        isActive: false,
        status: "DISCONNECTED",
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        grantedScopes: [],
        tokenExpiresAt: null,
        pendingAccessTokenEncrypted: null,
        pendingGrantedScopes: [],
        pendingTokenExpiresAt: null,
      });
      expect(
        await prisma.brandProfile.count({ where: { id: w.brand.id } }),
      ).toBe(1);
    });

    it.each(["missing", "inactive"])(
      "%s membership cannot initiate, connect, read or manage",
      async (kind) => {
        const w = await workspace();
        const row = await connected(w);
        const state = await start(w);
        exchange.mockClear();
        if (kind === "missing")
          await prisma.brandTeamMember.delete({
            where: { id: w.membership.id },
          });
        else
          await prisma.brandTeamMember.update({
            where: { id: w.membership.id },
            data: { isActive: false },
          });
        for (const operation of [
          () => start(w),
          () => connect(w, state),
          () => service.getIntegrations(w.user),
          () =>
            service.manageAction(w.user, {
              integrationId: row.id,
              action: "DISCONNECT_INTEGRATION",
            }),
          () =>
            service.resolveIdentityConflict(w.user, {
              integrationId: row.id,
              currentPlatformHandle: "@brand",
              inboundOauthHandle: "@other",
              resolution: "OVERWRITE_HANDLE",
            }),
        ])
          await expect(operation()).rejects.toMatchObject({ status: 403 });
        expect(exchange).not.toHaveBeenCalled();
      },
    );

    it("another Brand cannot manage or resolve an integration", async () => {
      const w = await workspace();
      const other = await workspace();
      const row = await connected(w);
      await expect(
        service.manageAction(other.user, {
          integrationId: row.id,
          action: "DISCONNECT_INTEGRATION",
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.resolveIdentityConflict(other.user, {
          integrationId: row.id,
          currentPlatformHandle: "@brand",
          inboundOauthHandle: "@other",
          resolution: "OVERWRITE_HANDLE",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("active campaign interlock blocks disconnect and credential removal", async () => {
      const w = await workspace();
      const row = await connected(w);
      const count = vi.spyOn(prisma.uceCampaign, "count").mockResolvedValue(1);
      try {
        for (const action of [
          "DISCONNECT_INTEGRATION",
          "DELETE_INGESTED_DATA",
        ] as const)
          await expect(
            service.manageAction(w.user, {
              integrationId: row.id,
              action,
              confirmDeleteData: true,
            }),
          ).rejects.toMatchObject({ status: 400 });
        expect(
          await prisma.brandIntegration.findUniqueOrThrow({
            where: { id: row.id },
          }),
        ).toMatchObject({ isActive: true, status: "CONNECTED" });
      } finally {
        count.mockRestore();
      }
    });

    it("expiry changes only expired active Instagram connections, including partial ones", async () => {
      const cases: {
        status: BrandIntegrationStatus;
        expired: boolean;
        active: boolean;
        provider?: "META_BUSINESS_SUITE";
      }[] = [
        { status: "CONNECTED", expired: true, active: true },
        { status: "PARTIALLY_CONNECTED", expired: true, active: true },
        { status: "CONNECTED", expired: false, active: true },
        { status: "CONNECTED", expired: true, active: false },
        { status: "DISCONNECTED", expired: true, active: true },
        {
          status: "CONNECTED",
          expired: true,
          active: true,
          provider: "META_BUSINESS_SUITE",
        },
      ];
      const rows = [];
      for (const c of cases) {
        const w = await workspace();
        rows.push(
          await prisma.brandIntegration.create({
            data: {
              brandProfileId: w.brand.id,
              provider: c.provider ?? "INSTAGRAM",
              status: c.status,
              isActive: c.active,
              currentPlatformHandle: "@brand",
              tokenExpiresAt: new Date(
                Date.now() + (c.expired ? -1000 : 3600000),
              ),
            },
          }),
        );
      }
      expect(await service.markExpiredTokens()).toEqual({
        scanned: 2,
        expired: 2,
      });
      for (let i = 0; i < rows.length; i++) {
        const current = await prisma.brandIntegration.findUniqueOrThrow({
          where: { id: rows[i].id },
        });
        expect(current.status).toBe(i < 2 ? "TOKEN_EXPIRED" : cases[i].status);
      }
    });

    it("expiry sweep does not overwrite a concurrent reconnect", async () => {
      const w = await workspace();
      const row = await connected(w);
      await prisma.brandIntegration.update({
        where: { id: row.id },
        data: { tokenExpiresAt: new Date(Date.now() - 1000) },
      });
      const original = prisma.brandIntegration.findMany.bind(
        prisma.brandIntegration,
      );
      // This test replaces a read-only query with an async race barrier; it is
      // never passed to a Prisma transaction and needs only the selected fields.
      const lookup = prisma.brandIntegration as unknown as {
        findMany(
          args?: Prisma.BrandIntegrationFindManyArgs,
        ): Promise<
          Pick<BrandIntegration, "id" | "brandProfileId" | "provider">[]
        >;
      };
      const find = vi
        .spyOn(lookup, "findMany")
        .mockImplementationOnce(async (args) => {
          const rows = await original(args);
          await prisma.brandIntegration.update({
            where: { id: row.id },
            data: { tokenExpiresAt: new Date(Date.now() + 3600000) },
          });
          return rows;
        });
      try {
        expect(await service.markExpiredTokens()).toEqual({
          scanned: 1,
          expired: 0,
        });
      } finally {
        find.mockRestore();
      }
      expect(
        (
          await prisma.brandIntegration.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).status,
      ).toBe("CONNECTED");
    });
  },
);

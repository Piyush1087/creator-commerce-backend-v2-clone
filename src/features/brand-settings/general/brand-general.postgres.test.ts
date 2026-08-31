import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaClient, type BrandRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { AuthSessionService } from "../../auth/auth-session.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { JwtStrategy } from "../../auth/jwt.strategy";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { BrandSettingsController } from "../brand-settings.controller";
import { UpdateBrandGeneralProfileSchema } from "../schemas/brand-settings.schema";
import { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import { BrandSettingsIntegrationsService } from "../services/brand-settings-integrations.service";
import { BrandSettingsService } from "../services/brand-settings.service";
import type { BrandTeamInvitationsService } from "../services/brand-team-invitations.service";
import { BrandTeamService } from "../services/brand-team.service";

const forbiddenMutations = [
  { name: "Changed Brand" },
  { brandName: "Changed Brand" },
  { display_name: "Changed Brand" },
  { domain: "other.example.test" },
  { countryCode: "US" },
  { currencyCode: "USD" },
  { organizationAddress: "Another billing address" },
  { taxId: "new-tax-id" },
  { taxId: null },
  { email: "other@example.test" },
  { organizationId: randomUUID() },
  { brandProfileId: randomUUID() },
];

describe("BS-01 General writable contract", () => {
  it("accepts only personal names and the operational Organization name", () => {
    const input = {
      firstName: "Ada",
      lastName: "Lovelace",
      organizationLegalName: "Workspace Name",
    };
    expect(UpdateBrandGeneralProfileSchema.parse(input)).toEqual(input);
  });
  it.each(forbiddenMutations)(
    "rejects non-General mutation %j, including mixed requests",
    (input) => {
      expect(UpdateBrandGeneralProfileSchema.safeParse(input).success).toBe(
        false,
      );
      expect(
        UpdateBrandGeneralProfileSchema.safeParse({
          firstName: "Allowed",
          ...input,
        }).success,
      ).toBe(false);
    },
  );
});

describe.skipIf(process.env.BS01_DATABASE_TEST !== "true")(
  "BS-01 disposable PostgreSQL and General HTTP",
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
    // General reads Team rows directly; invitation dispatch is outside this suite.
    const settings = new BrandSettingsService(
      db,
      access,
      new BrandTeamService(db, access),
      {} as BrandTeamInvitationsService,
    );
    const orgIds: string[] = [],
      brandIds: string[] = [],
      userIds: string[] = [];
    const secret = randomBytes(32).toString("hex");
    const authConfig = new ConfigService({
      JWT_SECRET: secret,
      JWT_ISSUER: "bs01-test-issuer",
      JWT_AUDIENCE: "bs01-test-audience",
      JWT_ACCESS_TTL: "15m",
      AUTH_REFRESH_TTL: "30d",
    });
    const jwt = new JwtService();
    const sessions = new AuthSessionService(db, jwt, authConfig);
    let app: INestApplication;
    let base: string;

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs01_")
      ) {
        throw new Error("BS-01 requires a disposable loopback bs01_* database");
      }
      // Vitest's TS transform omits constructor metadata; restore the production
      // controller signature so the real routes, pipes and JWT guard run over HTTP.
      Reflect.defineMetadata(
        "design:paramtypes",
        [BrandSettingsService, BrandSettingsIntegrationsService],
        BrandSettingsController,
      );
      const module = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
        controllers: [BrandSettingsController],
        providers: [
          { provide: BrandSettingsService, useValue: settings },
          { provide: BrandSettingsIntegrationsService, useValue: {} },
          {
            provide: JwtStrategy,
            useValue: new JwtStrategy(authConfig, sessions),
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(new JwtAuthGuard(new Reflector()))
        .compile();
      app = module.createNestApplication({ logger: false });
      await app.listen(0, "127.0.0.1");
      base = `${await app.getUrl()}/api/v1/brand/settings/general`;
    });

    afterAll(async () => {
      await app?.close();
      try {
        await prisma.teamInvitation.deleteMany({
          where: { brandProfileId: { in: brandIds } },
        });
        await prisma.brandProfile.deleteMany({
          where: { id: { in: brandIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      } finally {
        await prisma.$disconnect();
      }
    });

    async function workspace(
      role: BrandRole | "MISSING" | "INACTIVE" = "BRAND_OWNER",
      name: string | null = "Ada Byron Lovelace",
    ) {
      const org = await prisma.organization.create({
        data: { name: "Workspace Organization" },
      });
      orgIds.push(org.id);
      const brand = await prisma.brandProfile.create({
        data: {
          name: "Protected Brand",
          organizationId: org.id,
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          countryCode: "IN",
          currencyCode: "INR",
          logoUrl: "https://example.test/logo.png",
        },
      });
      brandIds.push(brand.id);
      const user = await prisma.user.create({
        data: {
          name,
          email: `${randomUUID()}@example.test`,
          role: "BRAND",
          organizationId: org.id,
          authState: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      userIds.push(user.id);
      if (role !== "MISSING")
        await prisma.brandTeamMember.create({
          data: {
            brandProfileId: brand.id,
            userId: user.id,
            role: role === "INACTIVE" ? "BRAND_OWNER" : role,
            isActive: role !== "INACTIVE",
          },
        });
      return { org, brand, user };
    }
    async function request(user?: AuthUser, input?: unknown) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user) {
        const session = await sessions.create(user.id);
        headers.Authorization = `Bearer ${session.accessToken}`;
      }
      return fetch(base, {
        method: input === undefined ? "GET" : "PATCH",
        headers,
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      });
    }
    async function protectedState(id: string) {
      return prisma.brandProfile.findUniqueOrThrow({
        where: { id },
        select: {
          name: true,
          domain: true,
          countryCode: true,
          currencyCode: true,
          industry: true,
          organizationId: true,
        },
      });
    }

    it("GET separates organization from Brand identity and preserves the Team payload", async () => {
      const w = await workspace();
      const invitation = await prisma.teamInvitation.create({
        data: {
          brandProfileId: w.brand.id,
          email: "invite@example.test",
          role: "FINANCE_ADMIN",
          token: randomUUID(),
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const response = await request(w.user);
      expect(response.status).toBe(200);
      const general = (await response.json()) as Awaited<
        ReturnType<BrandSettingsService["getGeneral"]>
      >;
      expect(general.personal_profile).toEqual({
        first_name: "Ada",
        last_name: "Byron Lovelace",
        email: w.user.email,
        avatar_url: null,
      });
      expect(general.organization).toEqual({
        company_legal_name: w.org.name,
        corporate_address: null,
        tax_id: null,
        country_code: "IN",
        currency_code: "INR",
      });
      expect(general.brand_identity).toEqual({
        display_name: w.brand.name,
        website_url: w.brand.domain,
        logo_url: w.brand.logoUrl,
        is_locked: true,
      });
      expect(general.team.members).toEqual([
        expect.objectContaining({
          user_id: w.user.id,
          role: "BRAND_OWNER",
          is_current_user: true,
        }),
      ]);
      expect(general.team.pending_invitations).toEqual([
        expect.objectContaining({
          invitation_id: invitation.id,
          role: "FINANCE_ADMIN",
        }),
      ]);
      expect(general.team.seat_usage).toEqual({
        active_members: 1,
        pending_invitations: 1,
        max_seats: 5,
      });
    });
    it.each(["BRAND_OWNER", "FINANCE_ADMIN"] as const)(
      "%s persists the operational Organization name without changing protected identity",
      async (role) => {
        const w = await workspace(role);
        const before = await protectedState(w.brand.id);
        const response = await request(w.user, {
          organizationLegalName: "New Workspace Name",
        });
        expect(response.status).toBe(200);
        expect(
          (await settings.getGeneral(w.user)).organization.company_legal_name,
        ).toBe("New Workspace Name");
        expect(
          (
            await prisma.organization.findUniqueOrThrow({
              where: { id: w.org.id },
            })
          ).name,
        ).toBe("New Workspace Name");
        expect(await protectedState(w.brand.id)).toEqual(before);
      },
    );
    it.each(["BRAND_OWNER", "FINANCE_ADMIN", "CAMPAIGN_MANAGER"] as const)(
      "%s may update their own personal name",
      async (role) => {
        const w = await workspace(role, "Ada Lovelace");
        const response = await request(w.user, { firstName: "Grace" });
        expect(response.status).toBe(200);
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: w.user.id } }))
            .name,
        ).toBe("Grace Lovelace");
      },
    );
    it.each([
      {
        before: "Ada Byron Lovelace",
        input: { firstName: "Grace" },
        after: "Grace Byron Lovelace",
      },
      {
        before: "Ada Byron Lovelace",
        input: { lastName: "Hopper" },
        after: "Ada Hopper",
      },
      {
        before: "Ada Lovelace",
        input: { firstName: "Grace", lastName: "Hopper" },
        after: "Grace Hopper",
      },
      { before: "Ada", input: { lastName: "Lovelace" }, after: "Ada Lovelace" },
      { before: null, input: { firstName: "Ada" }, after: "Ada" },
      {
        before: "  Ada   Byron  Lovelace  ",
        input: { firstName: "Grace" },
        after: "Grace Byron Lovelace",
      },
    ])(
      "preserves personal name update $before -> $after",
      async ({ before, input, after }) => {
        const w = await workspace("BRAND_OWNER", before);
        expect((await request(w.user, input)).status).toBe(200);
        const stored = await prisma.user.findUniqueOrThrow({
          where: { id: w.user.id },
        });
        expect(stored.name).toBe(after);
        expect(stored.email).toBe(w.user.email);
      },
    );
    it.each(forbiddenMutations)(
      "HTTP rejects %j atomically with 400",
      async (input) => {
        const w = await workspace();
        const before = await protectedState(w.brand.id);
        const response = await request(w.user, {
          organizationLegalName: "Must not persist",
          firstName: "Must not persist",
          ...input,
        });
        expect(response.status).toBe(400);
        expect(await protectedState(w.brand.id)).toEqual(before);
        expect(
          (
            await prisma.organization.findUniqueOrThrow({
              where: { id: w.org.id },
            })
          ).name,
        ).toBe(w.org.name);
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: w.user.id } }))
            .name,
        ).toBe(w.user.name);
        expect(
          await prisma.brandBillingProfile.count({
            where: { brandProfileId: w.brand.id },
          }),
        ).toBe(0);
      },
    );
    it("denies Campaign Manager organization and mixed mutations atomically", async () => {
      const w = await workspace("CAMPAIGN_MANAGER", "Ada Lovelace");
      const beforeBrand = await protectedState(w.brand.id);

      expect(
        (await request(w.user, { organizationLegalName: "Denied" })).status,
      ).toBe(403);
      expect(
        (
          await request(w.user, {
            firstName: "Must not persist",
            organizationLegalName: "Denied",
          })
        ).status,
      ).toBe(403);

      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: w.user.id } }))
          .name,
      ).toBe(w.user.name);
      expect(
        (
          await prisma.organization.findUniqueOrThrow({
            where: { id: w.org.id },
          })
        ).name,
      ).toBe(w.org.name);
      expect(await protectedState(w.brand.id)).toEqual(beforeBrand);
    });
    it.each(["MISSING", "INACTIVE"] as const)(
      "denies %s mutations through workspace admission",
      async (role) => {
        const w = await workspace(role);
        const memberships = await prisma.brandTeamMember.findMany({
          where: { brandProfileId: w.brand.id },
        });
        expect(
          (await request(w.user, { organizationLegalName: "Denied" })).status,
        ).toBe(403);
        expect((await request(w.user, { firstName: "Denied" })).status).toBe(
          403,
        );
        expect((await request(w.user)).status).toBe(403);
        expect(
          await prisma.brandTeamMember.findMany({
            where: { brandProfileId: w.brand.id },
          }),
        ).toEqual(memberships);
        expect(
          (
            await prisma.organization.findUniqueOrThrow({
              where: { id: w.org.id },
            })
          ).name,
        ).toBe(w.org.name);
      },
    );
    it("requires authentication and ignores a forged foreign organization scope", async () => {
      const a = await workspace(),
        b = await workspace();
      expect((await request()).status).toBe(401);
      expect(
        (await request(undefined, { organizationLegalName: "Denied" })).status,
      ).toBe(401);
      const foreignScope = { ...a.user, organizationId: b.org.id };
      expect((await request(foreignScope)).status).toBe(200);
      expect(
        (await request(foreignScope, { organizationLegalName: "Denied" }))
          .status,
      ).toBe(200);
      expect(
        (await request(a.user, { organizationLegalName: "Only A" })).status,
      ).toBe(200);
      expect(
        (
          await prisma.organization.findUniqueOrThrow({
            where: { id: b.org.id },
          })
        ).name,
      ).toBe(b.org.name);
      expect((await protectedState(b.brand.id)).name).toBe(b.brand.name);
    });
  },
);

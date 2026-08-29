import "reflect-metadata";
import { randomBytes, randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { BrandRole, PrismaClient, UserRole } from "@prisma/client";
import type { ServerClient } from "postmark";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MailService } from "../../../mail/mail.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import { AuthService } from "../../auth/auth.service";
import { BrandVerificationService } from "../../brand-onboarding/verification/brand-verification.service";
import type { GoogleAuthService } from "../../auth/google-auth.service";
import type { BrandCentreScanService } from "../../brand-centre/services/brand-centre-scan.service";
import { BrandCentreAuthService } from "../../brand-centre/brand-centre-auth.service";
import { BrandCentreSessionEvictionService } from "../../brand-centre/services/brand-centre-session-eviction.service";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { BrandSettingsAccessService } from "../services/brand-settings-access.service";
import { BrandSettingsService } from "../services/brand-settings.service";
import { BrandTeamService } from "../services/brand-team.service";
import {
  BrandTeamInvitationsService,
  hashInvitationToken,
} from "../services/brand-team-invitations.service";
import { establishInitialBrandOwner } from "./initial-brand-owner";
import { recognizedAnchorOwnerCount } from "./brand-team-policy";

describe.skipIf(process.env.BS02_DATABASE_TEST !== "true")(
  "BS-02 disposable PostgreSQL",
  () => {
    const prisma = new PrismaClient({
      log: [{ emit: "event", level: "query" }],
    });
    const queries: string[] = [];
    prisma.$on("query", (event) => queries.push(event.query));
    const db = prisma as unknown as PrismaService;
    const jwt = new JwtService({ secret: randomBytes(32).toString("hex") });
    const auth = new AuthService(db, jwt);
    const workspaceAuth = new BrandWorkspaceAuthorizationService(
      db,
      new BrandCentreAuthService(db, new BrandCentreSessionEvictionService(db)),
    );
    const access = new BrandSettingsAccessService(db, workspaceAuth);
    const send = vi.fn().mockResolvedValue({ ErrorCode: 0 });
    // Narrow provider fake: only sendEmailWithTemplate is exercised, no network.
    const mail = new MailService({
      sendEmailWithTemplate: send,
    } as unknown as ServerClient);
    const invitations = new BrandTeamInvitationsService(db, access, auth, mail);
    const team = new BrandTeamService(db, access);
    const settings = new BrandSettingsService(db, access, team, invitations);
    const brandIds: string[] = [],
      userIds: string[] = [],
      orgIds: string[] = [];
    const roles = Object.values(BrandRole);
    const freshEmail = () => `${randomUUID()}@example.test`;
    const externalEmail = () => `${randomUUID()}@agency.invalid`;
    const password = () => randomBytes(18).toString("base64url");

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/bs02_")
      )
        throw new Error("BS-02 requires a disposable loopback bs02_* database");
      vi.stubEnv("POSTMARK_TEAM_INVITE_TEMPLATE_ID", "1");
      vi.stubEnv("APP_FRONTEND_URL", "http://localhost:5173");
    });
    beforeEach(() => {
      send.mockReset().mockResolvedValue({ ErrorCode: 0 });
    });
    afterAll(async () => {
      try {
        await prisma.teamInvitation.deleteMany({
          where: { brandProfileId: { in: brandIds } },
        });
        await prisma.brandProfile.deleteMany({
          where: { id: { in: brandIds } },
        });
        await prisma.user.deleteMany({
          where: {
            OR: [{ id: { in: userIds } }, { organizationId: { in: orgIds } }],
          },
        });
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      } finally {
        await prisma.$disconnect();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
      }
    });
    async function workspace(role: BrandRole = "BRAND_OWNER") {
      const org = await prisma.organization.create({
        data: { name: "BS-02 fixture" },
      });
      orgIds.push(org.id);
      const brand = await prisma.brandProfile.create({
        data: {
          name: "Invited Brand",
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          organizationId: org.id,
          isVerified: true,
        },
      });
      brandIds.push(brand.id);
      const user = await prisma.user.create({
        data: { email: freshEmail(), role: "BRAND", organizationId: org.id },
      });
      userIds.push(user.id);
      const membership = await prisma.brandTeamMember.create({
        data: { brandProfileId: brand.id, userId: user.id, role },
      });
      return { org, brand, user, membership };
    }
    async function member(
      w: Awaited<ReturnType<typeof workspace>>,
      role: BrandRole,
      active = true,
      email = freshEmail(),
    ) {
      const user = await prisma.user.create({
        data: { email, role: "BRAND", organizationId: w.org.id },
      });
      userIds.push(user.id);
      const membership = await prisma.brandTeamMember.create({
        data: {
          brandProfileId: w.brand.id,
          userId: user.id,
          role,
          isActive: active,
        },
      });
      return { user, membership };
    }
    async function anchorCount(brandProfileId: string) {
      return prisma.$transaction((tx) =>
        recognizedAnchorOwnerCount(tx, brandProfileId),
      );
    }
    async function legacy(
      w: Awaited<ReturnType<typeof workspace>>,
      email = freshEmail(),
      role = "CAMPAIGN_MANAGER",
      options: { status?: string; expired?: boolean; hashed?: boolean } = {},
    ) {
      const raw = randomBytes(32).toString("hex");
      const row = await prisma.teamInvitation.create({
        data: {
          email,
          brandProfileId: w.brand.id,
          role,
          token: options.hashed ? hashInvitationToken(raw) : raw,
          status: options.status ?? "PENDING",
          expiresAt: new Date(
            Date.now() + (options.expired ? -1000 : 86400000),
          ),
        },
      });
      return { raw, row };
    }
    function sentToken() {
      const payload = send.mock.calls.at(-1)?.[0] as {
        TemplateModel: { acceptance_url: string };
      };
      return new URLSearchParams(
        new URL(payload.TemplateModel.acceptance_url).hash.slice(1),
      ).get("token")!;
    }

    it.each(roles.flatMap((actor) => roles.map((role) => ({ actor, role }))))(
      "$actor inviting $role",
      async ({ actor, role }) => {
        const w = await workspace(actor),
          email = freshEmail();
        const operation = invitations.create(w.user, { email, role });
        if (
          actor === "BRAND_OWNER" ||
          (actor === "FINANCE_ADMIN" && role !== "BRAND_OWNER")
        ) {
          const result = await operation;
          expect(result.delivery_status).toBe("DISPATCHED");
          const stored = await prisma.teamInvitation.findUniqueOrThrow({
            where: { id: result.invitation_id },
          });
          expect(stored.token).toBe(hashInvitationToken(sentToken()));
          expect(
            stored.expiresAt.getTime() - stored.createdAt.getTime(),
          ).toBeGreaterThan(6.99 * 86400000);
          expect(stored.role).toBe(role);
        } else {
          await expect(operation).rejects.toThrow();
          expect(send).not.toHaveBeenCalled();
        }
      },
    );
    it("prevents active-member and concurrent pending duplicates case-insensitively", async () => {
      const w = await workspace();
      await expect(
        invitations.create(w.user, {
          email: w.user.email.toUpperCase(),
          role: "BRAND_OWNER",
        }),
      ).rejects.toThrow("active workspace member");
      const email = freshEmail();
      const results = await Promise.allSettled([
        invitations.create(w.user, { email, role: "FINANCE_ADMIN" }),
        invitations.create(w.user, {
          email: email.toUpperCase(),
          role: "FINANCE_ADMIN",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.teamInvitation.count({
          where: { brandProfileId: w.brand.id },
        }),
      ).toBe(1);
      expect(
        await prisma.teamInvitation.findFirstOrThrow({
          where: { brandProfileId: w.brand.id },
        }),
      ).toMatchObject({ status: "PENDING" });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(1);
      expect(await anchorCount(w.brand.id)).toBe(1);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: w.user.id } }))
          .organizationId,
      ).toBe(w.org.id);
    });
    it.each(["throw", "provider-code", "missing-config"])(
      "mail %s rolls back without leaking raw payloads",
      async (mode) => {
        const w = await workspace();
        const logs = [
          vi.spyOn(Logger.prototype, "log"),
          vi.spyOn(Logger.prototype, "error"),
          vi.spyOn(Logger.prototype, "warn"),
          vi.spyOn(Logger.prototype, "debug"),
        ];
        if (mode === "throw")
          send.mockImplementationOnce(async (payload) => {
            throw new Error(JSON.stringify(payload));
          });
        if (mode === "provider-code")
          send.mockResolvedValueOnce({ ErrorCode: 300 });
        if (mode === "missing-config")
          vi.stubEnv("POSTMARK_TEAM_INVITE_TEMPLATE_ID", "");
        await expect(
          invitations.create(w.user, {
            email: freshEmail(),
            role: "CAMPAIGN_MANAGER",
          }),
        ).rejects.toThrow("No active invitation was created");
        expect(
          await prisma.teamInvitation.count({
            where: { brandProfileId: w.brand.id },
          }),
        ).toBe(0);
        if (send.mock.calls.length) {
          const raw = sentToken();
          for (const log of logs)
            expect(JSON.stringify(log.mock.calls)).not.toContain(raw);
        }
        for (const log of logs) log.mockRestore();
        vi.stubEnv("POSTMARK_TEAM_INVITE_TEMPLATE_ID", "1");
      },
    );
    it.each([true, false])(
      "accepts hashed=%s token and creates verified password-hashed Brand user + JWT",
      async (hashed) => {
        const w = await workspace();
        const invite = await legacy(w, freshEmail(), "ADMIN", { hashed });
        const plain = password();
        const presentation = await invitations.inspect(invite.raw);
        expect(presentation.requires_account_bootstrap).toBe(true);
        expect(presentation.role).toBe("BRAND_OWNER");
        expect(JSON.stringify(presentation)).not.toContain(invite.raw);
        const result = await invitations.accept({
          token: invite.raw,
          password: plain,
        });
        userIds.push(result.user.id);
        const user = await prisma.user.findUniqueOrThrow({
          where: { id: result.user.id },
        });
        expect(user.role).toBe("BRAND");
        expect(user.organizationId).toBe(w.org.id);
        expect(user.emailVerifiedAt).not.toBeNull();
        expect(user.hashedPassword).not.toBe(plain);
        expect(auth.verifyPassword(plain, user.hashedPassword!)).toBe(true);
        expect(
          (await auth.login({ email: user.email, password: plain })).user.id,
        ).toBe(user.id);
        expect(jwt.verify(result.accessToken).sub).toBe(user.id);
        expect(
          await prisma.brandTeamMember.findFirst({
            where: { userId: user.id, brandProfileId: w.brand.id },
          }),
        ).toMatchObject({ role: "BRAND_OWNER", isActive: true });
        expect(
          await prisma.teamInvitation.findUnique({
            where: { id: invite.row.id },
          }),
        ).toMatchObject({ status: "ACCEPTED" });
        await expect(
          invitations.accept({ token: invite.raw, password: plain }),
        ).rejects.toThrow("already been accepted");
      },
    );
    it.each([
      { status: "PENDING", expired: true },
      { status: "EXPIRED" },
      { status: "ACCEPTED" },
    ])("rejects $status expired=$expired", async (options) => {
      const w = await workspace();
      const invite = await legacy(w, freshEmail(), "CAMPAIGN_MANAGER", options);
      await expect(invitations.inspect(invite.raw)).rejects.toThrow();
      await expect(
        invitations.accept({ token: invite.raw, password: password() }),
      ).rejects.toThrow();
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id },
        }),
      ).toBe(1);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });
    it("rejects invalid raw token, digest-as-token and missing new-account password", async () => {
      const w = await workspace();
      const invite = await legacy(w, freshEmail(), "CAMPAIGN_MANAGER", {
        hashed: true,
      });
      await expect(
        invitations.inspect(randomBytes(32).toString("hex")),
      ).rejects.toThrow("Invalid invitation");
      await expect(invitations.inspect(invite.row.token)).rejects.toThrow(
        "Invalid invitation",
      );
      await expect(invitations.accept({ token: invite.raw })).rejects.toThrow(
        "initial password",
      );
    });
    it.each([
      "same-org",
      "unassigned",
      "other-org",
      "non-brand",
      "inactive",
      "active",
    ])("existing recipient %s", async (kind) => {
      const w = await workspace();
      const other = kind === "other-org" ? await workspace() : null;
      const user = await prisma.user.create({
        data: {
          email: freshEmail(),
          role: kind === "non-brand" ? "CREATOR" : "BRAND",
          organizationId:
            kind === "unassigned" ? null : (other?.org.id ?? w.org.id),
        },
      });
      userIds.push(user.id);
      if (kind === "active" || kind === "inactive")
        await prisma.brandTeamMember.create({
          data: {
            brandProfileId: w.brand.id,
            userId: user.id,
            role: "CAMPAIGN_MANAGER",
            isActive: kind === "active",
          },
        });
      const invite = await legacy(w, user.email, "FINANCE_ADMIN");
      if (kind === "other-org" || kind === "non-brand") {
        await expect(invitations.accept({ token: invite.raw })).rejects.toThrow(
          "cannot join",
        );
        return;
      }
      expect(
        (await invitations.inspect(invite.raw)).requires_account_bootstrap,
      ).toBe(false);
      const result = await invitations.accept({ token: invite.raw });
      expect(result.user.organizationId).toBe(w.org.id);
      const memberships = await prisma.brandTeamMember.findMany({
        where: { brandProfileId: w.brand.id, userId: user.id },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        isActive: true,
        role: kind === "active" ? "CAMPAIGN_MANAGER" : "FINANCE_ADMIN",
      });
    });
    it("serializes simultaneous acceptance and preserves single use", async () => {
      const w = await workspace();
      const invite = await legacy(w);
      const plain = password();
      const results = await Promise.allSettled([
        invitations.accept({ token: invite.raw, password: plain }),
        invitations.accept({ token: invite.raw, password: plain }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.user.count({ where: { email: invite.row.email } }),
      ).toBe(1);
      expect(
        await prisma.teamInvitation.findUniqueOrThrow({
          where: { id: invite.row.id },
        }),
      ).toMatchObject({ status: "ACCEPTED" });
      const admitted = await prisma.user.findUniqueOrThrow({
        where: { email: invite.row.email },
      });
      expect(admitted.organizationId).toBe(w.org.id);
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(2);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });
    it("serializes unassigned recipient accepting across different organizations", async () => {
      const a = await workspace(),
        b = await workspace();
      const user = await prisma.user.create({
        data: { email: freshEmail(), role: "BRAND" },
      });
      userIds.push(user.id);
      const ia = await legacy(a, user.email),
        ib = await legacy(b, user.email);
      const results = await Promise.allSettled([
        invitations.accept({ token: ia.raw }),
        invitations.accept({ token: ib.raw }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.brandTeamMember.count({ where: { userId: user.id } }),
      ).toBe(1);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
          .organizationId,
      ).toMatch(new RegExp(`^(${a.org.id}|${b.org.id})$`));
      expect(await anchorCount(a.brand.id)).toBe(1);
      expect(await anchorCount(b.brand.id)).toBe(1);
      expect(
        await prisma.teamInvitation.count({
          where: { id: { in: [ia.row.id, ib.row.id] }, status: "ACCEPTED" },
        }),
      ).toBe(1);
      expect(
        await prisma.teamInvitation.count({
          where: { id: { in: [ia.row.id, ib.row.id] }, status: "PENDING" },
        }),
      ).toBe(1);
    });
    it.each(
      roles.flatMap((actor) =>
        roles.flatMap((target) =>
          roles.map((next) => ({ actor, target, next })),
        ),
      ),
    )("$actor mutating $target to $next", async ({ actor, target, next }) => {
      const w = await workspace(actor),
        t = await member(w, target);
      const operation = team.updateRole(w.user, {
        membershipId: t.membership.id,
        role: next,
      });
      if (
        actor === "BRAND_OWNER" ||
        (actor === "FINANCE_ADMIN" &&
          target !== "BRAND_OWNER" &&
          next !== "BRAND_OWNER")
      )
        expect((await operation).role).toBe(next);
      else await expect(operation).rejects.toThrow();
    });
    it.each(
      roles.flatMap((actor) => roles.map((target) => ({ actor, target }))),
    )("$actor removing/cancelling $target", async ({ actor, target }) => {
      const w = await workspace(actor),
        t = await member(w, target),
        invite = await legacy(
          w,
          freshEmail(),
          target === "BRAND_OWNER" ? "ADMIN" : target,
        );
      if (
        actor === "BRAND_OWNER" ||
        (actor === "FINANCE_ADMIN" && target !== "BRAND_OWNER")
      ) {
        await expect(
          team.revoke(w.user, t.membership.id),
        ).resolves.toMatchObject({ revoked: true });
        await expect(team.cancel(w.user, invite.row.id)).resolves.toMatchObject(
          { cancelled: true },
        );
      } else {
        await expect(team.revoke(w.user, t.membership.id)).rejects.toThrow();
        await expect(team.cancel(w.user, invite.row.id)).rejects.toThrow();
      }
    });
    it("protects self revoke, last Owner, and concurrent demotions of two Owners", async () => {
      const w = await workspace();
      await expect(team.revoke(w.user, w.membership.id)).rejects.toThrow(
        "own access",
      );
      await expect(
        team.updateRole(w.user, {
          membershipId: w.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ).rejects.toThrow("At least one");
      const second = await member(w, "BRAND_OWNER");
      const results = await Promise.allSettled([
        team.updateRole(w.user, {
          membershipId: w.membership.id,
          role: "FINANCE_ADMIN",
        }),
        team.updateRole(second.user, {
          membershipId: second.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.brandTeamMember.count({
          where: {
            brandProfileId: w.brand.id,
            role: "BRAND_OWNER",
            isActive: true,
          },
        }),
      ).toBe(1);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });
    it("denies cross-Brand member and invitation targets", async () => {
      const a = await workspace(),
        b = await workspace(),
        invite = await legacy(b);
      await expect(
        team.updateRole(a.user, {
          membershipId: b.membership.id,
          role: "CAMPAIGN_MANAGER",
        }),
      ).rejects.toThrow("not found");
      await expect(team.revoke(a.user, b.membership.id)).rejects.toThrow(
        "not found",
      );
      await expect(team.cancel(a.user, invite.row.id)).rejects.toThrow(
        "not found",
      );
    });
    it.each(["missing", "BRAND_OWNER", "FINANCE_ADMIN"])(
      "%s membership cannot authorize any Settings mutation or create membership",
      async (kind) => {
        const w = await workspace(
          kind === "FINANCE_ADMIN" ? "FINANCE_ADMIN" : "BRAND_OWNER",
        );
        if (kind === "missing")
          await prisma.brandTeamMember.delete({
            where: { id: w.membership.id },
          });
        else
          await prisma.brandTeamMember.update({
            where: { id: w.membership.id },
            data: { isActive: false },
          });
        const start = queries.length;
        const operations = [
          () => access.resolveBrandContext(w.user),
          () => access.ensureMembership(w.brand.id, w.user),
          () =>
            settings.updateGeneral(w.user, { organizationLegalName: "Denied" }),
          () =>
            settings.upsertBillingProfile(w.user, {
              legalEntityName: "Denied Entity",
              legalEntityType: "Corporation",
              billingCountryCode: "IN",
              billingAddress: "Denied address",
              gstin: null,
            }),
          () =>
            settings.linkWithdrawalAccount(w.user, {
              beneficiaryName: "Denied",
              bankName: "Denied",
              accountNumber: "123456789",
              confirmAccountNumber: "123456789",
              ifscCode: "ABCD0123456",
            }),
          () => settings.updateNotifications(w.user, { settings: [] }),
          () =>
            settings.inviteTeamMember(w.user, {
              email: freshEmail(),
              role: "CAMPAIGN_MANAGER",
            }),
        ];
        for (const operation of operations)
          await expect(operation()).rejects.toThrow(
            "Active Brand team membership required",
          );
        expect(
          queries
            .slice(start)
            .filter(
              (query) =>
                query.includes('"brand_team_members"') &&
                /\b(INSERT|UPDATE|DELETE)\b/i.test(query),
            ),
        ).toEqual([]);
      },
    );
    async function activationProfile(verified: boolean) {
      const email = freshEmail();
      const profile = await prisma.brandProfile.create({
        data: {
          name: "First activation",
          domain: `${randomUUID()}.example.test`,
          industry: "D2C",
          isVerified: verified,
          verificationEmail: email,
          identityConfirmedAt: new Date(),
        },
      });
      brandIds.push(profile.id);
      return { profile, email };
    }

    it.each(["password", "complete"])(
      "%s activation reuses an unclaimed organization but rejects another Brand's organization",
      async (path) => {
        for (const claimed of [false, true]) {
          const { profile, email } = await activationProfile(
            path === "complete",
          );
          const org = await prisma.organization.create({
            data: { name: "Existing activation organization" },
          });
          orgIds.push(org.id);
          const user = await prisma.user.create({
            data: { email, role: "BRAND", organizationId: org.id },
          });
          userIds.push(user.id);
          if (claimed) {
            const other = await prisma.brandProfile.create({
              data: {
                name: "Other Brand",
                domain: `${randomUUID()}.example.test`,
                industry: "D2C",
                organizationId: org.id,
                isVerified: true,
              },
            });
            brandIds.push(other.id);
          }
          const verify = new BrandVerificationService(
            db,
            mail,
            {
              enqueueOnboardingDeepScan: vi
                .fn()
                .mockResolvedValue({ jobId: randomUUID() }),
            } as unknown as BrandCentreScanService,
            auth,
            {} as GoogleAuthService,
          );
          const operation =
            path === "complete"
              ? auth.completeBrandRegistration({ brandProfileId: profile.id })
              : verify.setPasswordAndActivate(profile.id, email, password());
          if (claimed)
            await expect(operation).rejects.toThrow("another Brand workspace");
          else {
            expect((await operation).organizationId).toBe(org.id);
            expect(
              await prisma.brandTeamMember.findFirst({
                where: { brandProfileId: profile.id, userId: user.id },
              }),
            ).toMatchObject({ role: "BRAND_OWNER", isActive: true });
          }
        }
      },
    );

    it("concurrent cancellation and acceptance cannot both consume an invitation", async () => {
      const w = await workspace();
      const invite = await legacy(w);
      const results = await Promise.allSettled([
        team.cancel(w.user, invite.row.id),
        invitations.accept({ token: invite.raw, password: password() }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const row = await prisma.teamInvitation.findUniqueOrThrow({
        where: { id: invite.row.id },
      });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id },
        }),
      ).toBe(row.status === "ACCEPTED" ? 2 : 1);
      expect(["ACCEPTED", "CANCELLED"]).toContain(row.status);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it("concurrent Owner removals preserve an active Owner and recheck actor authority", async () => {
      const w = await workspace();
      const second = await member(w, "BRAND_OWNER");
      const results = await Promise.allSettled([
        team.revoke(w.user, second.membership.id),
        team.revoke(second.user, w.membership.id),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.brandTeamMember.count({
          where: {
            brandProfileId: w.brand.id,
            role: "BRAND_OWNER",
            isActive: true,
          },
        }),
      ).toBe(1);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it("expired pending invites do not permanently consume seats", async () => {
      const w = await workspace();
      for (let i = 0; i < 5; i++)
        await legacy(w, freshEmail(), "CAMPAIGN_MANAGER", { expired: true });
      await expect(
        invitations.create(w.user, {
          email: freshEmail(),
          role: "CAMPAIGN_MANAGER",
        }),
      ).resolves.toMatchObject({ delivery_status: "DISPATCHED" });
      expect(
        (await settings.getGeneral(w.user)).team.pending_invitations,
      ).toHaveLength(1);
    });

    it("password activation cannot grant an extra Owner when an active team already exists", async () => {
      const w = await workspace();
      const email = freshEmail();
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: {
          isVerified: false,
          identityConfirmedAt: new Date(),
          verificationEmail: email,
        },
      });
      const verify = new BrandVerificationService(
        db,
        mail,
        {
          enqueueOnboardingDeepScan: vi
            .fn()
            .mockResolvedValue({ jobId: randomUUID() }),
        } as unknown as BrandCentreScanService,
        auth,
        {} as GoogleAuthService,
      );
      const result = await verify.setPasswordAndActivate(
        w.brand.id,
        email,
        password(),
      );
      userIds.push(result.user.id);
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id },
        }),
      ).toBe(1);
      await expect(access.resolveBrandContext(result.user)).rejects.toThrow(
        "Active Brand team membership required",
      );
    });

    it("successful dispatch does not log the bearer token or expose it in the API", async () => {
      const w = await workspace();
      const logs = [
        vi.spyOn(Logger.prototype, "log"),
        vi.spyOn(Logger.prototype, "warn"),
        vi.spyOn(Logger.prototype, "error"),
        vi.spyOn(Logger.prototype, "debug"),
      ];
      try {
        const result = await invitations.create(w.user, {
          email: freshEmail(),
          role: "FINANCE_ADMIN",
        });
        const raw = sentToken();
        expect(JSON.stringify(result)).not.toContain(raw);
        for (const log of logs)
          expect(JSON.stringify(log.mock.calls)).not.toContain(raw);
      } finally {
        for (const log of logs) log.mockRestore();
      }
    });
    it("setPasswordAndActivate creates the initial Owner in the activation transaction", async () => {
      const { profile, email } = await activationProfile(false);
      const scan = {
        enqueueOnboardingDeepScan: vi
          .fn()
          .mockResolvedValue({ jobId: randomUUID() }),
      };
      const verify = new BrandVerificationService(
        db,
        mail,
        scan as unknown as BrandCentreScanService,
        auth,
        {} as GoogleAuthService,
      );
      const result = await verify.setPasswordAndActivate(
        profile.id,
        email,
        password(),
      );
      orgIds.push(result.organizationId);
      userIds.push(result.user.id);
      expect(
        await prisma.brandTeamMember.findFirst({
          where: { brandProfileId: profile.id },
        }),
      ).toMatchObject({
        userId: result.user.id,
        role: "BRAND_OWNER",
        isActive: true,
      });
      expect(await anchorCount(profile.id)).toBe(1);
      await expect(
        verify.setPasswordAndActivate(profile.id, email, password()),
      ).rejects.toThrow("already activated");
    });
    it("completeBrandRegistration bootstraps once, preserving an existing active team's role", async () => {
      const { profile } = await activationProfile(true);
      const result = await auth.completeBrandRegistration({
        brandProfileId: profile.id,
      });
      orgIds.push(result.organizationId);
      userIds.push(result.user.id);
      await auth.completeBrandRegistration({ brandProfileId: profile.id });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: profile.id },
        }),
      ).toBe(1);
      expect(await anchorCount(profile.id)).toBe(1);
      await prisma.brandTeamMember.updateMany({
        where: { brandProfileId: profile.id },
        data: { role: "CAMPAIGN_MANAGER" },
      });
      await auth.completeBrandRegistration({ brandProfileId: profile.id });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: profile.id, role: "BRAND_OWNER" },
        }),
      ).toBe(0);
    });
    it("controlled historical repair requires unambiguous verified linkage and never reactivates", async () => {
      const w = await workspace();
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: { verificationEmail: w.user.email },
      });
      await prisma.brandTeamMember.delete({ where: { id: w.membership.id } });
      expect(
        await prisma.$transaction((tx) =>
          establishInitialBrandOwner(tx, w.brand.id, w.user.id, false),
        ),
      ).toBe("ELIGIBLE");
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id },
        }),
      ).toBe(0);
      expect(
        await prisma.$transaction((tx) =>
          establishInitialBrandOwner(tx, w.brand.id, w.user.id),
        ),
      ).toBe("CREATED");
      await prisma.brandTeamMember.updateMany({
        where: { brandProfileId: w.brand.id },
        data: { isActive: false },
      });
      expect(
        await prisma.$transaction((tx) =>
          establishInitialBrandOwner(tx, w.brand.id, w.user.id),
        ),
      ).toBe("EXISTING_TEAM");
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: { verificationEmail: freshEmail() },
      });
      expect(
        await prisma.$transaction((tx) =>
          establishInitialBrandOwner(tx, w.brand.id, w.user.id),
        ),
      ).toBe("AMBIGUOUS_IDENTITY");
    });

    it.each([
      ["BRAND_OWNER", true],
      ["FINANCE_ADMIN", true],
      ["CAMPAIGN_MANAGER", false],
    ] as const)(
      "projects can_manage_team for %s",
      async (role, canManageTeam) => {
        const w = await workspace(role);
        await expect(settings.getOverview(w.user)).resolves.toMatchObject({
          current_user_role: role,
          can_manage_team: canManageTeam,
        });
        await expect(settings.getGeneral(w.user)).resolves.toMatchObject({
          current_user_role: role,
          can_manage_team: canManageTeam,
        });
      },
    );

    it("blocks final anchor reduction even when an external Owner remains", async () => {
      const w = await workspace();
      const external = await member(w, "BRAND_OWNER", true, externalEmail());
      await expect(
        team.updateRole(w.user, {
          membershipId: w.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ).rejects.toMatchObject({
        response: { code: "TEAM_ANCHOR_OWNER_REQUIRED" },
      });
      await expect(
        team.revoke(external.user, w.membership.id),
      ).rejects.toMatchObject({
        response: { code: "TEAM_ANCHOR_OWNER_REQUIRED" },
      });
      await expect(
        team.revoke(w.user, external.membership.id),
      ).resolves.toMatchObject({ revoked: true });
      expect(await anchorCount(w.brand.id)).toBe(1);
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(1);
    });

    it("allows one of two anchors to be reduced and preserves the successor", async () => {
      const w = await workspace();
      const second = await member(w, "BRAND_OWNER");
      const external = await member(w, "BRAND_OWNER", true, externalEmail());
      await expect(
        team.updateRole(w.user, {
          membershipId: w.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ).resolves.toMatchObject({ role: "FINANCE_ADMIN" });
      expect(await anchorCount(w.brand.id)).toBe(1);
      await expect(
        team.revoke(second.user, external.membership.id),
      ).resolves.toMatchObject({ revoked: true });
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it("fails closed when no anchor exists or Brand domain authority is malformed", async () => {
      const w = await workspace();
      const second = await member(w, "BRAND_OWNER", true, externalEmail());
      await prisma.user.update({
        where: { id: w.user.id },
        data: { email: externalEmail() },
      });
      expect(await anchorCount(w.brand.id)).toBe(0);
      await expect(
        team.updateRole(w.user, {
          membershipId: second.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ).rejects.toMatchObject({
        response: { code: "TEAM_ANCHOR_OWNER_REQUIRED" },
      });
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: { domain: `malformed-${randomUUID()}` },
      });
      await expect(
        team.updateRole(w.user, {
          membershipId: second.membership.id,
          role: "FINANCE_ADMIN",
        }),
      ).rejects.toMatchObject({
        response: { code: "TEAM_ANCHOR_AUTHORITY_UNRESOLVED" },
      });
    });

    it("uses canonical domain matching and ignores verificationEmail mutation", async () => {
      const w = await workspace();
      const domain = `${randomUUID()}.brand.example`;
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: { domain, verificationEmail: externalEmail() },
      });
      await prisma.user.update({
        where: { id: w.user.id },
        data: { email: `founder@corp.${domain}` },
      });
      expect(await anchorCount(w.brand.id)).toBe(1);
      await prisma.brandProfile.update({
        where: { id: w.brand.id },
        data: { verificationEmail: freshEmail() },
      });
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it.each(["overview", "general", "create", "inspect", "accept", "cancel"])(
      "persists lazy expiry through %s",
      async (flow) => {
        const w = await workspace();
        const expired = await legacy(w, freshEmail(), "CAMPAIGN_MANAGER", {
          expired: true,
          hashed: true,
        });
        if (flow === "overview") await settings.getOverview(w.user);
        if (flow === "general") await settings.getGeneral(w.user);
        if (flow === "create")
          await invitations.create(w.user, {
            email: freshEmail(),
            role: "CAMPAIGN_MANAGER",
          });
        if (flow === "inspect")
          await expect(invitations.inspect(expired.raw)).rejects.toThrow();
        if (flow === "accept")
          await expect(
            invitations.accept({ token: expired.raw, password: password() }),
          ).rejects.toThrow();
        if (flow === "cancel")
          await expect(team.cancel(w.user, expired.row.id)).rejects.toThrow();
        expect(
          await prisma.teamInvitation.findUniqueOrThrow({
            where: { id: expired.row.id },
          }),
        ).toMatchObject({ status: "EXPIRED" });
      },
    );

    it("keeps terminal lifecycle states immutable and creates fresh invitations", async () => {
      const w = await workspace();
      const email = freshEmail();
      const first = await invitations.create(w.user, {
        email,
        role: "CAMPAIGN_MANAGER",
      });
      const firstRaw = sentToken();
      const firstStored = await prisma.teamInvitation.findUniqueOrThrow({
        where: { id: first.invitation_id },
      });
      await team.cancel(w.user, first.invitation_id);
      const second = await invitations.create(w.user, {
        email,
        role: "CAMPAIGN_MANAGER",
      });
      const secondRaw = sentToken();
      const secondStored = await prisma.teamInvitation.findUniqueOrThrow({
        where: { id: second.invitation_id },
      });
      expect(first.invitation_id).not.toBe(second.invitation_id);
      expect(firstRaw).not.toBe(secondRaw);
      expect(firstStored.token).not.toBe(secondStored.token);
      expect(secondStored.expiresAt.getTime()).toBeGreaterThan(
        firstStored.createdAt.getTime(),
      );
      await prisma.teamInvitation.update({
        where: { id: first.invitation_id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await settings.getOverview(w.user);
      expect(
        await prisma.teamInvitation.findUniqueOrThrow({
          where: { id: first.invitation_id },
        }),
      ).toMatchObject({ status: "CANCELLED" });
      await expect(invitations.inspect(firstRaw)).rejects.toThrow();
      const historicalExpired = await legacy(w, freshEmail(), "FINANCE_ADMIN", {
        status: "EXPIRED",
      });
      await settings.getGeneral(w.user);
      expect(
        await prisma.teamInvitation.findUniqueOrThrow({
          where: { id: historicalExpired.row.id },
        }),
      ).toMatchObject({ status: "EXPIRED" });
    });

    it("enforces seats across valid, cancelled, expired, and accepted states", async () => {
      const w = await workspace();
      await member(w, "FINANCE_ADMIN");
      await member(w, "CAMPAIGN_MANAGER");
      await member(w, "CAMPAIGN_MANAGER");
      const invited = await prisma.user.create({
        data: { email: freshEmail(), role: "BRAND" },
      });
      userIds.push(invited.id);
      const fifth = await invitations.create(w.user, {
        email: invited.email,
        role: "CAMPAIGN_MANAGER",
      });
      await expect(
        invitations.create(w.user, {
          email: freshEmail(),
          role: "CAMPAIGN_MANAGER",
        }),
      ).rejects.toThrow("5/5");
      const accepted = await invitations.accept({ token: sentToken() });
      expect(accepted.user.id).toBe(invited.id);
      expect((await settings.getOverview(w.user)).seat_usage).toMatchObject({
        active_members: 5,
        pending_invitations: 0,
        is_at_capacity: true,
      });
      expect(
        await prisma.teamInvitation.findUniqueOrThrow({
          where: { id: fifth.invitation_id },
        }),
      ).toMatchObject({ status: "ACCEPTED" });
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it("serializes simultaneous invitations filling the fifth seat", async () => {
      const w = await workspace();
      await member(w, "FINANCE_ADMIN");
      await member(w, "CAMPAIGN_MANAGER");
      await member(w, "CAMPAIGN_MANAGER");
      const results = await Promise.allSettled([
        invitations.create(w.user, {
          email: freshEmail(),
          role: "CAMPAIGN_MANAGER",
        }),
        invitations.create(w.user, {
          email: freshEmail(),
          role: "CAMPAIGN_MANAGER",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await prisma.teamInvitation.count({
          where: {
            brandProfileId: w.brand.id,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        }),
      ).toBe(1);
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(4);
      expect(await anchorCount(w.brand.id)).toBe(1);
    });

    it("serializes two valid candidates converting the fourth and fifth seats", async () => {
      const w = await workspace();
      await member(w, "FINANCE_ADMIN");
      await member(w, "CAMPAIGN_MANAGER");
      const users = await Promise.all(
        [freshEmail(), freshEmail()].map((email) =>
          prisma.user.create({ data: { email, role: "BRAND" } }),
        ),
      );
      userIds.push(...users.map((user) => user.id));
      const inviteA = await legacy(w, users[0].email, "CAMPAIGN_MANAGER", {
        hashed: true,
      });
      const inviteB = await legacy(w, users[1].email, "CAMPAIGN_MANAGER", {
        hashed: true,
      });
      const results = await Promise.allSettled([
        invitations.accept({ token: inviteA.raw }),
        invitations.accept({ token: inviteB.raw }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(2);
      expect(
        await prisma.teamInvitation.count({
          where: {
            id: { in: [inviteA.row.id, inviteB.row.id] },
            status: "ACCEPTED",
          },
        }),
      ).toBe(2);
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(5);
      expect(await anchorCount(w.brand.id)).toBe(1);
      for (const user of users)
        expect(
          (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
            .organizationId,
        ).toBe(w.org.id);
    });

    it("serializes expiry against acceptance and cancellation", async () => {
      for (const operation of ["accept", "cancel"] as const) {
        const w = await workspace();
        const invite = await legacy(w, freshEmail(), "CAMPAIGN_MANAGER", {
          expired: true,
          hashed: true,
        });
        const results = await Promise.allSettled([
          settings.getGeneral(w.user),
          operation === "accept"
            ? invitations.accept({ token: invite.raw, password: password() })
            : team.cancel(w.user, invite.row.id),
        ]);
        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
        expect(
          await prisma.teamInvitation.findUniqueOrThrow({
            where: { id: invite.row.id },
          }),
        ).toMatchObject({ status: "EXPIRED" });
        expect(
          await prisma.brandTeamMember.count({
            where: { brandProfileId: w.brand.id, isActive: true },
          }),
        ).toBe(1);
        expect(await anchorCount(w.brand.id)).toBe(1);
      }
    });

    it("serializes concurrent anchor demotion and revocation", async () => {
      const w = await workspace();
      const second = await member(w, "BRAND_OWNER");
      const external = await member(w, "BRAND_OWNER", true, externalEmail());
      const results = await Promise.allSettled([
        team.updateRole(w.user, {
          membershipId: w.membership.id,
          role: "FINANCE_ADMIN",
        }),
        team.revoke(external.user, second.membership.id),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(await anchorCount(w.brand.id)).toBe(1);
      expect(
        await prisma.brandTeamMember.count({
          where: {
            brandProfileId: w.brand.id,
            role: "BRAND_OWNER",
            isActive: true,
          },
        }),
      ).toBe(2);
    });

    it("reactivates the same former-member row while capacity changes", async () => {
      const w = await workspace();
      const removable = await member(w, "CAMPAIGN_MANAGER");
      await member(w, "FINANCE_ADMIN");
      await member(w, "CAMPAIGN_MANAGER");
      const former = await member(w, "CAMPAIGN_MANAGER", false);
      const invite = await legacy(w, former.user.email, "FINANCE_ADMIN", {
        hashed: true,
      });
      const results = await Promise.allSettled([
        invitations.accept({ token: invite.raw }),
        team.revoke(w.user, removable.membership.id),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(2);
      expect(
        await prisma.teamInvitation.findUniqueOrThrow({
          where: { id: invite.row.id },
        }),
      ).toMatchObject({ status: "ACCEPTED" });
      expect(
        await prisma.brandTeamMember.findUniqueOrThrow({
          where: { id: former.membership.id },
        }),
      ).toMatchObject({ isActive: true, role: "FINANCE_ADMIN" });
      expect(
        await prisma.brandTeamMember.count({
          where: { brandProfileId: w.brand.id, isActive: true },
        }),
      ).toBe(4);
      expect(await anchorCount(w.brand.id)).toBe(1);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: former.user.id } }))
          .organizationId,
      ).toBe(w.org.id);
    });
  },
);

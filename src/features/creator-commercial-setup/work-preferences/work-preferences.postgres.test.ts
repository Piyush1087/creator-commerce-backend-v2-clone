import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AuthModule } from "../../auth/auth.module";
import type { AuthSessionService } from "../../auth/auth-session.service";
import type { WorkPreferencesModule } from "./work-preferences.module";
import { readdirSync } from "node:fs";
import { PrismaClient, UserRole, type CreatorTeamRole } from "@prisma/client";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { CreatorShippingReadinessAdapter } from "../../creator-settings/services/creator-shipping-readiness.adapter";
import { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesRepository } from "./work-preferences.repository";
import { WorkPreferencesService } from "./work-preferences.service";

export const emptyCommercialPreferences = () => ({
  baseCountry: "IN",
  openToInternationalBrands: null,
  preferredIndustryIds: [],
  excludedIndustryIds: [],
  availability: "ACCEPTING_COLLABORATIONS",
  pausedUntil: null,
  physicalProductCollaborations: null,
  ugcProjects: null,
  giftingBarter: null,
});
describe.skipIf(process.env.CREATOR_WORK_PREFERENCES_DATABASE_TEST !== "true")(
  "Work Preferences actual PostgreSQL",
  () => {
    const db = new PrismaClient();
    const prisma = db as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(prisma);
    const bank = new PrismaCreatorPayoutCountryAuthorityAdapter(prisma);
    const repository = new WorkPreferencesRepository(
      prisma,
      actors,
      bank,
      new CreatorShippingReadinessAdapter(prisma),
    );
    const payouts = new PrismaCreatorPayoutReadinessService(prisma);
    const service = new WorkPreferencesService(repository, payouts);
    const auth = (user: { id: string; email: string }): AuthUser => ({
      ...user,
      name: null,
      role: UserRole.CREATOR,
      organizationId: null,
    });
    const command = (
      expectedRevision = 0,
      values: unknown = emptyCommercialPreferences(),
      idempotencyKey = randomUUID(),
    ) => ({
      expectedRevision,
      expectedRateCardRevision: 0,
      confirmMonetaryReset: false,
      idempotencyKey,
      values,
    });
    async function fixture() {
      const organization = await db.organization.create({
        data: { name: "Commercial synthetic workspace", kind: "CREATOR" },
      });
      const user = async () =>
        db.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            role: "CREATOR",
            authState: "ACTIVE",
            organizationId: organization.id,
          },
        });
      const owner = await user();
      const profile = await db.creatorProfile.create({
        data: { userId: owner.id, displayName: "Commercial owner" },
      });
      const workspace = await db.creatorWorkspace.create({
        data: { ownerProfileId: profile.id, organizationId: organization.id },
      });
      const seat = (
        role: CreatorTeamRole,
        actor: { id: string; email: string },
      ) =>
        db.creatorWorkspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: actor.id,
            assignedProfileId: role === "OWNER" ? profile.id : null,
            associatedEmail: actor.email,
            securityRole: role,
            isActive: true,
          },
        });
      const ownerSeat = await seat("OWNER", owner);
      const manager = await user();
      const managerSeat = await seat("MANAGER", manager);
      const assistant = await user();
      const assistantSeat = await seat("ASSISTANT", assistant);
      return {
        owner: auth(owner),
        manager: auth(manager),
        assistant: auth(assistant),
        ownerSeat,
        managerSeat,
        assistantSeat,
        profile,
        workspace,
      };
    }
    async function counts(workspaceId: string) {
      return {
        profiles: await db.creatorWorkPreferences.count({
          where: { workspaceId },
        }),
        revisions: await db.creatorWorkPreferencesRevision.count({
          where: { profile: { workspaceId } },
        }),
      };
    }
    async function createBank(
      profileId: string,
      countryCode = "IN",
      currencyCode = "INR",
    ) {
      return db.creatorPayoutDestination.create({
        data: {
          creatorProfileId: profileId,
          payeeType: "INDIVIDUAL",
          beneficiaryName: "Synthetic destination",
          destinationType: "BANK_ACCOUNT",
          countryCode,
          currencyCode,
          secretPayloadEncrypted: "opaque-test-only",
          maskedDisplay: "not-projected",
          isPrimary: true,
          state: "CONFIGURED_UNVERIFIED",
          version: 1,
        },
      });
    }
    beforeAll(async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "127.0.0.1" ||
        !/^\/c05_creator_commercial_/u.test(route.pathname)
      )
        throw new Error("Disposable Commercial database route required");
      const expectedMigrations = readdirSync("prisma/migrations", {
        withFileTypes: true,
      }).filter((entry) => entry.isDirectory()).length;
      expect(
        await db.$queryRaw<
          Array<{ n: number }>
        >`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      ).toEqual([{ n: expectedMigrations }]);
    }, 60000);
    afterAll(async () => {
      await db.$disconnect();
    });
    it("projects only default availability with unanswered manual questions", async () => {
      const f = await fixture();
      const result = await service.read(f.owner);
      expect(result).toMatchObject({
        state: "UNCONFIGURED",
        currentRevision: 0,
        values: null,
        readiness: {
          shipping: "NEEDS_SETUP",
          payout: "NEEDS_SETUP",
          kyc: "COMING_SOON",
        },
        country: {
          state: "UNCONFIGURED",
          effectiveBaseCountry: null,
          canonicalRateCardCurrency: null,
        },
      });
      expect(
        await db.creatorSocialIntegration.count({
          where: { creatorProfileId: f.profile.id },
        }),
      ).toBe(0);
    });
    it("Owner creates manual canonical values with stable replay and immutable actor audit", async () => {
      const f = await fixture();
      const request = command(0, {
        ...emptyCommercialPreferences(),
        preferredIndustryIds: ["SAAS_AI", "D2C", "D2C"],
        ugcProjects: "YES",
      });
      const first = await service.mutate(f.owner, request);
      expect(first).toMatchObject({
        currentRevision: 1,
        values: {
          preferredIndustryIds: ["D2C", "SAAS_AI"],
          ugcProjects: "YES",
        },
        country: {
          baseCountrySource: "CREATOR_DECLARED",
          canonicalRateCardCurrency: "INR",
        },
      });
      expect(await service.mutate(f.owner, request)).toEqual(first);
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 1,
        revisions: 1,
      });
      const revision = await db.creatorWorkPreferencesRevision.findFirstOrThrow(
        { where: { profile: { workspaceId: f.workspace.id } } },
      );
      expect(revision).toMatchObject({
        actorUserId: f.owner.id,
        actorMembershipId: f.ownerSeat.id,
        actorRole: "OWNER",
        origin: "MANUAL",
        previousRevision: 0,
        revision: 1,
      });
      await expect(
        db.creatorWorkPreferencesRevision.update({
          where: { id: revision.id },
          data: { origin: "MANUAL" },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorWorkPreferencesRevision.delete({
          where: { id: revision.id },
        }),
      ).rejects.toThrow();
    });
    it("Manager edits exact Owner subject while Assistant has read only", async () => {
      const f = await fixture();
      await service.mutate(f.manager, command());
      const read = await service.read(f.assistant);
      expect(read.context.allowedActions).toEqual(["COMMERCIAL_SETUP_READ"]);
      await expect(service.mutate(f.assistant, command(1))).rejects.toThrow();
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 1,
        revisions: 1,
      });
      const revision = await db.creatorWorkPreferencesRevision.findFirstOrThrow(
        { where: { profile: { workspaceId: f.workspace.id } } },
      );
      expect(revision.actorMembershipId).toBe(f.managerSeat.id);
    });
    it("inactive and missing actor fences reject before read/mutation", async () => {
      const f = await fixture();
      await db.creatorWorkspaceMember.update({
        where: { id: f.managerSeat.id },
        data: { isActive: false },
      });
      await expect(service.read(f.manager)).rejects.toThrow();
      await expect(service.mutate(f.manager, command())).rejects.toThrow();
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 0,
        revisions: 0,
      });
    });
    it("rejects stale/key-conflicting requests atomically", async () => {
      const f = await fixture();
      const first = command();
      await service.mutate(f.owner, first);
      await expect(service.mutate(f.owner, command())).rejects.toThrow();
      await expect(
        service.mutate(f.owner, {
          ...first,
          values: { ...emptyCommercialPreferences(), giftingBarter: "YES" },
        }),
      ).rejects.toThrow();
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 1,
        revisions: 1,
      });
    });
    it("serializes concurrent Team-scoped CAS writers", async () => {
      const f = await fixture();
      const outcomes = await Promise.allSettled([
        service.mutate(f.owner, command()),
        service.mutate(f.manager, command()),
      ]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((o) => o.status === "rejected")).toHaveLength(1);
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 1,
        revisions: 1,
      });
    });
    it("strict malicious subject/taxonomy/overlap/default inputs make no writes", async () => {
      const f = await fixture();
      for (const request of [
        { ...command(), creatorProfileId: randomUUID() },
        command(0, {
          ...emptyCommercialPreferences(),
          preferredIndustryIds: ["UNKNOWN"],
        }),
        command(0, {
          ...emptyCommercialPreferences(),
          preferredIndustryIds: ["D2C"],
          excludedIndustryIds: ["D2C"],
        }),
        command(0, { ...emptyCommercialPreferences(), baseCountry: null }),
        { ...command(), expectedRateCardRevision: 1 },
      ])
        await expect(service.mutate(f.owner, request)).rejects.toThrow();
      expect(await counts(f.workspace.id)).toEqual({
        profiles: 0,
        revisions: 0,
      });
    });
    it("enforces every availability/date case and truthful progressive answers", async () => {
      const f = await fixture();
      for (const values of [
        { ...emptyCommercialPreferences(), availability: "PAUSED_UNTIL" },
        {
          ...emptyCommercialPreferences(),
          availability: "PAUSED_UNTIL",
          pausedUntil: new Date(Date.now() - 1000).toISOString(),
        },
        {
          ...emptyCommercialPreferences(),
          pausedUntil: new Date(Date.now() + 86400000).toISOString(),
        },
      ])
        await expect(
          service.mutate(f.owner, command(0, values)),
        ).rejects.toThrow();
      const paused = await service.mutate(
        f.owner,
        command(0, {
          ...emptyCommercialPreferences(),
          availability: "PAUSED_UNTIL",
          pausedUntil: new Date(Date.now() + 86400000).toISOString(),
        }),
      );
      expect(paused.values?.availability).toBe("PAUSED_UNTIL");
      const stopped = await service.mutate(
        f.manager,
        command(1, {
          ...emptyCommercialPreferences(),
          availability: "NOT_ACCEPTING_NEW_COLLABORATIONS",
        }),
      );
      expect(stopped.values?.pausedUntil).toBeNull();
      expect(stopped.values?.giftingBarter).toBeNull();
    });
    it("bank authority is independent of pending/unsupported transfer readiness and locks manual override", async () => {
      const f = await fixture();
      await service.mutate(f.owner, command());
      await createBank(f.profile.id, "US", "USD");
      const read = await service.read(f.owner);
      expect(read.country).toMatchObject({
        state: "AVAILABLE",
        baseCountrySource: "PAYOUT_BANK",
        effectiveBaseCountry: "US",
        canonicalRateCardCurrency: "USD",
        baseCountryEditable: false,
      });
      expect(read.readiness.payout).toBe("UNAVAILABLE");
      await expect(
        service.mutate(
          f.owner,
          command(1, { ...emptyCommercialPreferences(), baseCountry: "US" }),
        ),
      ).rejects.toThrow();
      const saved = await service.mutate(
        f.owner,
        command(1, { ...emptyCommercialPreferences(), ugcProjects: "YES" }),
      );
      expect(saved.values?.baseCountry).toBe("IN");
      expect(saved.country.effectiveBaseCountry).toBe("US");
      const projection = JSON.stringify(saved);
      for (const field of [
        "secretPayloadEncrypted",
        "maskedDisplay",
        "beneficiaryName",
        "providerMappings",
      ])
        expect(projection).not.toContain(field);
    });
    it("replacement/version and disable correctly invalidate bank authority with no GET write", async () => {
      const f = await fixture();
      await service.mutate(f.owner, command());
      const d = await createBank(f.profile.id);
      const first = await service.read(f.owner);
      await db.creatorPayoutDestination.update({
        where: { id: d.id },
        data: { version: 2 },
      });
      const changed = await service.read(f.owner);
      expect(changed.country.authorityFingerprint).not.toBe(
        first.country.authorityFingerprint,
      );
      const before = await counts(f.workspace.id);
      await service.read(f.owner);
      expect(await counts(f.workspace.id)).toEqual(before);
      await db.creatorPayoutDestination.update({
        where: { id: d.id },
        data: {
          isPrimary: false,
          state: "DISABLED",
          disabledAt: new Date(),
          version: 3,
        },
      });
      expect((await service.read(f.owner)).country.baseCountrySource).toBe(
        "CREATOR_DECLARED",
      );
    });
    it("duplicate/invalid/legal conflict never silently falls back", async () => {
      const f = await fixture();
      await service.mutate(f.owner, command());
      const d = await createBank(f.profile.id);
      // Accepted C05 partial unique index prevents duplicate primaries at rest.
      // Defensive duplicate CONFLICT selection is independently unit-tested.
      await expect(createBank(f.profile.id)).rejects.toThrow();
      expect((await service.read(f.owner)).country.state).toBe("AVAILABLE");
      await db.creatorPayoutDestination.update({
        where: { id: d.id },
        data: { countryCode: "ZZ" },
      });
      expect((await service.read(f.owner)).country.state).toBe("CONFLICT");
      await db.creatorPayoutDestination.update({
        where: { id: d.id },
        data: { countryCode: "IN" },
      });
      await db.creatorLegalProfile.create({
        data: {
          creatorProfileId: f.profile.id,
          payeeType: "BUSINESS",
          legalName: "Synthetic legal",
          countryCode: "IN",
          addressLine1: "Test",
          city: "Test",
          postalCode: "000000",
          version: 1,
        },
      });
      expect((await service.read(f.owner)).country.state).toBe("CONFLICT");
    });
    it("real JWT/session HTTP roles, no-source writes and malicious/cross-owner denial", async () => {
      const a = await fixture(),
        b = await fixture();
      const requireCompiled = createRequire(resolve("package.json"));
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
          (
            requireCompiled(resolve("dist/features/auth/auth.module.js")) as {
              AuthModule: typeof AuthModule;
            }
          ).AuthModule,
          (
            requireCompiled(
              resolve(
                "dist/features/creator-commercial-setup/work-preferences/work-preferences.module.js",
              ),
            ) as { WorkPreferencesModule: typeof WorkPreferencesModule }
          ).WorkPreferencesModule,
        ],
      }).compile();
      const app = module.createNestApplication({ logger: false });
      try {
        await app.listen(0, "127.0.0.1");
        const address = app.getHttpServer().address() as { port: number };
        const base = `http://127.0.0.1:${address.port}/api/v1/creator/commercial-setup/work-preferences`;
        const sessions = app.get(
          (
            requireCompiled(
              resolve("dist/features/auth/auth-session.service.js"),
            ) as { AuthSessionService: typeof AuthSessionService }
          ).AuthSessionService,
        );
        const owner = (await sessions.create(a.owner.id)).accessToken;
        const manager = (await sessions.create(a.manager.id)).accessToken;
        const assistant = (await sessions.create(a.assistant.id)).accessToken;
        const other = (await sessions.create(b.owner.id)).accessToken;
        const get = (token: string, suffix = "") =>
          fetch(base + suffix, {
            headers: { Authorization: `Bearer ${token}` },
          });
        const put = (token: string, body: unknown) =>
          fetch(base, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
        expect((await fetch(base)).status).toBe(401);
        for (const token of [owner, manager, assistant])
          expect((await get(token)).status).toBe(200);
        expect((await put(assistant, command())).status).toBe(403);
        const first = await put(owner, command());
        expect(first.status).toBe(200);
        expect((await first.json()).currentRevision).toBe(1);
        expect(
          (
            await put(
              manager,
              command(1, {
                ...emptyCommercialPreferences(),
                ugcProjects: "YES",
              }),
            )
          ).status,
        ).toBe(200);
        expect((await put(owner, command(1))).status).toBe(409);
        expect(
          (
            await put(owner, {
              ...command(2),
              ownerCreatorProfileId: b.profile.id,
            })
          ).status,
        ).toBe(400);
        expect((await (await get(other)).json()).currentRevision).toBe(0);
        expect(
          (
            await (
              await get(
                owner,
                `?workspaceId=${b.workspace.id}&creatorProfileId=${b.profile.id}`,
              )
            ).json()
          ).currentRevision,
        ).toBe(2);
        await db.creatorWorkspaceMember.update({
          where: { id: a.assistantSeat.id },
          data: { isActive: false },
        });
        expect((await get(assistant)).status).toBe(403);
        expect(await counts(a.workspace.id)).toEqual({
          profiles: 1,
          revisions: 2,
        });
        expect(await counts(b.workspace.id)).toEqual({
          profiles: 0,
          revisions: 0,
        });
      } finally {
        await app.close();
      }
    }, 60000);
    it("shipping projects readiness only and internal target purge preserves another Creator and external rows", async () => {
      const a = await fixture(),
        b = await fixture();
      await service.mutate(a.owner, command());
      await service.mutate(b.owner, command());
      await db.creatorShippingAddress.create({
        data: {
          creatorProfileId: a.profile.id,
          recipientName: "Synthetic recipient",
          addressLine1: "Test",
          city: "Test",
          postalCode: "000000",
          countryCode: "IN",
          isDefault: true,
        },
      });
      expect((await service.read(a.assistant)).readiness.shipping).toBe(
        "READY",
      );
      const other = await service.read(b.owner);
      await expect(
        repository.purgeOwnerScope({
          purpose: "CREATOR_OWNER_SCOPE_PURGE",
          workspaceId: a.workspace.id,
          ownerCreatorProfileId: b.profile.id,
        }),
      ).rejects.toThrow();
      await repository.purgeOwnerScope({
        purpose: "CREATOR_OWNER_SCOPE_PURGE",
        workspaceId: a.workspace.id,
        ownerCreatorProfileId: a.profile.id,
      });
      expect(await counts(a.workspace.id)).toEqual({
        profiles: 0,
        revisions: 0,
      });
      expect(await service.read(b.owner)).toEqual(other);
      expect(
        await db.creatorShippingAddress.count({
          where: { creatorProfileId: a.profile.id },
        }),
      ).toBe(1);
    });
  },
);

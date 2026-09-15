import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { CreatorShippingReadinessAdapter } from "../../creator-settings/services/creator-shipping-readiness.adapter";
import { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesRepository } from "../work-preferences/work-preferences.repository";
import { WorkPreferencesService } from "../work-preferences/work-preferences.service";
import { RateCardPersistence } from "./rate-card.persistence";
import { RateCardService } from "./rate-card.service";
import {
  RATE_CARD_MONETARY_KEYS,
  type RateCardValues,
} from "../contracts/rate-card.contract";

const preferences = {
  baseCountry: "IN",
  openToInternationalBrands: null,
  preferredIndustryIds: [],
  excludedIndustryIds: [],
  availability: "ACCEPTING_COLLABORATIONS",
  pausedUntil: null,
  physicalProductCollaborations: null,
  ugcProjects: "YES",
  giftingBarter: "NO",
};
const values = (): RateCardValues => ({
  REEL_VIDEO: { enabled: true, amountMinor: 10000 },
  STORY: { enabled: true, amountMinor: 2500 },
  BANNER_CAROUSEL: { enabled: false, amountMinor: null },
  PHOTOSHOOT: { enabled: false, amountMinor: null },
  linkInBio: { enabled: true, amountMinor: 1000 },
  paidAmplification: { enabled: true, amountMinor: 2000 },
  contentUsageRights: "YES",
  usageDays: 30,
  advancePercent: 25,
  balanceTerm: "NET_30",
});
describe.skipIf(process.env.CREATOR_RATE_CARD_DATABASE_TEST !== "true")(
  "Rate Card atomic PostgreSQL",
  () => {
    const db = new PrismaClient(),
      prisma = db as unknown as PrismaService;
    const actors = new CreatorWorkspaceActorService(prisma),
      bank = new PrismaCreatorPayoutCountryAuthorityAdapter(prisma);
    const repo = new RateCardPersistence(prisma, actors, bank),
      rates = new RateCardService(repo);
    const wpRepo = new WorkPreferencesRepository(
      prisma,
      actors,
      bank,
      new CreatorShippingReadinessAdapter(prisma),
      repo,
    );
    const wp = new WorkPreferencesService(
      wpRepo,
      new PrismaCreatorPayoutReadinessService(prisma),
    );
    const auth = (user: { id: string; email: string }): AuthUser => ({
      ...user,
      name: null,
      role: UserRole.CREATOR,
      organizationId: null,
    });
    async function fixture() {
      const organization = await db.organization.create({
        data: { name: "Synthetic Rate Card workspace", kind: "CREATOR" },
      });
      const user = () =>
        db.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            role: "CREATOR",
            authState: "ACTIVE",
            organizationId: organization.id,
          },
        });
      const owner = await user(),
        profile = await db.creatorProfile.create({
          data: { userId: owner.id, displayName: "Synthetic commercial" },
        }),
        workspace = await db.creatorWorkspace.create({
          data: { ownerProfileId: profile.id, organizationId: organization.id },
        });
      const seat = (
        actor: { id: string; email: string },
        role: "OWNER" | "MANAGER" | "ASSISTANT",
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
      await seat(owner, "OWNER");
      const manager = await user(),
        assistant = await user();
      await seat(manager, "MANAGER");
      const assistantSeat = await seat(assistant, "ASSISTANT");
      const actor = auth(owner);
      await wp.mutate(actor, {
        expectedRevision: 0,
        expectedRateCardRevision: 0,
        confirmMonetaryReset: false,
        idempotencyKey: randomUUID(),
        values: preferences,
      });
      return {
        owner: actor,
        manager: auth(manager),
        assistant: auth(assistant),
        assistantSeat,
        profile,
        workspace,
      };
    }
    async function request(
      f: Awaited<ReturnType<typeof fixture>>,
      patch: Partial<RateCardValues> = {},
    ) {
      const current = await rates.read(f.owner),
        currentWp = await wp.read(f.owner);
      return {
        expectedRevision: current.currentRevision,
        expectedWorkPreferencesRevision: currentWp.currentRevision,
        authorityFingerprint: current.country.authorityFingerprint,
        idempotencyKey: randomUUID(),
        values: { ...values(), ...patch },
      };
    }
    const bankDestination = (
      profileId: string,
      countryCode = "IN",
      currencyCode = "INR",
      version = 1,
    ) =>
      db.creatorPayoutDestination.create({
        data: {
          creatorProfileId: profileId,
          payeeType: "INDIVIDUAL",
          beneficiaryName: "Synthetic destination",
          destinationType: "BANK_ACCOUNT",
          countryCode,
          currencyCode,
          secretPayloadEncrypted: "opaque-test-only",
          maskedDisplay: "never-projected",
          isPrimary: true,
          state: "CONFIGURED_UNVERIFIED",
          version,
        },
      });
    beforeAll(async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "127.0.0.1" ||
        !route.pathname.startsWith("/c05_creator_commercial_")
      )
        throw new Error("Disposable Commercial route required");
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 104 }]);
    });
    afterAll(() => db.$disconnect());
    it("source-independent roles, canonical amounts, stable replay and strict substitutions", async () => {
      const f = await fixture(),
        command = await request(f);
      const first = await rates.mutate(f.owner, command);
      expect(first.values).toEqual(values());
      expect(first.workPreferences).toEqual({
        ugcProjects: "YES",
        giftingBarter: "NO",
      });
      expect(await rates.mutate(f.owner, command)).toEqual(first);
      expect(
        await db.creatorRateCardRevision.count({
          where: { profile: { workspaceId: f.workspace.id } },
        }),
      ).toBe(1);
      expect((await rates.read(f.assistant)).values).toEqual(values());
      await expect(
        rates.mutate(f.assistant, await request(f)),
      ).rejects.toThrow();
      await rates.mutate(f.manager, await request(f));
      await expect(
        rates.mutate(f.owner, {
          ...(await request(f)),
          ownerCreatorProfileId: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        rates.mutate(f.owner, { ...command, idempotencyKey: randomUUID() }),
      ).rejects.toThrow();
      const other = await fixture();
      expect((await rates.read(other.owner)).state).toBe("UNCONFIGURED");
    });
    it("same-currency manual country and other preference revisions atomically retain money with new bindings", async () => {
      const f = await fixture();
      await rates.mutate(f.owner, await request(f));
      const change = {
        expectedRevision: 1,
        expectedRateCardRevision: 1,
        confirmMonetaryReset: false,
        idempotencyKey: randomUUID(),
        values: { ...preferences, baseCountry: "GB" },
      };
      // IN→GB is cross-currency: first reset is explicitly confirmed, then money is entered in USD.
      await wp.mutate(f.owner, { ...change, confirmMonetaryReset: true });
      await rates.mutate(f.owner, await request(f));
      const before = await rates.read(f.owner);
      await wp.mutate(f.owner, {
        expectedRevision: 2,
        expectedRateCardRevision: before.currentRevision,
        confirmMonetaryReset: false,
        idempotencyKey: randomUUID(),
        values: { ...preferences, baseCountry: "US" },
      });
      const after = await rates.read(f.owner);
      expect(after.values).toEqual(before.values);
      expect(after.country.canonicalRateCardCurrency).toBe("USD");
      expect(after.currentRevision).toBe(before.currentRevision + 1);
    });
    it("unconfirmed manual cross-currency rejects both writes; confirmed reset preserves rights/history", async () => {
      const f = await fixture();
      await rates.mutate(f.owner, await request(f));
      const beforeWp = await wp.read(f.owner),
        beforeRate = await rates.read(f.owner);
      const command = {
        expectedRevision: 1,
        expectedRateCardRevision: 1,
        confirmMonetaryReset: false,
        idempotencyKey: randomUUID(),
        values: { ...preferences, baseCountry: "US" },
      };
      await expect(wp.mutate(f.owner, command)).rejects.toThrow();
      expect(await wp.read(f.owner)).toEqual(beforeWp);
      expect(await rates.read(f.owner)).toEqual(beforeRate);
      await wp.mutate(f.owner, { ...command, confirmMonetaryReset: true });
      const after = await rates.read(f.owner);
      for (const key of RATE_CARD_MONETARY_KEYS)
        expect(after.values?.[key]).toEqual({
          enabled: false,
          amountMinor: null,
        });
      expect(after.values).toMatchObject({
        contentUsageRights: "YES",
        usageDays: 30,
        advancePercent: 25,
        balanceTerm: "NET_30",
      });
      const history = await db.creatorRateCardRevision.findMany({
        where: { profile: { workspaceId: f.workspace.id } },
        orderBy: { revision: "asc" },
      });
      expect(history).toHaveLength(2);
      expect(history[0].snapshot).toEqual(values());
      expect(history[1].origin).toBe("MANUAL_COUNTRY_MONETARY_RESET");
      expect(history[1].transitionSnapshot).toMatchObject({
        currencyChanged: true,
      });
    });
    it("bank overwrite hides on GET without writes; same currency reconciles then cross currency clears", async () => {
      const f = await fixture();
      await rates.mutate(f.owner, await request(f));
      const destination = await bankDestination(f.profile.id);
      const before = await db.creatorRateCard.findUniqueOrThrow({
          where: { workspaceId: f.workspace.id },
        }),
        rows = await db.creatorRateCardRevision.count();
      const stale = await rates.read(f.assistant);
      expect(stale.state).toBe("MONETARY_RATES_REQUIRE_REENTRY");
      for (const key of RATE_CARD_MONETARY_KEYS)
        expect(stale.values?.[key].enabled).toBe(false);
      expect(
        await db.creatorRateCard.findUnique({ where: { id: before.id } }),
      ).toEqual(before);
      expect(await db.creatorRateCardRevision.count()).toBe(rows);
      const same = await rates.mutate(f.manager, await request(f));
      expect(same.values).toEqual(values());
      expect(same.country.baseCountryEditable).toBe(false);
      await db.creatorPayoutDestination.update({
        where: { id: destination.id },
        data: { countryCode: "US", currencyCode: "USD", version: 2 },
      });
      expect((await rates.read(f.owner)).state).toBe(
        "MONETARY_RATES_REQUIRE_REENTRY",
      );
      const reset = await rates.mutate(f.owner, await request(f));
      for (const key of RATE_CARD_MONETARY_KEYS)
        expect(reset.values?.[key].enabled).toBe(false);
      expect(reset.country.canonicalRateCardCurrency).toBe("USD");
      expect(reset.values?.usageDays).toBe(30);
      await expect(
        wp.mutate(f.owner, {
          expectedRevision: 1,
          expectedRateCardRevision: reset.currentRevision,
          confirmMonetaryReset: true,
          idempotencyKey: randomUUID(),
          values: { ...preferences, baseCountry: "GB" },
        }),
      ).rejects.toThrow();
    });
    it("bank conflict has no fallback; disabled returns manual; inactive actor cannot write", async () => {
      const f = await fixture();
      await rates.mutate(f.owner, await request(f));
      const destination = await bankDestination(f.profile.id, "ZZ", "USD");
      expect((await rates.read(f.owner)).country.state).toBe("CONFLICT");
      expect((await rates.read(f.owner)).state).toBe(
        "MONETARY_RATES_REQUIRE_REENTRY",
      );
      await expect(rates.mutate(f.owner, await request(f))).rejects.toThrow();
      await db.creatorPayoutDestination.update({
        where: { id: destination.id },
        data: { disabledAt: new Date(), state: "DISABLED", isPrimary: false },
      });
      expect((await rates.read(f.owner)).country.baseCountrySource).toBe(
        "CREATOR_DECLARED",
      );
      await db.creatorWorkspaceMember.update({
        where: { id: f.assistantSeat.id },
        data: { isActive: false },
      });
      await expect(rates.read(f.assistant)).rejects.toThrow();
    });
    it("concurrent CAS has one winner; audit immutable and exact owner purge preserves other/source Settings rows", async () => {
      const a = await fixture(),
        b = await fixture();
      await rates.mutate(a.owner, await request(a));
      await rates.mutate(b.owner, await request(b));
      const command = await request(a);
      const outcomes = await Promise.allSettled([
        rates.mutate(a.owner, command),
        rates.mutate(a.manager, { ...command, idempotencyKey: randomUUID() }),
      ]);
      expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      const revision = await db.creatorRateCardRevision.findFirstOrThrow({
        where: { profile: { workspaceId: a.workspace.id } },
      });
      await expect(
        db.creatorRateCardRevision.update({
          where: { id: revision.id },
          data: { origin: "MANUAL" },
        }),
      ).rejects.toThrow();
      await expect(
        db.creatorRateCardRevision.delete({ where: { id: revision.id } }),
      ).rejects.toThrow();
      const other = await rates.read(b.owner);
      await expect(
        repo.purgeOwnerScope({
          purpose: "CREATOR_OWNER_SCOPE_PURGE",
          workspaceId: a.workspace.id,
          ownerCreatorProfileId: b.profile.id,
        }),
      ).rejects.toThrow();
      await repo.purgeOwnerScope({
        purpose: "CREATOR_OWNER_SCOPE_PURGE",
        workspaceId: a.workspace.id,
        ownerCreatorProfileId: a.profile.id,
      });
      expect((await rates.read(a.owner)).state).toBe("UNCONFIGURED");
      expect(await rates.read(b.owner)).toEqual(other);
      expect(
        await db.creatorWorkPreferences.count({
          where: { workspaceId: a.workspace.id },
        }),
      ).toBe(1);
      expect(
        await db.creatorProfile.findUnique({ where: { id: a.profile.id } }),
      ).not.toBeNull();
    });
  },
);

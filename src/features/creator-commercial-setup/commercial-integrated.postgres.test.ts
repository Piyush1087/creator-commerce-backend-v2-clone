import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { afterAll, describe, it, expect } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../creator-settings/team/creator-workspace-actor.service";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { CreatorShippingReadinessAdapter } from "../creator-settings/services/creator-shipping-readiness.adapter";
import { PrismaCreatorPayoutReadinessService } from "../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesRepository } from "./work-preferences/work-preferences.repository";
import { WorkPreferencesService } from "./work-preferences/work-preferences.service";
import { RateCardPersistence } from "./rate-card/rate-card.persistence";
import { RateCardService } from "./rate-card/rate-card.service";
describe.skipIf(
  process.env.CREATOR_COMMERCIAL_INTEGRATED_DATABASE_TEST !== "true",
)("P4 populated predecessor ownership and target purge", () => {
  const db = new PrismaClient(),
    prisma = db as unknown as PrismaService;
  afterAll(() => db.$disconnect());
  it("preserves all 195 predecessor table digests through combined edits and exact target purge", async () => {
    const route = new URL(process.env.DATABASE_URL ?? "");
    if (
      route.hostname !== "127.0.0.1" ||
      route.pathname !== "/c05_creator_brand_upgrade_shared"
    )
      throw new Error("Exact task-owned populated upgrade route required");
    expect(
      await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
    ).toEqual([{ n: 104 }]);
    const tables = await db.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND tablename NOT IN ('creator_work_preferences','creator_work_preferences_revisions','creator_rate_cards','creator_rate_card_revisions') ORDER BY tablename`;
    expect(tables).toHaveLength(195);
    const fingerprint = () =>
      Promise.all(
        tables.map(async ({ tablename }) => {
          if (!/^[a-z0-9_]+$/.test(tablename)) throw new Error("Unsafe table");
          return {
            tablename,
            rows: await db.$queryRawUnsafe(
              `SELECT count(*)::int n,md5(coalesce(string_agg(row_json,'|' ORDER BY row_json),'')) digest FROM (SELECT row_to_json(t)::text row_json FROM "${tablename}" t) s`,
            ),
          };
        }),
      );
    const before = await fingerprint();
    for (const name of [
      "creator_brand_profiles",
      "uce_campaigns",
      "collaborations",
    ])
      expect(
        (
          before.find((row) => row.tablename === name)?.rows as Array<{
            n: number;
          }>
        )[0].n,
      ).toBeGreaterThan(0);
    const target = await db.creatorWorkPreferences.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true, ownerProfileId: true },
    });
    const profile = await db.creatorProfile.findUniqueOrThrow({
      where: { id: target.ownerProfileId },
      select: { user: { select: { id: true, email: true } } },
    });
    const actor = {
      ...profile.user,
      name: null,
      role: UserRole.CREATOR,
      organizationId: null,
    };
    const actors = new CreatorWorkspaceActorService(prisma),
      bank = new PrismaCreatorPayoutCountryAuthorityAdapter(prisma),
      repo = new RateCardPersistence(prisma, actors, bank),
      rates = new RateCardService(repo),
      wpRepo = new WorkPreferencesRepository(
        prisma,
        actors,
        bank,
        new CreatorShippingReadinessAdapter(prisma),
        repo,
      ),
      wp = new WorkPreferencesService(
        wpRepo,
        new PrismaCreatorPayoutReadinessService(prisma),
      );
    if (
      (await db.creatorWorkPreferences.count({
        where: { workspaceId: { not: target.workspaceId } },
      })) === 0
    ) {
      const other = await db.creatorWorkspace.findFirstOrThrow({
        where: {
          id: { not: target.workspaceId },
          members: {
            some: {
              securityRole: "OWNER",
              isActive: true,
              user: { authState: "ACTIVE" },
            },
          },
        },
        select: {
          ownerProfile: {
            select: { user: { select: { id: true, email: true } } },
          },
        },
      });
      const otherActor = {
        ...other.ownerProfile.user,
        name: null,
        role: UserRole.CREATOR,
        organizationId: null,
      };
      const otherState = await wp.read(otherActor),
        otherRate = await rates.read(otherActor);
      await wp.mutate(otherActor, {
        expectedRevision: otherState.currentRevision,
        expectedRateCardRevision: otherRate.currentRevision,
        confirmMonetaryReset: false,
        idempotencyKey: randomUUID(),
        values: {
          baseCountry: otherState.country.effectiveBaseCountry ?? "IN",
          openToInternationalBrands: null,
          preferredIndustryIds: [],
          excludedIndustryIds: [],
          availability: "ACCEPTING_COLLABORATIONS",
          pausedUntil: null,
          physicalProductCollaborations: null,
          ugcProjects: null,
          giftingBarter: null,
        },
      });
    }
    const othersBefore = await db.creatorWorkPreferences.findMany({
      where: { workspaceId: { not: target.workspaceId } },
      orderBy: { id: "asc" },
    });
    expect(othersBefore.length).toBeGreaterThan(0);
    const currentWp = await wp.read(actor),
      initialRate = await rates.read(actor);
    expect(currentWp.values).not.toBeNull();
    expect(initialRate.country.state).toBe("AVAILABLE");
    const first = await wp.mutate(actor, {
      expectedRevision: currentWp.currentRevision,
      expectedRateCardRevision: initialRate.currentRevision,
      confirmMonetaryReset: false,
      idempotencyKey: randomUUID(),
      values: { ...currentWp.values!, ugcProjects: "YES" },
    });
    const current = await rates.read(actor);
    const rateCommand = {
      expectedRevision: current.currentRevision,
      expectedWorkPreferencesRevision: first.currentRevision,
      authorityFingerprint: current.country.authorityFingerprint,
      idempotencyKey: randomUUID(),
      values: {
        REEL_VIDEO: { enabled: true, amountMinor: 10000 },
        STORY: { enabled: false, amountMinor: null },
        BANNER_CAROUSEL: { enabled: false, amountMinor: null },
        PHOTOSHOOT: { enabled: false, amountMinor: null },
        linkInBio: { enabled: false, amountMinor: null },
        paidAmplification: { enabled: false, amountMinor: null },
        contentUsageRights: "YES",
        usageDays: 30,
        advancePercent: 25,
        balanceTerm: "NET_30",
      },
    };
    const saved = await rates.mutate(actor, rateCommand);
    expect(saved.values?.REEL_VIDEO.amountMinor).toBe(10000);
    await wp.mutate(actor, {
      expectedRevision: first.currentRevision,
      expectedRateCardRevision: saved.currentRevision,
      confirmMonetaryReset: false,
      idempotencyKey: randomUUID(),
      values: {
        ...first.values!,
        availability: "NOT_ACCEPTING_NEW_COLLABORATIONS",
      },
    });
    const rebound = await rates.read(actor);
    expect(rebound.values?.REEL_VIDEO.amountMinor).toBe(10000);
    expect(rebound.values?.usageDays).toBe(30);
    expect(await fingerprint()).toEqual(before);
    const purge = {
      purpose: "CREATOR_OWNER_SCOPE_PURGE" as const,
      workspaceId: target.workspaceId,
      ownerCreatorProfileId: target.ownerProfileId,
    };
    await repo.purgeOwnerScope(purge);
    expect(
      await db.creatorWorkPreferences.count({
        where: { workspaceId: target.workspaceId },
      }),
    ).toBe(1);
    await wpRepo.purgeOwnerScope(purge);
    expect(
      await db.creatorRateCard.count({
        where: { workspaceId: target.workspaceId },
      }),
    ).toBe(0);
    expect(
      await db.creatorWorkPreferences.count({
        where: { workspaceId: target.workspaceId },
      }),
    ).toBe(0);
    expect(
      await db.creatorWorkPreferences.findMany({
        where: { workspaceId: { not: target.workspaceId } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(othersBefore);
    expect(await fingerprint()).toEqual(before);
    expect((await wp.read(actor)).state).toBe("UNCONFIGURED");
    expect((await rates.read(actor)).state).toBe("UNCONFIGURED");
    console.log(
      "P4_EXTERNAL_TABLES=195; populated Campaign/Collaboration/CreatorBrand preserved; independent edits/rebind/target purge PASS; cross-Creator canonical rows preserved",
    );
  }, 120000);
});

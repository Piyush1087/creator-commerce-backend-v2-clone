import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient, UserRole } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../../../prisma/prisma.service";
import { CreatorWorkspaceActorService } from "../../creator-settings/team/creator-workspace-actor.service";
import { PrismaCreatorPayoutCountryAuthorityAdapter } from "../../creator-settings/payouts/prisma-creator-payout-country-authority.adapter";
import { CreatorShippingReadinessAdapter } from "../../creator-settings/services/creator-shipping-readiness.adapter";
import { PrismaCreatorPayoutReadinessService } from "../../brand-payouts/services/prisma-creator-payout-readiness.service";
import { WorkPreferencesRepository } from "./work-preferences.repository";
import { WorkPreferencesService } from "./work-preferences.service";
describe.skipIf(process.env.CREATOR_WORK_PREFERENCES_UPGRADE_TEST !== "true")(
  "Populated accepted102 to Work Preferences103",
  () => {
    const db = new PrismaClient();
    afterAll(async () => {
      await db.$disconnect();
    });
    it("preserves every predecessor table count/sorted digest and adds an independent manual aggregate", async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "127.0.0.1" ||
        route.pathname !== "/c05_creator_brand_upgrade_shared"
      )
        throw new Error(
          "Exact disposable accepted-predecessor upgrade route required",
        );
      expect(
        await db.$queryRaw<
          Array<{ n: number }>
        >`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 102 }]);
      const tables = await db.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
      const fingerprints = async () =>
        Promise.all(
          tables.map(async ({ tablename }) => {
            if (!/^[a-z0-9_]+$/u.test(tablename))
              throw new Error("Unsafe table identifier");
            const rows = await db.$queryRawUnsafe<
              Array<{ rows: number; digest: string }>
            >(
              `SELECT count(*)::int AS rows, md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) AS digest FROM "${tablename}" t`,
            );
            return { table: tablename, ...rows[0] };
          }),
        );
      const before = await fingerprints();
      expect(
        before.find((row) => row.table === "creator_brand_profiles")?.rows,
      ).toBeGreaterThan(0);
      expect(
        before.find((row) => row.table === "uce_campaigns")?.rows,
      ).toBeGreaterThan(0);
      expect(
        before.find((row) => row.table === "collaborations")?.rows,
      ).toBeGreaterThan(0);
      try {
        execFileSync(
          process.execPath,
          [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
          { stdio: "pipe", env: process.env },
        );
      } catch {
        throw new Error("WORK_PREFERENCES_UPGRADE_DEPLOY_FAILED");
      }
      expect(await fingerprints()).toEqual(before);
      expect(
        await db.$queryRaw<
          Array<{ n: number }>
        >`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 103 }]);
      expect(await db.creatorWorkPreferences.count()).toBe(0);
      expect(await db.creatorWorkPreferencesRevision.count()).toBe(0);
      const owners = await db.$queryRaw<
        Array<{ id: string; email: string }>
      >`SELECT u.id,u.email FROM users u JOIN creator_profiles p ON p.user_id=u.id JOIN creator_workspaces w ON w.owner_profile_id=p.id JOIN creator_workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id WHERE m.security_role_token='OWNER' AND m.is_active_active AND u.auth_state='ACTIVE' ORDER BY u.id LIMIT 1`;
      expect(owners).toHaveLength(1);
      const prisma = db as unknown as PrismaService;
      const service = new WorkPreferencesService(
        new WorkPreferencesRepository(
          prisma,
          new CreatorWorkspaceActorService(prisma),
          new PrismaCreatorPayoutCountryAuthorityAdapter(prisma),
          new CreatorShippingReadinessAdapter(prisma),
        ),
        new PrismaCreatorPayoutReadinessService(prisma),
      );
      const first = await service.mutate(
        {
          ...owners[0],
          name: null,
          role: UserRole.CREATOR,
          organizationId: null,
        },
        {
          expectedRevision: 0,
          expectedRateCardRevision: 0,
          confirmMonetaryReset: false,
          idempotencyKey: randomUUID(),
          values: {
            baseCountry: "IN",
            openToInternationalBrands: null,
            preferredIndustryIds: [],
            excludedIndustryIds: [],
            availability: "ACCEPTING_COLLABORATIONS",
            pausedUntil: null,
            physicalProductCollaborations: null,
            ugcProjects: null,
            giftingBarter: null,
          },
        },
      );
      expect(first.currentRevision).toBe(1);
      expect(await fingerprints()).toEqual(before);
      console.log(
        `UPGRADE_102_TO_103_PRESERVED_TABLES=${tables.length}; exact predecessor counts/sorted row digests; independent WorkPreferences=1/revision=1`,
      );
    }, 60000);
  },
);

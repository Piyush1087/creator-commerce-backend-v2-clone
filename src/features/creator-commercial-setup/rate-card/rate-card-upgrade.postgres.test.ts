import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, it, expect } from "vitest";
describe.skipIf(process.env.CREATOR_RATE_CARD_UPGRADE_TEST !== "true")(
  "Populated103 to Rate Card104",
  () => {
    const db = new PrismaClient();
    afterAll(() => db.$disconnect());
    it("preserves every predecessor public table including manual Work Preferences", async () => {
      const route = new URL(process.env.DATABASE_URL ?? "");
      if (
        route.hostname !== "127.0.0.1" ||
        route.pathname !== "/c05_creator_brand_upgrade_shared"
      )
        throw new Error("Exact disposable populated103 route required");
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 103 }]);
      expect(await db.creatorWorkPreferences.count()).toBeGreaterThan(0);
      const tables = await db.$queryRaw<
        Array<{ tablename: string }>
      >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename`;
      const fingerprints = () =>
        Promise.all(
          tables.map(async ({ tablename }) => {
            if (!/^[a-zA-Z0-9_]+$/.test(tablename))
              throw new Error("Invalid table identity");
            return {
              tablename,
              rows: await db.$queryRawUnsafe(
                `SELECT count(*)::int n, md5(coalesce(string_agg(row_json,'|' ORDER BY row_json),'')) digest FROM (SELECT row_to_json(t)::text row_json FROM "${tablename}" t) s`,
              ),
            };
          }),
        );
      const before = await fingerprints();
      execFileSync(
        process.execPath,
        [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
        { env: process.env, stdio: "pipe", timeout: 120000 },
      );
      expect(await fingerprints()).toEqual(before);
      expect(tables).toHaveLength(197);
      expect(
        await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
      ).toEqual([{ n: 104 }]);
      expect(await db.creatorRateCard.count()).toBe(0);
      expect(await db.creatorRateCardRevision.count()).toBe(0);
    }, 120000);
  },
);

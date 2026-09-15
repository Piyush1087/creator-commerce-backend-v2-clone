import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { portfolioTestOwner } from "./portfolio.fixture";
import { audienceV1TestRuntime } from "../../creator-audience-v1/creator-audience-v1.test-fixture";
import type { InstagramIntelligenceProviderReadClient } from "../../instagram/instagram-intelligence-provider.types";
const enabled = process.env.CREATOR_PORTFOLIO_UPGRADE_TEST === "true";
describe.skipIf(!enabled)("Portfolio populated 104 to 105 upgrade", () => {
  const db = new PrismaClient();
  beforeAll(async () => {
    const route = new URL(process.env.DATABASE_URL ?? "");
    if (
      route.hostname !== "localhost" ||
      route.port !== "55472" ||
      route.pathname !== "/creator_portfolio_v3_p1"
    )
      throw new Error("TASK_OWNED_PORTFOLIO_UPGRADE_ROUTE_REQUIRED");
    await db.$connect();
  });
  afterAll(async () => db.$disconnect());
  async function digests() {
    const tables = await db.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' AND tablename NOT LIKE 'creator_portfolio%' ORDER BY tablename`;
    const rows = [];
    for (const { tablename } of tables) {
      if (!/^[a-zA-Z0-9_]+$/u.test(tablename))
        throw new Error("UNEXPECTED_TABLE_IDENTITY");
      const [row] = await db.$queryRawUnsafe<
        Array<{ count: number; digest: string }>
      >(
        `SELECT count(*)::int count, md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) digest FROM "${tablename}" t`,
      );
      rows.push({ table: tablename, ...row });
    }
    return rows;
  }
  it("preserves every predecessor table count/digest after actual repository migration deploy", async () => {
    expect(
      await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    ).toEqual([{ n: 104 }]);
    const a = await portfolioTestOwner(db);
    const provider = {
      readProfile: async () => ({
        availability: "AVAILABLE",
        providerAccountId: a.providerAccountId,
        appScopedUserId: { state: "OBSERVED", value: a.providerAccountId },
        username: { state: "OBSERVED", value: "fixture" },
        name: { state: "OBSERVED", value: "Fixture" },
        accountType: { state: "OBSERVED", value: "CREATOR" },
        followersCount: { state: "OBSERVED", value: 1000 },
        followsCount: { state: "OBSERVED", value: 5 },
        mediaCount: { state: "OBSERVED", value: 0 },
      }),
      readAudienceInsights: async (
        _: unknown,
        population: string,
        breakdown: string,
      ) => ({
        availability: "AVAILABLE",
        population,
        breakdown,
        timeframe: "THIS_MONTH",
        denominator: 100,
        values: [
          { dimension: "A", value: 60 },
          { dimension: "B", value: 40 },
        ],
        limitation: null,
      }),
    } as unknown as InstagramIntelligenceProviderReadClient;
    const runtime = audienceV1TestRuntime(db, provider);
    await runtime.pipeline.execute({
      actor: a.actor,
      integrationId: a.integration.id,
      providerAccountId: a.providerAccountId,
      authorizationGeneration: 1,
      capturedAt: new Date(),
      requestIdentity: "portfolio-upgrade-accepted-source",
    });
    const before = await digests();
    expect(
      before.find((row) => row.table === "data_extraction_evidence_items")
        ?.count,
    ).toBeGreaterThan(0);
    expect(
      before.find((row) => row.table === "intelligence_object_generations")
        ?.count,
    ).toBeGreaterThan(0);
    const deploy = spawnSync("npm", ["run", "db:migrate:deploy"], {
      shell: process.platform === "win32",
      encoding: "utf8",
      env: process.env,
    });
    expect(
      deploy.status,
      "Actual repository migration deploy must succeed",
    ).toBe(0);
    expect(await digests()).toEqual(before);
    expect(
      await db.$queryRaw`SELECT count(*)::int n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    ).toEqual([{ n: 105 }]);
    console.info(
      "PORTFOLIO_POPULATED_UPGRADE",
      JSON.stringify({
        predecessorTables: before.length,
        populatedTables: before.filter((row) => row.count > 0).length,
        totalRows: before.reduce((sum, row) => sum + row.count, 0),
        beforeAfterDigestEqual: true,
        inventoryHash: createHash("sha256")
          .update(JSON.stringify(before))
          .digest("hex"),
      }),
    );
  }, 180000);
});

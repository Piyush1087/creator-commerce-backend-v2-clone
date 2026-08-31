import { PrismaClient } from "@prisma/client";
import { beforeAll, expect } from "vitest";

// Some existing BI tests deliberately leave globally claimable queue entries.
// Isolate integration files, not tests within a file: their transaction/history
// assertions must still run against the unchanged production repositories.
const testPath = expect.getState().testPath ?? "";
if (
  /\.(?:database|postgres)\.test\.ts$/.test(testPath) &&
  !testPath.endsWith("commercial-migration-upgrade.postgres.test.ts")
) {
  beforeAll(async () => {
    const target = process.env.DE_W2_DATABASE_URL;
    if (!target || target !== process.env.DATABASE_URL)
      throw new Error("DE_W2_ISOLATION_REQUIRES_DISPOSABLE_TARGET");
    const url = new URL(target);
    if (
      url.hostname !== "127.0.0.1" ||
      !/^\/(?:codex_de_w2|codex_p2b2_migration)_[a-f0-9]{12}$/.test(
        url.pathname,
      ) ||
      !/^(?:codex_de_w2_role|codex_p2b2_role)_[a-f0-9]{12}$/.test(url.username)
    )
      throw new Error("DE_W2_ISOLATION_REJECTED_NON_DISPOSABLE_TARGET");
    const prisma = new PrismaClient();
    try {
      const database = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT current_database() AS name`;
      if (database[0]?.name !== url.pathname.slice(1))
        throw new Error("DE_W2_ISOLATION_DATABASE_MISMATCH");
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      if (
        !tables.length ||
        tables.some((t) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.tablename))
      )
        throw new Error("DE_W2_ISOLATION_UNEXPECTED_TABLE_SET");
      // Only fixture rows in the exact disposable database are cleared. All 52
      // migrations, CHECK constraints and foreign keys stay in place.
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
      );
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);
}

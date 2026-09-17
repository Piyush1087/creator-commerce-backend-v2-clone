import { PrismaClient } from "@prisma/client";

import { requireDisposableFinalGateDatabase } from "./guard";

const prisma = new PrismaClient();

async function main() {
  requireDisposableFinalGateDatabase();
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const quoted = tables
    .map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
    .join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
  process.stdout.write(
    JSON.stringify({
      reset: "COMPLETE",
      retainedMigrationHistory: true,
      tableCount: tables.length,
    }) + "\n",
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "FINAL_GATE_RESET_FAILED",
    );
    process.exitCode = 1;
  });

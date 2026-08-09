import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'discovery_leads'
      AND column_name IN (
        'temporary_payload',
        'expires_at',
        'signup_completed',
        'classification_evidence'
      )
    ORDER BY column_name
  `;

  const indexes = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'discovery_leads'
      AND indexname = 'idx_discovery_cache_lookup'
  `;

  console.log("columns", JSON.stringify(columns));
  console.log("index", JSON.stringify(indexes));

  if (columns.length !== 4) {
    throw new Error(`Expected 4 new columns, found ${columns.length}`);
  }
  if (indexes.length !== 1) {
    throw new Error("Missing idx_discovery_cache_lookup index");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect().finally(() => process.exit(1));
  });

import { PrismaClient } from "@prisma/client";
import { establishInitialBrandOwner } from "../src/features/brand-settings/team/initial-brand-owner";

// Explicit, bounded operator execution. DATABASE_URL is injected by the approved
// runtime; no dotenv auto-load, no automatic startup or authorization hook.
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const ids = args.filter((arg) => arg !== "--apply");
  if (
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
  ) {
    throw new Error(
      "Supply 1–100 reviewed BrandProfile UUIDs; dry-run by default, --apply to write.",
    );
  }
  const prisma = new PrismaClient();
  try {
    for (const id of ids) {
      const status = await prisma.$transaction(async (tx) => {
        const profile = await tx.brandProfile.findUnique({ where: { id } });
        if (!profile?.verificationEmail) return "NO_VERIFIED_IDENTITY";
        const users = await tx.user.findMany({
          where: {
            email: {
              equals: profile.verificationEmail.trim(),
              mode: "insensitive",
            },
          },
        });
        if (users.length !== 1) return "AMBIGUOUS_IDENTITY";
        return establishInitialBrandOwner(tx, id, users[0].id, apply);
      });
      console.log(
        JSON.stringify({
          brandProfileId: id,
          mode: apply ? "apply" : "dry-run",
          status,
        }),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Owner reconciliation failed; no credentials or identity data are printed. Review database state before retrying.",
  );
  process.exitCode = 1;
});

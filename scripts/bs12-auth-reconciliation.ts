import { PrismaClient, UserAuthState, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function countSql(query: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const [
    normalizedEmailMismatch,
    normalizedEmailCollisions,
    activeWithoutAuthMethod,
    provisionalWithSession,
    activeBrandWithoutMembership,
    unusedLegacyBrandOtp,
    legacyCreatorOtpRows,
  ] = await Promise.all([
    countSql(
      "SELECT count(*) FROM users WHERE normalized_email <> lower(normalize(btrim(email), NFC))",
    ),
    countSql(
      "SELECT count(*) FROM (SELECT normalized_email FROM users GROUP BY normalized_email HAVING count(*) > 1) c",
    ),
    prisma.user.count({
      where: { authState: UserAuthState.ACTIVE, authMethods: { none: {} } },
    }),
    prisma.user.count({
      where: {
        authState: UserAuthState.PROVISIONAL,
        authSessions: { some: { revokedAt: null } },
      },
    }),
    prisma.user.count({
      where: {
        role: UserRole.BRAND,
        authState: UserAuthState.ACTIVE,
        brandTeamMemberships: { none: { isActive: true } },
      },
    }),
    prisma.verificationCode.count({ where: { isUsed: false } }),
    prisma.emailOtpVerification.count(),
  ]);

  const report = {
    report: "BS12_AUTH_RECONCILIATION",
    generatedAt: new Date().toISOString(),
    normalizedEmailMismatch,
    normalizedEmailCollisions,
    activeWithoutAuthMethod,
    provisionalWithSession,
    activeBrandWithoutMembership,
    unusedLegacyBrandOtp,
    legacyCreatorOtpRows,
    requiresManualReview:
      normalizedEmailMismatch > 0 ||
      normalizedEmailCollisions > 0 ||
      activeWithoutAuthMethod > 0 ||
      provisionalWithSession > 0 ||
      activeBrandWithoutMembership > 0 ||
      unusedLegacyBrandOtp > 0 ||
      legacyCreatorOtpRows > 0,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.requiresManualReview) process.exitCode = 2;
}

main()
  .catch(() => {
    process.stderr.write("BS12 auth reconciliation failed\n");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

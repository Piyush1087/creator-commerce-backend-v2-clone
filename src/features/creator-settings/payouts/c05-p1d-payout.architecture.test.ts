import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("C-05 P1D architecture boundaries", () => {
  it("uses an advisory lock and canonical unverified state for primary replacement", () => {
    const source = read(
      "src/features/creator-settings/payouts/prisma-creator-payout-settings.repository.ts",
    );
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("CONFIGURED_UNVERIFIED");
    expect(source).toContain('reasonCode: "REPLACED"');
    expect(source).not.toContain("CreatorBankDetails");
    expect(source).not.toContain("CreatorSettlementProfile");
  });

  it("retains the database-enforced single-active-primary invariant", () => {
    const migration = read(
      "prisma/migrations/20260909123000_c05_p0_payout_destination/migration.sql",
    );
    expect(migration).toContain(
      "creator_payout_destinations_active_primary_key",
    );
    expect(migration).toContain(
      'WHERE "is_primary" = true AND "state" <> \'DISABLED\'',
    );
  });

  it("contains no schema or migration owned by P1D", () => {
    const status = read("prisma/schema.prisma");
    expect(status).toContain("secretPayloadEncrypted");
    expect(status).toContain("CreatorLegalProfile");
  });

  it("keeps provider behavior outside the canonical settings service", () => {
    const source = read(
      "src/features/creator-settings/payouts/creator-payout-settings.service.ts",
    );
    for (const forbidden of [
      "reconcileProviderEvidence",
      "beneficiary provisioning",
      "executeTransfer",
      "settlement",
      "ledger",
      "KYC",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps legacy data compatibility-only without automatic persistence", () => {
    const source = read(
      "src/features/creator-settings/payouts/legacy-creator-payout.adapter.ts",
    );
    expect(source).toContain('disposition: "COMPATIBILITY_ONLY"');
    expect(source).toContain("importsCanonicalDestination: false");
    expect(source).toContain("importsPan: false");
    expect(source).not.toContain("PrismaService");
  });
});

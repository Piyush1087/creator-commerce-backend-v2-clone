import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const migrationPaths = [
  "prisma/migrations/20260909120000_c05_p0_team_user_identity/migration.sql",
  "prisma/migrations/20260909121000_c05_p0_contact_phone/migration.sql",
  "prisma/migrations/20260909122000_c05_p0_legal_profile/migration.sql",
  "prisma/migrations/20260909123000_c05_p0_payout_destination/migration.sql",
] as const;

describe("C05 P0 additive foundation", () => {
  it("keeps every P0 migration additive and free of data reconciliation", () => {
    for (const path of migrationPaths) {
      const executable = source(path).replace(/--.*$/gm, "");
      expect(executable).not.toMatch(
        /(?:^|;)\s*(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|MERGE)\b/im,
      );
    }
  });

  it("adds nullable direct User identity without using email as authority", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(migrationPaths[0]);
    const contract = source(
      "src/shared/creator/creator-workspace-actor.contract.ts",
    );

    expect(schema).toMatch(/userId\s+String\?\s+@map\("user_id"\)/);
    expect(schema).toContain(
      '@relation("CreatorWorkspaceMemberUser", fields: [userId], references: [id], onDelete: SetNull)',
    );
    expect(migration).toContain(
      'WHERE "user_id" IS NOT NULL AND "is_active_active" = true',
    );
    expect(migration).not.toMatch(/SET\s+"user_id"/i);
    expect(contract).not.toMatch(/readonly associatedEmail\s*:/);
  });

  it("preserves legacy phone while adding structured normalized fields", () => {
    const schema = source("prisma/schema.prisma");

    expect(schema).toContain("phone                         String?");
    expect(schema).toContain("phoneCountryCallingCode");
    expect(schema).toContain("phoneNationalNumber");
    expect(schema).toContain("phoneE164");
  });

  it("stores destination secrets only through an encrypted payload", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source(migrationPaths[3]);
    const destination = schema.slice(
      schema.indexOf("model CreatorPayoutDestination {"),
      schema.indexOf("model CreatorPayoutDestinationProviderMapping {"),
    );

    expect(destination).toContain("secretPayloadEncrypted");
    expect(destination).toContain("payeeType");
    expect(destination).toContain("beneficiaryName");
    expect(destination).toContain("maskedDisplay");
    expect(destination).not.toMatch(
      /\b(?:accountNumber|routingNumber|ifscCode|upiIdentifier|paypalEmail)\b/,
    );
    expect(migration).toContain(
      'WHERE "is_primary" = true AND "state" <> \'DISABLED\'',
    );
  });

  it("does not import PAN, tax, KYC, or verification authority", () => {
    const foundation = migrationPaths
      .map((path) => source(path))
      .join("\n")
      .replace(/--.*$/gm, "");
    const withoutTruthfulState = foundation.replace(
      /CONFIGURED_UNVERIFIED/g,
      "",
    );

    expect(withoutTruthfulState).not.toMatch(/\b(?:PAN|TAX|KYC|VERIFIED)\b/i);
    expect(foundation).toContain("CONFIGURED_UNVERIFIED");
  });
});

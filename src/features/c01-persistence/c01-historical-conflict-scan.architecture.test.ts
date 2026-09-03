import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "scripts/c01-i1-historical-conflict-scan.sql"),
  "utf8",
);
const statements = source
  .replace(/--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);
const statementFor = (marker: string) => {
  const statement = statements.find((candidate) => candidate.includes(marker));
  expect(statement, `missing statement for ${marker}`).toBeDefined();
  return statement!;
};

describe("C01-I1 historical conflict register", () => {
  it("is SELECT-only", () => {
    const executable = source.replace(/--.*$/gm, "");
    expect(executable).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|CALL|DO)\b/i,
    );
    expect(executable.match(/\bSELECT\b/gi)?.length).toBeGreaterThanOrEqual(16);
  });

  it("retains the complete A2 register and supplementary checks", () => {
    for (let index = 1; index <= 11; index += 1) {
      expect(source).toContain(`C01-DATA-${String(index).padStart(2, "0")}`);
    }
    for (const check of [
      "NORMALIZED_EMAIL_DRIFT",
      "ASSIGNED_PROFILE_EMAIL_MISMATCH",
      "OWNER_SEAT_INCONSISTENCY",
      "AUTH_STATE_CONTRADICTION",
      "VERIFIED_BRAND_MISSING_ORGANIZATION_OWNER",
    ]) {
      expect(source).toContain(check);
    }
  });

  it("implements the authoritative membership and dual-context semantics", () => {
    const brandMembership = statementFor(
      "C01-DATA-02_BRAND_CROSS_ORGANIZATION_MEMBERSHIP",
    );
    expect(brandMembership).toContain('JOIN "users" u');
    expect(brandMembership).toContain('u."organization_id" IS NULL');
    expect(brandMembership).toContain('bp."organization_id" IS NULL');
    expect(brandMembership).toContain(
      'u."organization_id" IS DISTINCT FROM bp."organization_id"',
    );

    const dualContext = statementFor("C01-DATA-03_BRAND_CREATOR_DUAL_CONTEXT");
    expect(dualContext).toContain("u.\"role\" = 'BRAND'");
    expect(dualContext).toContain('FROM "brand_team_members"');
    expect(dualContext).toContain('bp."organization_id" = u."organization_id"');
  });

  it("resolves Creator member audit identity through normalized email", () => {
    const crossOrganization = statementFor(
      "C01-DATA-06_CREATOR_MEMBER_EMAIL_ORGANIZATION_COLLISION",
    );
    expect(crossOrganization).toContain(
      'matched_u."normalized_email" = lower(normalize(btrim(cwm."associated_email"), NFC))',
    );
    expect(crossOrganization).toContain('JOIN "users" owner_u');
    expect(crossOrganization).toContain(
      'matched_u."organization_id" IS DISTINCT FROM owner_u."organization_id"',
    );

    const missingUser = statementFor(
      "C01-DATA-07_CREATOR_MEMBER_WITHOUT_CANONICAL_USER",
    );
    expect(missingUser).toContain("NOT EXISTS");
    expect(missingUser).toContain(
      'u."normalized_email" = lower(normalize(btrim(cwm."associated_email"), NFC))',
    );
  });

  it("uses legacy Creator OTP and full provider/onboarding evidence", () => {
    const onboarding = statementFor(
      "C01-DATA-09_LEGACY_ONBOARDING_CONTRADICTION",
    );
    for (const evidence of [
      '"creator_onboarding_tracks"',
      "META_OAUTH_SUCCESS",
      "AI_ENGINE_SYNCED",
      'cot."instagram_meta_id"',
      "u.\"role\" <> 'CREATOR'",
      "csi.\"token_state_condition\" <> 'ACTIVE'",
      "csi.\"professional_account_type\" = 'PERSONAL'",
      "WAITLISTED",
      'cot."is_approved" = true',
    ]) {
      expect(onboarding).toContain(evidence);
    }

    expect(statementFor("C01-DATA-10_LEGACY_OTP_STATE")).toContain(
      'FROM "email_otp_verifications"',
    );
    expect(
      statementFor("C01-DATA-10_LEGACY_OTP_CANONICAL_CHALLENGE_OVERLAP"),
    ).toContain('JOIN "email_otp_challenges"');

    const provider = statementFor(
      "C01-DATA-11_ORPHAN_INCONSISTENT_PROVIDER_RECORD",
    );
    for (const evidence of [
      "u.\"role\" <> 'CREATOR'",
      'csi."oauth_access_token_encrypted"',
      "csi.\"professional_account_type\" = 'PERSONAL'",
      "csi.\"token_state_condition\" = 'ACTIVE'",
      'csi."token_expires_at" <= CURRENT_TIMESTAMP',
    ]) {
      expect(provider).toContain(evidence);
    }
  });

  it("retains the accepted BS-12 contradiction checks", () => {
    const auth = statementFor("C01-SUPPLEMENT_AUTH_STATE_CONTRADICTION");
    expect(auth).toContain('FROM "user_auth_methods"');
    expect(auth).toContain('uam."disabled_at" IS NULL');
    expect(auth).toContain('FROM "auth_sessions"');
    expect(auth).toContain('session."revoked_at" IS NULL');
    expect(auth).toContain('session."absolute_expires_at" > CURRENT_TIMESTAMP');
  });
});

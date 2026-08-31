import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "scripts/c01-i1-historical-conflict-scan.sql"),
  "utf8",
);

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
});

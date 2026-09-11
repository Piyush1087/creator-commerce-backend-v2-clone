import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";

/**
 * G1C bank ownership: Creator Settings payout destinations are canonical.
 * Collaboration leftover bank write is 410; table may remain.
 */
test("Collaboration leftover bank-details HTTP is retired to Creator Settings", () => {
  const controllerPath = join(__dirname, "../collaboration.controller.ts");
  const source = readFileSync(controllerPath, "utf8");
  assert.equal(source.includes("creator/bank-details"), true);
  assert.equal(source.includes("upsertBankDetails"), true);
  assert.match(source, /GoneException/);
  assert.match(source, /Use Creator Settings payout destinations/);
});

test("Collaboration creator profile service no longer mutates bank details", () => {
  const servicePath = join(
    __dirname,
    "./collaboration-creator-profile.service.ts",
  );
  const source = readFileSync(servicePath, "utf8");
  assert.equal(source.includes("upsertBankDetails"), false);
  assert.equal(source.includes("creatorBankDetails.create"), false);
});

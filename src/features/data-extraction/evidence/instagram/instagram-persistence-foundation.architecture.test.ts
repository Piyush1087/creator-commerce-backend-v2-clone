import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INSTAGRAM_DE_CONTRACT } from "../../../instagram-intelligence/contracts/instagram-intelligence.registry";

const schema = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260911020000_instagram_de_persistence_foundation",
    "migration.sql",
  ),
  "utf8",
);
const writer = readFileSync(
  join(
    process.cwd(),
    "src",
    "features",
    "data-extraction",
    "evidence",
    "instagram",
    "instagram-capture-writer.service.ts",
  ),
  "utf8",
);
const capabilityConstraintNames = [
  "ck_de_capexec_supported_capability",
  "ck_de_capresource_supported_capability",
  "ck_de_evidence_supported_capability",
  "ck_de_capevidence_supported_capability",
  "ck_de_observation_supported_capability",
  "ck_de_obs_support_supported_capability",
  "ck_de_obs_relation_supported_capability",
] as const;
const websiteCapabilities = [
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
  "observed_brand_communication_language_signals",
  "derived_communication_constraint_evidence",
  "explicit_factual_proof_or_claim_evidence",
  "owned_website.visual_evidence",
  "owned_website.serviceability_evidence",
  "owned_website.location_evidence",
  "owned_website.offering_commercial_evidence",
] as const;

describe("B1 Instagram DE persistence architecture boundary", () => {
  it("adds exactly the installed source and resource vocabulary", () => {
    expect(INSTAGRAM_DE_CONTRACT.sourceClass).toBe("INSTAGRAM_OWNED");
    expect(INSTAGRAM_DE_CONTRACT.resourceTypes).toEqual([
      "INSTAGRAM_ACCOUNT",
      "INSTAGRAM_MEDIA",
    ]);
    expect(INSTAGRAM_DE_CONTRACT.capabilities).toHaveLength(9);
    for (const value of [
      INSTAGRAM_DE_CONTRACT.sourceClass,
      ...INSTAGRAM_DE_CONTRACT.resourceTypes,
    ]) {
      expect(schema).toContain(value);
      expect(migration).toContain(value);
    }
  });

  it("is additive and leaves Settings and Intelligence tables untouched", () => {
    expect(migration).not.toMatch(/DROP (?:TABLE|COLUMN)|TRUNCATE|RENAME/i);
    expect(migration).not.toMatch(
      /ALTER TABLE "(?:brand_integrations|object_generations|component_generations|intelligence_)/i,
    );
    expect(migration).not.toMatch(/CREATE TABLE/i);
  });

  it("replaces exactly seven allowlists with the identical 19 capabilities", () => {
    const dropped = [...migration.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(dropped).toEqual(capabilityConstraintNames);
    for (const name of capabilityConstraintNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = migration.match(
        new RegExp(
          `ADD CONSTRAINT "${escapedName}"\\s+CHECK \\("capability_id" IN \\((.*?)\\)\\);`,
          "s",
        ),
      );
      expect(match).not.toBeNull();
      const values = [...(match?.[1] ?? "").matchAll(/'([^']+)'/g)].map(
        (value) => value[1],
      );
      expect(values).toEqual([
        ...websiteCapabilities,
        ...INSTAGRAM_DE_CONTRACT.capabilities,
      ]);
      expect(new Set(values).size).toBe(19);
    }
    expect(migration).not.toMatch(/NOT VALID|instagram\.\*|LIKE 'instagram/i);
  });

  it("persists only non-secret provider identity and authorization fencing", () => {
    for (const column of [
      "provider_account_id",
      "provider_integration_id",
      "authorization_generation",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).not.toMatch(
      /access_token|refresh_token|signed_url|media_url/i,
    );
    expect(writer).toContain("FOR UPDATE");
    expect(writer).toContain("STALE_AUTHORIZATION_GENERATION");
    expect(writer).toContain("PROVIDER_ACCOUNT_MISMATCH");
  });

  it("contains no provider call, controller, scheduler, or Intelligence write path", () => {
    expect(writer).not.toMatch(
      /axios|fetch\(|graph\.facebook|graph\.instagram/i,
    );
    expect(writer).not.toMatch(/@Controller|@Resolver|@Cron|ObjectGeneration/i);
  });

  it("completes a successful Capture before admitting its first Evidence", () => {
    const completeAt = writer.indexOf("captures.markCompleted");
    const evidenceAt = writer.indexOf(
      "for (const [index, evidence] of input.evidence.entries())",
    );
    expect(completeAt).toBeGreaterThan(-1);
    expect(evidenceAt).toBeGreaterThan(completeAt);
    expect(writer.indexOf("captures.markFailed")).toBeLessThan(evidenceAt);
  });
});

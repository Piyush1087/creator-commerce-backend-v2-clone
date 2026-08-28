import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);
const marker = "// DATA EXTRACTION WAVE 1 PERSISTENCE (DE-W1.0B)";
const deSchema = schema.slice(schema.indexOf(marker));
const migration = readFileSync(
  join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260825181500_add_data_extraction_wave1_evidence_persistence",
    "migration.sql",
  ),
  "utf8",
);

describe("DE-W1.0B persistence architecture boundary", () => {
  it("is additive and does not alter legacy or Brand Intelligence persistence", () => {
    expect(migration).not.toMatch(
      /DROP TABLE|DROP COLUMN|RENAME COLUMN|TRUNCATE/i,
    );
    for (const table of [
      "intelligence_evidence_references",
      "intelligence_executions",
      "brand_preview_runs",
      "brand_intelligence_scans",
    ]) {
      expect(migration).not.toContain(`ALTER TABLE "${table}"`);
    }
  });

  it("contains no Intelligence authority/current/readiness or provider-model persistence", () => {
    for (const forbidden of [
      "IntelligenceAuthority",
      "IntelligenceReadiness",
      "IntelligenceCurrent",
      "providerId",
      "modelId",
      "@Controller",
      "@Resolver",
      "frontend",
    ]) {
      expect(deSchema).not.toContain(forbidden);
    }
  });

  it("persists exactly the five Wave 1 capability IDs and no provider-specific capability enum", () => {
    for (const capability of [
      "owned_website.brand_messaging",
      "owned_website.brand_company_context",
      "owned_website.offering_context",
      "observed_brand_communication_language_signals",
      "derived_communication_constraint_evidence",
    ]) {
      expect(migration).toContain(capability);
    }
    expect(deSchema).not.toMatch(/Gemini|OpenAI|Zyte|Playwright/i);
  });
});

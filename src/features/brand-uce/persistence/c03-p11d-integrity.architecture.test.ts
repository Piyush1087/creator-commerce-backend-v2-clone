import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260910121500_c03_integrity_guards_and_legacy_compatibility/migration.sql",
);

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith(".ts") &&
          !path.endsWith(".test.ts") &&
          !path.endsWith(".spec.ts")
        ? [path]
        : [];
  });
}

describe("C-03 P1.1D persistence and runtime architecture", () => {
  it("retains one canonical Brief model and one Application aggregate", () => {
    expect(schema.match(/^model CanonicalCampaignBrief \{/gm)).toHaveLength(1);
    expect(schema.match(/^model UceApplication \{/gm)).toHaveLength(1);
    expect(schema.match(/@@map\("campaign_briefs"\)/g)).toHaveLength(1);
    expect(schema.match(/@@map\("uce_applications"\)/g)).toHaveLength(1);
    expect(schema).not.toMatch(
      /^model (?:C03|CreatorCampaign)Application \{/gm,
    );
    expect(schema).not.toMatch(/^model C03CampaignBrief \{/gm);
  });

  it("replaces the temporary write closure with permanent deferred evidence guards", () => {
    expect(migration).toContain(
      'DROP TRIGGER "c03_canonical_application_write_closed"',
    );
    expect(migration).toContain(
      'CREATE CONSTRAINT TRIGGER "c03_canonical_application_evidence_guard"',
    );
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED");
    for (const token of [
      "C03_APPLICATION_AUTHORITY_IMMUTABLE",
      "C03_APPLICATION_TRANSITION_INVALID",
      "C03_APPLICATION_DELETE_FORBIDDEN",
      "C03_APPLICATION_SNAPSHOT_IMMUTABLE",
      "C03_CANONICAL_APPLICATION_REQUIRES_ONE_SNAPSHOT",
      "C03_CANONICAL_APPLICATION_REQUIRES_MATCHING_EVENT",
      "C03_CREATOR_ENTRY_CONTINUATION_DELETE_FORBIDDEN",
    ]) {
      expect(migration).toContain(token);
    }
  });

  it("routes every existing Campaign status writer through the shared lock seam", () => {
    const writers = sourceFiles(join(process.cwd(), "src"))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter(
        ({ source }) =>
          /uceCampaign\.(?:update|updateMany)\(/.test(source) &&
          /status\s*:/.test(source),
      );

    expect(writers.map(({ path }) => path.split("/src/")[1]).sort()).toEqual([
      "features/brand-uce/services/brand-uce-campaign.service.ts",
      "features/brand-uce/services/canonical-campaign-create.service.ts",
    ]);
    for (const { source } of writers) {
      expect(source).toContain("CampaignLifecycleLockService");
      expect(source).toContain("campaignLock.lockCampaign(tx, campaignId)");
    }
  });

  it("makes Asset and canonical Brief mutations participate in Campaign locking", () => {
    for (const path of [
      "src/features/brand-uce/services/brand-uce-campaign-asset.service.ts",
      "src/features/brand-uce/services/canonical-campaign-brief.service.ts",
    ]) {
      const source = read(path);
      expect(source).toContain("CampaignLifecycleLockService");
      expect(source).toContain("campaignLock.lockCampaign(tx, campaignId)");
    }
  });

  it("uses the versioned canonical adapter and quarantines legacy Application logic", () => {
    const query = read(
      "src/features/brand-uce/services/campaign-query.service.ts",
    );
    const legacy = read(
      "src/features/brand-uce/services/campaign-application.service.ts",
    );

    expect(query).toContain("projectCanonicalCampaignForApplication(campaign)");
    expect(legacy).toContain("assertLegacyApplicationShape(application)");
    expect(legacy).toContain(
      "UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY",
    );
    expect(legacy).toContain("C03_CANONICAL_APPLICATION_HANDOFF_NOT_AVAILABLE");
  });
});

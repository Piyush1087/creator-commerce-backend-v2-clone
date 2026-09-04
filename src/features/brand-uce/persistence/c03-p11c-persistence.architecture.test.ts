import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260910121000_c03_invitation_ingress_idempotency_events/migration.sql",
  "utf8",
);
const continuationStore = readFileSync(
  "src/features/creator-entry/creator-entry-continuation.store.ts",
  "utf8",
);

describe("C-03 P1.1C persistence architecture", () => {
  it("retains one Application family and adds each security/audit aggregate once", () => {
    for (const model of [
      "UceApplication",
      "UceApplicationSnapshot",
      "CampaignOpportunityInvitation",
      "CampaignIngressTouch",
      "ApplicationCommandReceipt",
      "ApplicationDomainEvent",
    ]) {
      expect(schema.match(new RegExp(`model ${model} \\{`, "g"))).toHaveLength(
        1,
      );
    }
  });

  it("stores digests and HMACs but no raw C-03 credential field", () => {
    expect(schema).toContain("tokenDigest");
    expect(schema).toContain("referenceDigest");
    expect(schema).toContain("idempotencyKeyDigest");
    expect(schema).toContain("intendedNativeInstagramIdHmac");
    expect(schema).toContain("intendedVerifiedEmailHmac");
    expect(schema).not.toMatch(
      /(?:invitation|ingress|idempotency)(?:RawToken|TokenValue|Credential)/,
    );
  });

  it("keeps canonical Application writes closed and installs append-only guards", () => {
    const priorMigration = readFileSync(
      "prisma/migrations/20260910120500_c03_application_snapshot_foundation/migration.sql",
      "utf8",
    );
    expect(priorMigration).toContain("c03_canonical_application_write_closed");
    expect(migration).not.toContain(
      'DROP TRIGGER "c03_canonical_application_write_closed"',
    );
    for (const token of [
      "C03_INVITATION_DELETE_FORBIDDEN",
      "C03_INGRESS_DELETE_FORBIDDEN",
      "C03_APPLICATION_EVENT_APPEND_ONLY",
      "C03_APPLICATION_RECEIPT_APPEND_ONLY",
    ]) {
      expect(migration).toContain(token);
    }
  });

  it("preserves the direct C-01 continuation API through database defaults", () => {
    expect(continuationStore).toContain(
      "createResolvedCampaignApplyContinuation",
    );
    expect(continuationStore).not.toMatch(
      /CampaignOpportunityEntrySurface|CampaignIngressTouchKind/,
    );
    expect(schema).toMatch(
      /entrySurface\s+CampaignOpportunityEntrySurface\s+@default\(DIRECT_CAMPAIGN_LINK\)/,
    );
    expect(schema).toMatch(
      /entryAuthorityKind\s+CampaignOpportunityEntryAuthorityKind\s+@default\(DIRECT\)/,
    );
  });
});

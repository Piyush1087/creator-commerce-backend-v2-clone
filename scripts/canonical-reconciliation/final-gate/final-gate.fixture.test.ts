import { describe, expect, it } from "vitest";

import {
  FINAL_GATE_IDENTITIES,
  FINAL_GATE_OBJECTIVES,
  FINAL_GATE_SCENARIOS,
} from "./contracts";
import { assertB05DraftHashes, assertPublishedCanonicalHashes } from "./audit";
import { requireDisposableFinalGateDatabase } from "./guard";
import { hashCanonicalCampaignDefinition } from "../../../src/features/brand-uce/services/canonical-campaign-definition";

describe("Final Gate validation-only contracts", () => {
  it("freezes six unique role identities and four canonical objectives", () => {
    expect(new Set(Object.values(FINAL_GATE_IDENTITIES)).size).toBe(6);
    expect(FINAL_GATE_OBJECTIVES).toEqual([
      "AWARENESS",
      "TRUST",
      "ASSETS",
      "ACTION",
    ]);
  });

  it("declares all twelve isolated scenario profiles", () => {
    expect(FINAL_GATE_SCENARIOS).toEqual([
      "B01",
      "B02",
      "B03",
      "B04",
      "B05",
      "B06",
      "B07",
      "B08",
      "B09",
      "B10",
      "B11",
      "B12",
    ]);
  });

  it("fails closed without the disposable-run marker", () => {
    const marker = process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    delete process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN;
    expect(() => requireDisposableFinalGateDatabase()).toThrow(/required/);
    if (marker) process.env.CANONICAL_FINAL_GATE_DISPOSABLE_RUN = marker;
  });

  it("requires new B05 campaigns to remain unhashed DRAFTs", () => {
    const before = [];
    const after = ["1", "2", "3", "4"].map((id) => ({
      id,
      status: "DRAFT" as const,
      canonicalDefinition: { version: "2.0" },
      canonicalDefinitionHash: null,
    }));

    expect(() => assertB05DraftHashes(before, after)).not.toThrow();
    expect(() =>
      assertB05DraftHashes(before, [
        ...after.slice(0, 3),
        { ...after[3], canonicalDefinitionHash: `sha256:${"0".repeat(64)}` },
      ]),
    ).toThrow("B05_DRAFT_HASH_LIFECYCLE_MISMATCH");
  });

  it("accepts only correctly recomputed hashes for published canonical campaigns", () => {
    const canonicalDefinition = {
      version: "2.0",
      strategy: { objective: "AWARENESS" },
    };
    const valid = {
      id: "published",
      status: "PUBLISHED" as const,
      canonicalDefinition,
      canonicalDefinitionHash:
        hashCanonicalCampaignDefinition(canonicalDefinition),
    };

    expect(() => assertPublishedCanonicalHashes([valid])).not.toThrow();
    expect(() =>
      assertPublishedCanonicalHashes([
        { ...valid, canonicalDefinitionHash: null },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_INVALID");
    expect(() =>
      assertPublishedCanonicalHashes([
        { ...valid, canonicalDefinitionHash: "sha256:invalid" },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_INVALID");
    expect(() =>
      assertPublishedCanonicalHashes([
        {
          ...valid,
          canonicalDefinitionHash: `sha256:${"0".repeat(64)}`,
        },
      ]),
    ).toThrow("PUBLISHED_CANONICAL_HASH_MISMATCH");
  });
});
